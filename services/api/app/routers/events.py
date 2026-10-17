import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_role
from ..config import settings
from ..db import get_db
from ..models import Camera, Detection, Event, EventReview, User
from ..ws import iso_utc

router = APIRouter(prefix="/api/events", tags=["events"])


class ReviewPatch(BaseModel):
    verdict: Literal["confirmed", "false_positive"]
    notes: str | None = Field(default=None, max_length=2000)


def _parse_uuid(value: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError:
        raise HTTPException(
            status_code=404,
            detail={"code": "EVENT_NOT_FOUND", "message": "Kejadian tidak ditemukan"},
        )


def _parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail={"code": "VALIDATION_ERROR", "message": f"Format tanggal tidak valid: {value}"},
        )
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def _confidence_map(db: Session, event_ids: list[uuid.UUID]) -> dict[uuid.UUID, float]:
    if not event_ids:
        return {}
    rows = db.execute(
        select(Detection.event_id, func.max(Detection.confidence))
        .where(Detection.event_id.in_(event_ids))
        .group_by(Detection.event_id)
    ).all()
    return {event_id: float(confidence) for event_id, confidence in rows}


def _event_item(event: Event, camera: Camera, confidence: float) -> dict:
    return {
        "event_id": str(event.id),
        "camera_id": str(camera.id),
        "camera_name": camera.name,
        "camera_location": camera.location,
        "detected_at": iso_utc(event.detected_at),
        "event_type": event.event_type,
        "confidence": confidence,
        "review_status": event.review_status,
        "snapshot_available": event.snapshot_status == "ok",
        "model_version": event.model_version,
    }


@router.get("")
def list_events(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    camera_id: str | None = None,
    status: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    conditions = []
    if camera_id:
        conditions.append(Event.camera_id == _parse_uuid(camera_id))
    if status:
        conditions.append(Event.review_status == status)
    parsed_from = _parse_datetime(date_from)
    parsed_to = _parse_datetime(date_to)
    if parsed_from is not None:
        conditions.append(Event.detected_at >= parsed_from)
    if parsed_to is not None:
        conditions.append(Event.detected_at <= parsed_to)

    total = db.scalar(select(func.count(Event.id)).where(*conditions)) or 0
    rows = db.execute(
        select(Event, Camera)
        .join(Camera, Camera.id == Event.camera_id)
        .where(*conditions)
        .order_by(Event.detected_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    confidences = _confidence_map(db, [event.id for event, _ in rows])
    items = [
        _event_item(event, camera, confidences.get(event.id, 0.0))
        for event, camera in rows
    ]
    return {"items": items, "page": page, "page_size": page_size, "total": total}


@router.get("/{event_id}")
def get_event(
    event_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)
):
    parsed = _parse_uuid(event_id)
    row = db.execute(
        select(Event, Camera)
        .join(Camera, Camera.id == Event.camera_id)
        .where(Event.id == parsed)
    ).first()
    if row is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "EVENT_NOT_FOUND", "message": "Kejadian tidak ditemukan"},
        )
    event, camera = row
    detections = db.scalars(
        select(Detection).where(Detection.event_id == event.id).order_by(Detection.confidence.desc())
    ).all()
    reviews = db.execute(
        select(EventReview, User.email)
        .join(User, User.id == EventReview.reviewed_by)
        .where(EventReview.event_id == event.id)
        .order_by(EventReview.reviewed_at.desc())
    ).all()
    return {
        "event_id": str(event.id),
        "camera": {
            "id": str(camera.id),
            "name": camera.name,
            "location": camera.location,
        },
        "detected_at": iso_utc(event.detected_at),
        "event_type": event.event_type,
        "model_version": event.model_version,
        "snapshot_status": event.snapshot_status,
        "review_status": event.review_status,
        "detections": [
            {
                "id": str(detection.id),
                "class_name": detection.class_name,
                "confidence": float(detection.confidence),
                "bbox": detection.bbox,
                "track_id": detection.track_id,
            }
            for detection in detections
        ],
        "reviews": [
            {
                "id": str(review.id),
                "verdict": review.verdict,
                "notes": review.notes,
                "reviewed_by": email,
                "reviewed_at": iso_utc(review.reviewed_at),
            }
            for review, email in reviews
        ],
    }


@router.get("/{event_id}/snapshot")
def get_snapshot(
    event_id: str,
    type: Literal["original", "annotated"] = "annotated",
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    parsed = _parse_uuid(event_id)
    event = db.get(Event, parsed)
    if event is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "EVENT_NOT_FOUND", "message": "Kejadian tidak ditemukan"},
        )
    raw_path = (
        event.snapshot_original_path if type == "original" else event.snapshot_annotated_path
    )
    if not raw_path:
        raise HTTPException(
            status_code=404,
            detail={"code": "SNAPSHOT_NOT_FOUND", "message": "Snapshot tidak tersedia"},
        )
    storage_root = settings.storage_dir.resolve()
    file_path = (storage_root / raw_path).resolve()
    if not file_path.is_relative_to(storage_root) or not file_path.exists():
        raise HTTPException(
            status_code=404,
            detail={"code": "SNAPSHOT_NOT_FOUND", "message": "Snapshot tidak tersedia"},
        )
    return FileResponse(str(file_path), media_type="image/jpeg")


@router.patch("/{event_id}/review")
def review_event(
    event_id: str,
    body: ReviewPatch,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("admin", "operator")),
):
    parsed = _parse_uuid(event_id)
    event = db.get(Event, parsed)
    if event is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "EVENT_NOT_FOUND", "message": "Kejadian tidak ditemukan"},
        )
    review = EventReview(
        event_id=event.id,
        reviewed_by=user.id,
        verdict=body.verdict,
        notes=body.notes,
        reviewed_at=datetime.now(timezone.utc),
    )
    db.add(review)
    event.review_status = body.verdict
    db.commit()
    db.refresh(review)
    return {
        "event_id": str(event.id),
        "review_status": event.review_status,
        "review": {
            "id": str(review.id),
            "verdict": review.verdict,
            "notes": review.notes,
            "reviewed_by": user.email,
            "reviewed_at": iso_utc(review.reviewed_at),
        },
    }
