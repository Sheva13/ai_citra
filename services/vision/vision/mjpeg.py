import re
import threading
import time
from pathlib import Path

import cv2
import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, Response, UploadFile
from fastapi.responses import FileResponse, StreamingResponse

BOUNDARY = b"--frame"


class FrameHub:
    def __init__(self, jpeg_quality: int = 80):
        self._quality = jpeg_quality
        self._jpeg: bytes | None = None
        self._version = 0
        self._cond = threading.Condition(threading.Lock())

    def set_frame(self, frame) -> None:
        ok, buffer = cv2.imencode(
            ".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, self._quality]
        )
        if not ok:
            return
        with self._cond:
            self._jpeg = buffer.tobytes()
            self._version += 1
            self._cond.notify_all()

    def wait_frame(self, last_version: int, timeout: float = 5.0):
        with self._cond:
            if self._version == last_version:
                self._cond.wait(timeout)
            return self._version, self._jpeg


def create_app(hub: FrameHub, state: dict, detect_service=None) -> FastAPI:
    app = FastAPI()

    @app.get("/health")
    def health():
        return dict(state)

    @app.get("/frame.jpg")
    def frame_jpg():
        _, jpeg = hub.wait_frame(-1, timeout=5.0)
        if jpeg is None:
            return Response(status_code=503)
        return Response(content=jpeg, media_type="image/jpeg")

    @app.get("/stream")
    def stream():
        def generator():
            version = -1
            while True:
                new_version, jpeg = hub.wait_frame(version, timeout=5.0)
                if jpeg is None or new_version == version:
                    time.sleep(0.1)
                    continue
                version = new_version
                yield (
                    BOUNDARY
                    + b"\r\nContent-Type: image/jpeg\r\nContent-Length: "
                    + str(len(jpeg)).encode()
                    + b"\r\n\r\n"
                    + jpeg
                    + b"\r\n"
                )

        return StreamingResponse(
            generator(), media_type="multipart/x-mixed-replace; boundary=frame"
        )

    # Deteksi upload (gambar/video) — sync def agar jalan di threadpool,
    # tidak memblokir event loop server MJPEG.
    if detect_service is not None:

        @app.post("/detect/image")
        def detect_image(file: UploadFile = File(...)):
            content = file.file.read()
            if not content:
                raise HTTPException(400, "file kosong")
            try:
                return detect_service.detect_upload_image(content)
            except ValueError as exc:
                raise HTTPException(400, str(exc))
            except RuntimeError as exc:
                raise HTTPException(503, str(exc))

        @app.post("/detect/video")
        def detect_video(file: UploadFile = File(...), stride: int = Form(5)):
            content = file.file.read()
            if not content:
                raise HTTPException(400, "file kosong")
            suffix = Path(file.filename or "").suffix or ".mp4"
            try:
                return detect_service.detect_upload_video(content, suffix, stride)
            except ValueError as exc:
                raise HTTPException(400, str(exc))
            except RuntimeError as exc:
                raise HTTPException(503, str(exc))

        @app.get("/detect/video/{video_id}")
        def detect_video_result(video_id: str):
            if not re.fullmatch(r"[0-9a-f]{32}", video_id):
                raise HTTPException(404, "hasil tidak ditemukan")
            path = detect_service.cfg.storage_dir / "detections" / f"{video_id}.mp4"
            if not path.is_file():
                raise HTTPException(404, "hasil tidak ditemukan")
            return FileResponse(str(path), media_type="video/mp4")

    return app


def start_server(app: FastAPI, host: str, port: int):
    config = uvicorn.Config(app, host=host, port=port, log_level="warning")
    server = uvicorn.Server(config)
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    return server
