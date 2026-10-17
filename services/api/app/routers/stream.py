import uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..config import settings
from ..db import get_db
from ..models import Camera

router = APIRouter(prefix="/api/stream", tags=["stream"])


def _worker_unavailable() -> HTTPException:
    return HTTPException(
        status_code=503,
        detail={
            "code": "WORKER_OFFLINE",
            "message": "Worker video sedang tidak tersedia",
        },
    )


@router.get("/{camera_id}")
async def stream_camera(
    camera_id: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    try:
        parsed = uuid.UUID(camera_id)
    except ValueError:
        raise HTTPException(
            status_code=404,
            detail={"code": "CAMERA_NOT_FOUND", "message": "Kamera tidak ditemukan"},
        )
    if db.get(Camera, parsed) is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "CAMERA_NOT_FOUND", "message": "Kamera tidak ditemukan"},
        )

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(3.0)) as client:
            response = await client.get(f"{settings.vision_base_url}/health")
            if response.status_code != 200:
                raise _worker_unavailable()
    except httpx.HTTPError:
        raise _worker_unavailable()

    async def generator():
        client = httpx.AsyncClient(
            timeout=httpx.Timeout(connect=5.0, read=None, write=5.0, pool=5.0)
        )
        try:
            async with client.stream(
                "GET", f"{settings.vision_base_url}/stream"
            ) as response:
                if response.status_code != 200:
                    return
                async for chunk in response.aiter_raw():
                    yield chunk
        except httpx.HTTPError:
            return
        finally:
            await client.aclose()

    return StreamingResponse(
        generator(), media_type="multipart/x-mixed-replace; boundary=frame"
    )
