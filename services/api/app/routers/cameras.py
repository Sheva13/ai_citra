import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_role
from ..db import get_db
from ..models import Camera, WorkerStatus

router = APIRouter(prefix="/api/cameras", tags=["cameras"])


class CameraCreate(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    location: str = Field(min_length=1, max_length=255)
    source_type: str = Field(pattern="^(phone|rtsp|webcam)$")
    stream_config_ref: str = Field(min_length=1, max_length=128)


def _camera_payload(camera: Camera, status: WorkerStatus | None) -> dict:
    return {
        "id": str(camera.id),
        "name": camera.name,
        "location": camera.location,
        "source_type": camera.source_type,
        "status": camera.status,
        "enabled": camera.enabled,
        "last_seen_at": camera.last_seen_at.isoformat() if camera.last_seen_at else None,
        "fps": float(status.fps) if status else 0.0,
        "latency_p95_ms": float(status.latency_p95_ms) if status else 0.0,
        "worker_state": status.state if status else "idle",
        "model_loaded": bool(status.model_loaded) if status else False,
        "model_version": status.model_version if status else None,
        "error_message": status.error_message if status else None,
    }


def _get_camera_or_404(db: Session, camera_id: str) -> Camera:
    try:
        parsed = uuid.UUID(camera_id)
    except ValueError:
        raise HTTPException(
            status_code=404,
            detail={"code": "CAMERA_NOT_FOUND", "message": "Kamera tidak ditemukan"},
        )
    camera = db.get(Camera, parsed)
    if camera is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "CAMERA_NOT_FOUND", "message": "Kamera tidak ditemukan"},
        )
    return camera


@router.get("")
def list_cameras(
    db: Session = Depends(get_db), user=Depends(get_current_user)
):
    rows = db.execute(
        select(Camera, WorkerStatus)
        .outerjoin(WorkerStatus, WorkerStatus.camera_id == Camera.id)
        .order_by(Camera.name)
    ).all()
    return {"items": [_camera_payload(camera, status) for camera, status in rows]}


@router.get("/{camera_id}")
def get_camera(
    camera_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)
):
    camera = _get_camera_or_404(db, camera_id)
    status = db.get(WorkerStatus, camera.id)
    return _camera_payload(camera, status)


@router.post("", status_code=201)
def create_camera(
    body: CameraCreate,
    db: Session = Depends(get_db),
    user=Depends(require_role("admin")),
):
    existing = db.scalar(select(Camera).where(Camera.name == body.name))
    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail={"code": "CAMERA_ALREADY_EXISTS", "message": f"Kamera {body.name} sudah terdaftar"},
        )
    camera = Camera(
        name=body.name,
        location=body.location,
        source_type=body.source_type,
        stream_config_ref=body.stream_config_ref,
    )
    db.add(camera)
    db.commit()
    db.refresh(camera)
    return _camera_payload(camera, None)


@router.post("/{camera_id}/start")
def start_camera(
    camera_id: str,
    db: Session = Depends(get_db),
    user=Depends(require_role("admin")),
):
    camera = _get_camera_or_404(db, camera_id)
    camera.enabled = True
    db.commit()
    return {"id": str(camera.id), "enabled": camera.enabled}


@router.post("/{camera_id}/stop")
def stop_camera(
    camera_id: str,
    db: Session = Depends(get_db),
    user=Depends(require_role("admin")),
):
    camera = _get_camera_or_404(db, camera_id)
    camera.enabled = False
    db.commit()
    return {"id": str(camera.id), "enabled": camera.enabled}
