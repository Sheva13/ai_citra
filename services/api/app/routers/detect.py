import re

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from ..auth import get_current_user
from ..config import settings

router = APIRouter(prefix="/api/detect", tags=["detect"])

MAX_IMAGE_BYTES = 10 * 1024 * 1024
MAX_VIDEO_BYTES = 150 * 1024 * 1024

IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/bmp", "image/tiff"}
VIDEO_TYPES = {
    "video/mp4",
    "video/quicktime",
    "video/x-msvideo",
    "video/webm",
    "video/x-matroska",
    "video/mpeg",
}
VIDEO_SUFFIXES = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v", ".mpeg", ".mpg"}


def _worker_unavailable(message: str = "Worker video sedang tidak tersedia") -> HTTPException:
    return HTTPException(
        status_code=503,
        detail={"code": "WORKER_OFFLINE", "message": message},
    )


async def _forward(path: str, filename: str, content: bytes, content_type: str, data: dict, timeout: httpx.Timeout) -> dict:
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                f"{settings.vision_base_url}{path}",
                files={"file": (filename, content, content_type)},
                data=data,
            )
    except httpx.HTTPError:
        raise _worker_unavailable()

    if response.status_code >= 500:
        raise _worker_unavailable("Worker gagal memproses media")
    if response.status_code >= 400:
        try:
            detail = response.json().get("detail")
        except Exception:
            detail = None
        raise HTTPException(
            status_code=400,
            detail={
                "code": "MEDIA_INVALID",
                "message": str(detail) if detail else "Media tidak dapat diproses",
            },
        )
    return response.json()


@router.post("/image")
async def detect_image(
    file: UploadFile = File(...),
    user=Depends(get_current_user),
):
    content = await file.read()
    if not content:
        raise HTTPException(
            status_code=400,
            detail={"code": "MEDIA_EMPTY", "message": "File kosong"},
        )
    if len(content) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=413,
            detail={"code": "PAYLOAD_TOO_LARGE", "message": "Ukuran gambar maksimal 10 MB"},
        )
    if (file.content_type or "") not in IMAGE_TYPES:
        raise HTTPException(
            status_code=415,
            detail={"code": "UNSUPPORTED_MEDIA_TYPE", "message": "Format gambar tidak didukung"},
        )
    return await _forward(
        "/detect/image",
        file.filename or "upload.jpg",
        content,
        file.content_type or "image/jpeg",
        {},
        httpx.Timeout(60.0),
    )


@router.post("/video")
async def detect_video(
    file: UploadFile = File(...),
    stride: int = Form(5),
    user=Depends(get_current_user),
):
    content = await file.read()
    if not content:
        raise HTTPException(
            status_code=400,
            detail={"code": "MEDIA_EMPTY", "message": "File kosong"},
        )
    if len(content) > MAX_VIDEO_BYTES:
        raise HTTPException(
            status_code=413,
            detail={"code": "PAYLOAD_TOO_LARGE", "message": "Ukuran video maksimal 150 MB"},
        )
    suffix = ""
    if file.filename and "." in file.filename:
        suffix = "." + file.filename.rsplit(".", 1)[-1].lower()
    if (file.content_type or "") not in VIDEO_TYPES and suffix not in VIDEO_SUFFIXES:
        raise HTTPException(
            status_code=415,
            detail={"code": "UNSUPPORTED_MEDIA_TYPE", "message": "Format video tidak didukung"},
        )
    return await _forward(
        "/detect/video",
        file.filename or "upload.mp4",
        content,
        file.content_type or "video/mp4",
        {"stride": str(max(1, min(stride, 120)))},
        httpx.Timeout(connect=5.0, read=None, write=30.0, pool=30.0),
    )


@router.get("/video/{video_id}")
def detect_video_result(video_id: str, user=Depends(get_current_user)):
    if not re.fullmatch(r"[0-9a-f]{32}", video_id):
        raise HTTPException(
            status_code=404,
            detail={"code": "DETECTION_RESULT_NOT_FOUND", "message": "Hasil deteksi tidak ditemukan"},
        )
    path = settings.storage_dir / "detections" / f"{video_id}.mp4"
    if not path.is_file():
        raise HTTPException(
            status_code=404,
            detail={"code": "DETECTION_RESULT_NOT_FOUND", "message": "Hasil deteksi tidak ditemukan"},
        )
    return FileResponse(str(path), media_type="video/mp4")
