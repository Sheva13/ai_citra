import asyncio
import logging
from datetime import datetime, timezone

from fastapi import WebSocket, WebSocketDisconnect
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import func, select

from .auth import decode_token
from .db import SessionLocal
from .models import Camera, Detection, Event, WorkerStatus

log = logging.getLogger("api.ws")

STALE_HEARTBEAT_SECONDS = 6


def iso_utc(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


class WsManager:
    def __init__(self):
        self.connections: set[WebSocket] = set()
        self._camera_cache: dict[str, str] = {}
        self._event_watermark: datetime | None = None

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.connections.add(websocket)

    def disconnect(self, websocket: WebSocket):
        self.connections.discard(websocket)

    async def broadcast(self, message: dict):
        for websocket in list(self.connections):
            try:
                await websocket.send_json(message)
            except Exception:
                self.disconnect(websocket)


manager = WsManager()


def _poll_messages() -> list[dict]:
    messages: list[dict] = []
    with SessionLocal() as db:
        rows = db.execute(
            select(Camera, WorkerStatus).outerjoin(
                WorkerStatus, WorkerStatus.camera_id == Camera.id
            )
        ).all()
        for camera, status in rows:
            fps = getattr(status, "fps", None) or 0.0
            latency = getattr(status, "latency_p95_ms", None) or 0.0
            last_heartbeat = getattr(status, "last_heartbeat_at", None)
            state = getattr(status, "state", "idle") or "idle"
            camera_status = camera.status or "offline"
            if last_heartbeat is not None:
                last_heartbeat_aware = last_heartbeat
                if last_heartbeat_aware.tzinfo is None:
                    last_heartbeat_aware = last_heartbeat_aware.replace(tzinfo=timezone.utc)
                if (datetime.now(timezone.utc) - last_heartbeat_aware).total_seconds() > STALE_HEARTBEAT_SECONDS:
                    if camera_status == "online":
                        camera_status = "offline"
            payload = {
                "camera_id": str(camera.id),
                "name": camera.name,
                "status": camera_status,
                "last_seen_at": iso_utc(camera.last_seen_at),
                "fps": float(fps),
                "latency_ms": float(latency),
                "state": state,
            }
            signature = repr(payload)
            if manager._camera_cache.get(str(camera.id)) != signature:
                manager._camera_cache[str(camera.id)] = signature
                messages.append({"type": "camera.status", "payload": payload})

        if manager._event_watermark is None:
            manager._event_watermark = db.scalar(select(func.max(Event.created_at)))
            if manager._event_watermark is None:
                manager._event_watermark = datetime.now(timezone.utc)
        else:
            confidence = (
                select(Detection.event_id, func.max(Detection.confidence).label("confidence"))
                .group_by(Detection.event_id)
                .subquery()
            )
            new_events = db.execute(
                select(Event, Camera, confidence.c.confidence)
                .join(Camera, Camera.id == Event.camera_id)
                .outerjoin(confidence, confidence.c.event_id == Event.id)
                .where(Event.created_at > manager._event_watermark)
                .order_by(Event.created_at.asc())
                .limit(50)
            ).all()
            for event, camera, event_confidence in new_events:
                manager._event_watermark = max(manager._event_watermark, event.created_at)
                messages.append(
                    {
                        "type": "event.created",
                        "payload": {
                            "event_id": str(event.id),
                            "camera_id": str(camera.id),
                            "camera_name": camera.name,
                            "camera_location": camera.location,
                            "detected_at": iso_utc(event.detected_at),
                            "event_type": event.event_type,
                            "confidence": float(event_confidence or 0.0),
                            "review_status": event.review_status,
                            "snapshot_available": event.snapshot_status == "ok",
                        },
                    }
                )
    return messages


async def broadcaster_loop():
    while True:
        try:
            await asyncio.sleep(1)
            if not manager.connections:
                continue
            messages = await run_in_threadpool(_poll_messages)
            for message in messages:
                await manager.broadcast(message)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            log.warning("broadcaster error: %s", exc)


async def ws_endpoint(websocket: WebSocket):
    token = websocket.query_params.get("token")
    payload = decode_token(token)
    if payload is None:
        await websocket.close(code=4401)
        return
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)
