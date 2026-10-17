import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[3]


def _load_env():
    env_path = REPO_ROOT / ".env"
    if env_path.exists():
        load_dotenv(env_path, override=False)


def _resolve_path(value: str, default_relative: str) -> Path:
    raw = value.strip() if value else ""
    if not raw:
        raw = default_relative
    path = Path(raw)
    if path.is_absolute() and path.drive:
        return path
    if raw.startswith("/") and not os.path.exists(raw):
        raw = raw.lstrip("/")
        path = Path(raw)
    return (REPO_ROOT / path).resolve()


@dataclass
class Config:
    database_url: str
    camera_id: str
    storage_dir: Path
    vision_host: str
    vision_port: int
    detector: str
    model_path: Path
    model_version: str
    inference_device: str
    inference_imgsz: int
    detect_conf: float
    target_fps: float
    conf_min: float
    confirm_n: int
    confirm_m: int
    cooldown_seconds: float
    snapshot_retry_max: int
    reconnect_backoff_initial: float
    reconnect_backoff_max: float
    heartbeat_seconds: float
    enabled_poll_seconds: float
    jpeg_quality: int
    track_iou_min: float
    track_max_misses: int

    @classmethod
    def from_env(cls) -> "Config":
        _load_env()
        return cls(
            database_url=os.environ.get(
                "DATABASE_URL",
                "postgresql+psycopg://postgres:123@localhost:5432/helmet_monitoring",
            ),
            camera_id=os.environ.get("CAMERA_ID", "CAM-01"),
            storage_dir=_resolve_path(os.environ.get("STORAGE_DIR", ""), "storage"),
            vision_host=os.environ.get("VISION_HOST", "127.0.0.1"),
            vision_port=int(os.environ.get("VISION_PORT", "8100")),
            detector=os.environ.get("DETECTOR", "fake").strip().lower(),
            model_path=_resolve_path(os.environ.get("MODEL_PATH", ""), "ml/models/best.pt"),
            model_version=os.environ.get("MODEL_VERSION", "helmet-v0.1"),
            inference_device=os.environ.get("INFERENCE_DEVICE", "cpu"),
            inference_imgsz=int(os.environ.get("INFERENCE_IMGSZ", "640")),
            detect_conf=float(os.environ.get("DETECT_CONF", "0.25")),
            target_fps=float(os.environ.get("TARGET_FPS", "10")),
            conf_min=float(os.environ.get("CONF_MIN", "0.5")),
            confirm_n=int(os.environ.get("CONFIRM_N", "3")),
            confirm_m=int(os.environ.get("CONFIRM_M", "5")),
            cooldown_seconds=float(os.environ.get("COOLDOWN_SECONDS", "10")),
            snapshot_retry_max=int(os.environ.get("SNAPSHOT_RETRY_MAX", "3")),
            reconnect_backoff_initial=float(
                os.environ.get("RECONNECT_BACKOFF_INITIAL_SECONDS", "1")
            ),
            reconnect_backoff_max=float(os.environ.get("RECONNECT_BACKOFF_MAX_SECONDS", "30")),
            heartbeat_seconds=float(os.environ.get("HEARTBEAT_SECONDS", "2")),
            enabled_poll_seconds=float(os.environ.get("ENABLED_POLL_SECONDS", "5")),
            jpeg_quality=int(os.environ.get("JPEG_QUALITY", "80")),
            track_iou_min=float(os.environ.get("TRACK_IOU_MIN", "0.3")),
            track_max_misses=int(os.environ.get("TRACK_MAX_MISSES", "10")),
        )
