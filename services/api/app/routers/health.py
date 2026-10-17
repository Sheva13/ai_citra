import os
import tempfile
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..models import Camera, WorkerStatus
from ..ws import STALE_HEARTBEAT_SECONDS, iso_utc

router = APIRouter(prefix="/api/health", tags=["health"])


def _check_database(db: Session) -> bool:
    try:
        db.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


def _check_storage() -> bool:
    try:
        storage = settings.storage_dir
        storage.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(dir=storage, prefix=".health", delete=True):
            pass
        return True
    except Exception:
        return False


@router.get("")
def health(db: Session = Depends(get_db)):
    database_ok = _check_database(db)
    storage_ok = _check_storage()
    workers = []
    model_loaded = False
    model_version = None
    if database_ok:
        rows = db.execute(
            select(Camera, WorkerStatus)
            .outerjoin(WorkerStatus, WorkerStatus.camera_id == Camera.id)
            .order_by(Camera.name)
        ).all()
        now = datetime.now(timezone.utc)
        for camera, status in rows:
            if status is None:
                continue
            last_heartbeat = status.last_heartbeat_at
            stale = True
            if last_heartbeat is not None:
                if last_heartbeat.tzinfo is None:
                    last_heartbeat = last_heartbeat.replace(tzinfo=timezone.utc)
                stale = (now - last_heartbeat).total_seconds() > STALE_HEARTBEAT_SECONDS
            workers.append(
                {
                    "camera_id": str(camera.id),
                    "camera_name": camera.name,
                    "state": status.state,
                    "fps": float(status.fps or 0.0),
                    "latency_p95_ms": float(status.latency_p95_ms or 0.0),
                    "model_loaded": bool(status.model_loaded),
                    "last_heartbeat_at": iso_utc(last_heartbeat),
                    "stale": stale,
                    "error_message": status.error_message,
                }
            )
            if status.model_loaded:
                model_loaded = True
                model_version = status.model_version or model_version
    status_value = "ok" if (database_ok and storage_ok) else "degraded"
    return {
        "status": status_value,
        "api": "ok",
        "database": "ok" if database_ok else "error",
        "storage": "ok" if storage_ok else "error",
        "workers": workers,
        "model": {"loaded": model_loaded, "version": model_version},
    }
