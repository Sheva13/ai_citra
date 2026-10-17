import os

import cv2

FFMPEG_TIMEOUT_US = 5_000_000


def configure_ffmpeg_timeout():
    options = os.environ.get("OPENCV_FFMPEG_CAPTURE_OPTIONS", "")
    if "rw_timeout" not in options:
        extra = f"rtsp_transport;tcp|rw_timeout;{FFMPEG_TIMEOUT_US}"
        os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = f"{options}|{extra}" if options else extra


class CameraSource:
    def connect(self) -> bool:
        raise NotImplementedError

    def read_frame(self):
        raise NotImplementedError

    def reconnect(self) -> bool:
        self.close()
        return self.connect()

    def close(self):
        raise NotImplementedError


class PhoneStreamSource(CameraSource):
    def __init__(self, url: str):
        self.url = url
        self.cap: cv2.VideoCapture | None = None

    def connect(self) -> bool:
        configure_ffmpeg_timeout()
        cap = cv2.VideoCapture(self.url, cv2.CAP_FFMPEG)
        cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 5000)
        cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, 5000)
        if not cap.isOpened():
            cap.release()
            self.cap = None
            return False
        self.cap = cap
        return True

    def read_frame(self):
        if self.cap is None:
            return None
        ok, frame = self.cap.read()
        return frame if ok else None

    def close(self):
        if self.cap is not None:
            self.cap.release()
            self.cap = None


class RtspSource(PhoneStreamSource):
    pass


class WebcamSource(CameraSource):
    def __init__(self, index: int = 0):
        self.index = index
        self.cap: cv2.VideoCapture | None = None

    def connect(self) -> bool:
        cap = cv2.VideoCapture(self.index, cv2.CAP_DSHOW)
        if not cap.isOpened():
            cap.release()
            cap = cv2.VideoCapture(self.index)
        if not cap.isOpened():
            cap.release()
            self.cap = None
            return False
        self.cap = cap
        return True

    def read_frame(self):
        if self.cap is None:
            return None
        ok, frame = self.cap.read()
        return frame if ok else None

    def close(self):
        if self.cap is not None:
            self.cap.release()
            self.cap = None


def resolve_stream_value(stream_config_ref: str | None) -> str | None:
    if not stream_config_ref:
        return None
    if stream_config_ref in os.environ:
        return os.environ[stream_config_ref]
    return stream_config_ref


def create_source(source_type: str, stream_config_ref: str | None) -> CameraSource | None:
    value = resolve_stream_value(stream_config_ref)
    if source_type == "webcam":
        index = 0
        if value:
            try:
                index = int(value)
            except ValueError:
                index = 0
        return WebcamSource(index)
    if source_type == "rtsp":
        return RtspSource(value) if value else None
    if value:
        return PhoneStreamSource(value)
    return None
