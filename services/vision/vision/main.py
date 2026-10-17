import base64
import logging
import math
import tempfile
import threading
import time
import uuid
from collections import deque
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert

from . import annotate
from .camera_source import create_source
from .config import Config
from .db import Camera, Detection, Event, WorkerStatus, create_engine_and_session, utcnow
from .detector import FakeDetector, YoloDetector
from .event_processor import EventProcessor, EventRequest, Observation
from .mjpeg import FrameHub, create_app, start_server
from .tracker import IouTracker

log = logging.getLogger("vision")

DB_WRITE_RETRIES = 3
UPLOAD_MAX_PROCESSED_FRAMES = 600
UPLOAD_TIMELINE_MAX = 500


class Worker:
    def __init__(self, cfg: Config):
        self.cfg = cfg
        self.engine, self.session_factory = create_engine_and_session(cfg.database_url)
        self.hub = FrameHub(cfg.jpeg_quality)
        self.state = {
            "camera_id": cfg.camera_id,
            "state": "idle",
            "fps": 0.0,
            "latency_p95_ms": 0.0,
            "model_loaded": False,
            "model_version": cfg.model_version,
            "error_message": None,
        }
        self.latencies: deque[float] = deque(maxlen=100)
        self.fps_ema = 0.0
        self._prev_infer_ts: float | None = None
        self.detector = None
        self.infer_lock = threading.Lock()
        self.processor = EventProcessor(
            conf_min=cfg.conf_min,
            confirm_n=cfg.confirm_n,
            confirm_m=cfg.confirm_m,
            cooldown_seconds=cfg.cooldown_seconds,
        )
        self.tracker = IouTracker(iou_min=cfg.track_iou_min, max_misses=cfg.track_max_misses)
        self.camera_uuid = None
        self.camera_row = None
        self.source = None
        self.enabled = True
        self.last_seen: datetime | None = None
        self.last_heartbeat = 0.0
        self.last_enabled_poll = 0.0
        self.model_retry_at = 0.0

    def set_state(self, value: str) -> None:
        self.state["state"] = value

    def p95(self) -> float:
        if not self.latencies:
            return 0.0
        values = sorted(self.latencies)
        index = max(0, int(round(0.95 * (len(values) - 1))))
        return round(values[index], 1)

    def load_camera(self):
        try:
            with self.session_factory() as session:
                camera = session.scalar(select(Camera).where(Camera.name == self.cfg.camera_id))
                if camera is None:
                    return None
                self.camera_uuid = camera.id
                self.camera_row = camera
                last_event = session.scalar(
                    select(Event)
                    .where(Event.camera_id == camera.id)
                    .order_by(Event.detected_at.desc())
                    .limit(1)
                )
                if last_event is not None:
                    detection = session.scalar(
                        select(Detection).where(Detection.event_id == last_event.id).limit(1)
                    )
                    if detection is not None and detection.bbox:
                        box = detection.bbox
                        self.processor.seed_last_event(
                            last_event.detected_at,
                            (box.get("x1"), box.get("y1"), box.get("x2"), box.get("y2")),
                        )
                return camera
        except Exception as exc:
            log.warning("gagal membaca kamera dari DB: %s", exc)
            return None

    def poll_enabled(self) -> bool:
        if self.camera_uuid is None:
            return True
        try:
            with self.session_factory() as session:
                value = session.scalar(
                    select(Camera.enabled).where(Camera.id == self.camera_uuid)
                )
            return True if value is None else bool(value)
        except Exception as exc:
            log.warning("gagal membaca flag enabled: %s", exc)
            return True

    def push_heartbeat(self, camera_status: str | None = None) -> None:
        if self.camera_uuid is None:
            return
        values = {
            "camera_id": self.camera_uuid,
            "state": self.state["state"],
            "fps": float(self.fps_ema),
            "latency_p95_ms": self.p95(),
            "model_loaded": bool(self.state["model_loaded"]),
            "model_version": self.state["model_version"],
            "error_message": self.state["error_message"],
            "last_heartbeat_at": utcnow(),
        }
        self.state["fps"] = values["fps"]
        self.state["latency_p95_ms"] = values["latency_p95_ms"]
        try:
            with self.session_factory() as session:
                statement = pg_insert(WorkerStatus).values(**values)
                statement = statement.on_conflict_do_update(
                    index_elements=["camera_id"],
                    set_={k: v for k, v in values.items() if k != "camera_id"},
                )
                session.execute(statement)
                camera_values = {}
                if camera_status is not None:
                    camera_values["status"] = camera_status
                if self.last_seen is not None:
                    camera_values["last_seen_at"] = self.last_seen
                if camera_values:
                    session.execute(
                        update(Camera)
                        .where(Camera.id == self.camera_uuid)
                        .values(**camera_values)
                    )
                session.commit()
        except Exception as exc:
            log.warning("heartbeat gagal ditulis: %s", exc)

    def load_detector(self) -> None:
        cfg = self.cfg
        detector = None
        error = None
        try:
            if cfg.detector == "yolo":
                detector = YoloDetector(
                    cfg.model_path,
                    cfg.inference_device,
                    cfg.inference_imgsz,
                    cfg.detect_conf,
                    cfg.model_version,
                )
            else:
                detector = FakeDetector()
            if not detector.load():
                error = f"model gagal dimuat dari {cfg.model_path}"
                detector = None
        except Exception as exc:
            error = f"model gagal dimuat: {exc}"
            detector = None
        if detector is not None:
            self.detector = detector
            self.state["model_loaded"] = True
            self.state["model_version"] = detector.model_version
            self.state["error_message"] = None
            log.info("detector siap: %s (%s)", detector.model_version, cfg.detector)
        else:
            self.state["model_loaded"] = False
            self.state["error_message"] = error
            self.model_retry_at = time.time() + 30
            log.error("%s (dicoba lagi 30 dtk)", error)

    def update_fps(self, now_ts: float) -> None:
        if self._prev_infer_ts is not None:
            instant = 1.0 / max(now_ts - self._prev_infer_ts, 1e-6)
            self.fps_ema = instant if self.fps_ema == 0 else 0.2 * instant + 0.8 * self.fps_ema
        self._prev_infer_ts = now_ts

    def save_event(
        self, request: EventRequest, frame, annotated_frame
    ) -> tuple[str, str | None]:
        cfg = self.cfg
        day = request.detected_at
        relative_dir = Path("snapshots") / f"{day:%Y}" / f"{day:%m}" / f"{day:%d}" / request.event_id
        absolute_dir = cfg.storage_dir / relative_dir
        origin_path = relative_dir / "original.jpg"
        annotated_path = relative_dir / "annotated.jpg"

        snapshot_ok = False
        last_error = None
        for _ in range(max(1, cfg.snapshot_retry_max)):
            try:
                absolute_dir.mkdir(parents=True, exist_ok=True)
                if not cv2.imwrite(str(cfg.storage_dir / origin_path), frame):
                    raise RuntimeError("imwrite original gagal")
                if not cv2.imwrite(str(cfg.storage_dir / annotated_path), annotated_frame):
                    raise RuntimeError("imwrite annotated gagal")
                snapshot_ok = True
                break
            except Exception as exc:
                last_error = f"snapshot gagal: {exc}"
                time.sleep(0.3)

        snapshot_status = "ok" if snapshot_ok else "failed"
        event_values = {
            "id": request.event_id,
            "camera_id": self.camera_uuid,
            "detected_at": request.detected_at,
            "event_type": request.class_name,
            "review_status": "pending",
            "snapshot_original_path": str(origin_path) if snapshot_ok else None,
            "snapshot_annotated_path": str(annotated_path) if snapshot_ok else None,
            "snapshot_status": snapshot_status,
            "model_version": self.state["model_version"],
        }
        bbox = {
            "x1": request.bbox[0],
            "y1": request.bbox[1],
            "x2": request.bbox[2],
            "y2": request.bbox[3],
        }
        db_ok = False
        for _ in range(DB_WRITE_RETRIES):
            try:
                with self.session_factory() as session:
                    session.add(Event(**event_values))
                    session.flush()
                    session.add(
                        Detection(
                            event_id=request.event_id,
                            class_name=request.class_name,
                            confidence=request.confidence,
                            bbox=bbox,
                            track_id=str(request.track_id),
                        )
                    )
                    session.commit()
                db_ok = True
                break
            except Exception as exc:
                last_error = f"gagal menulis event ke DB: {exc}"
                time.sleep(0.5)

        if not db_ok:
            return "failed", last_error
        if not snapshot_ok:
            return "failed", last_error
        return "ok", None

    def process_frame(self, frame, now_ts: float) -> None:
        start = time.perf_counter()
        with self.infer_lock:
            detections = self.detector.detect(frame)
        latency_ms = (time.perf_counter() - start) * 1000
        self.latencies.append(latency_ms)
        self.update_fps(now_ts)

        tracks = self.tracker.update(detections)
        annotated_frame = annotate.draw_tracks(frame, tracks)
        self.hub.set_frame(annotated_frame)

        observations = [
            Observation(t.track_id, t.class_name, t.confidence, t.bbox) for t in tracks
        ]
        events = self.processor.update(observations, utcnow())
        for request in events:
            status, error = self.save_event(request, frame, annotated_frame)
            log.info(
                "event %s status=%s conf=%.2f track=%s",
                request.event_id,
                status,
                request.confidence,
                request.track_id,
            )
            self.state["error_message"] = error

    def detect_upload_image(self, content: bytes) -> dict:
        if self.detector is None:
            raise RuntimeError("model belum dimuat di worker")
        frame = cv2.imdecode(np.frombuffer(content, dtype=np.uint8), cv2.IMREAD_COLOR)
        if frame is None:
            raise ValueError("gambar tidak terbaca")
        start = time.perf_counter()
        with self.infer_lock:
            detections = self.detector.detect(frame)
        duration_ms = (time.perf_counter() - start) * 1000
        annotated = annotate.draw_tracks(frame, detections)
        ok, jpeg = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 85])
        if not ok:
            raise RuntimeError("gagal meng-encode hasil anotasi")
        height, width = frame.shape[:2]
        no_helmet = [d for d in detections if d.class_name == "no_helmet"]
        helmet = [d for d in detections if d.class_name == "helmet"]
        return {
            "model_version": self.state["model_version"],
            "duration_ms": round(duration_ms, 1),
            "width": width,
            "height": height,
            "no_helmet_count": len(no_helmet),
            "helmet_count": len(helmet),
            "detections": [
                {
                    "class_name": d.class_name,
                    "confidence": round(d.confidence, 3),
                    "bbox": {"x1": d.bbox[0], "y1": d.bbox[1], "x2": d.bbox[2], "y2": d.bbox[3]},
                }
                for d in detections
            ],
            "media_type": "image/jpeg",
            "image_base64": base64.b64encode(jpeg.tobytes()).decode("ascii"),
        }

    def detect_upload_video(self, content: bytes, suffix: str, stride: int = 5) -> dict:
        if self.detector is None:
            raise RuntimeError("model belum dimuat di worker")
        tmp_path: Path | None = None
        writer: cv2.VideoWriter | None = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                tmp.write(content)
                tmp_path = Path(tmp.name)

            cap = cv2.VideoCapture(str(tmp_path))
            if not cap.isOpened():
                raise ValueError("video tidak terbaca")

            total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
            fps_src = float(cap.get(cv2.CAP_PROP_FPS) or 0.0)
            if not (1.0 <= fps_src <= 240.0):
                fps_src = 10.0

            effective_stride = max(1, min(int(stride), 120))
            if total > 0:
                effective_stride = max(
                    effective_stride, math.ceil(total / UPLOAD_MAX_PROCESSED_FRAMES)
                )
            out_fps = fps_src / effective_stride

            video_id = uuid.uuid4().hex
            out_dir = self.cfg.storage_dir / "detections"
            out_dir.mkdir(parents=True, exist_ok=True)
            out_path = out_dir / f"{video_id}.mp4"

            frame_idx = 0
            processed = 0
            no_helmet_frames = 0
            helmet_frames = 0
            peak: dict | None = None
            timeline: list[dict] = []
            start = time.perf_counter()

            while True:
                ok, frame = cap.read()
                if not ok:
                    break
                if frame_idx % effective_stride != 0:
                    frame_idx += 1
                    continue
                time_sec = frame_idx / fps_src
                with self.infer_lock:
                    detections = self.detector.detect(frame)
                no_helmet = [d for d in detections if d.class_name == "no_helmet"]
                helmet = [d for d in detections if d.class_name == "helmet"]
                if no_helmet:
                    no_helmet_frames += 1
                if helmet:
                    helmet_frames += 1
                top = max(detections, key=lambda d: d.confidence) if detections else None
                if (
                    top is not None
                    and top.class_name == "no_helmet"
                    and (peak is None or top.confidence > peak["confidence"])
                ):
                    peak = {"confidence": round(top.confidence, 3), "time_sec": round(time_sec, 2)}
                if detections and len(timeline) < UPLOAD_TIMELINE_MAX:
                    timeline.append(
                        {
                            "time_sec": round(time_sec, 2),
                            "no_helmet": len(no_helmet),
                            "helmet": len(helmet),
                            "top_class": top.class_name if top else "",
                            "top_confidence": round(top.confidence, 3) if top else 0.0,
                        }
                    )
                annotated = annotate.draw_tracks(frame, detections)
                if writer is None:
                    height, width = annotated.shape[:2]
                    writer = cv2.VideoWriter(
                        str(out_path),
                        cv2.VideoWriter_fourcc(*"mp4v"),
                        out_fps if out_fps > 0 else 5.0,
                        (width, height),
                    )
                writer.write(annotated)
                processed += 1
                frame_idx += 1

            cap.release()
            duration_ms = (time.perf_counter() - start) * 1000

            if processed == 0 or not out_path.is_file():
                raise ValueError("video tidak memiliki frame yang bisa diproses")

            return {
                "video_id": video_id,
                "model_version": self.state["model_version"],
                "duration_ms": round(duration_ms, 1),
                "video_duration_sec": round(total / fps_src, 2) if total > 0 else None,
                "fps": round(fps_src, 2),
                "frames_total": total or None,
                "frames_processed": processed,
                "stride": effective_stride,
                "frames_with_no_helmet": no_helmet_frames,
                "frames_with_helmet": helmet_frames,
                "peak_no_helmet": peak,
                "timeline": timeline,
            }
        finally:
            if writer is not None:
                writer.release()
            if tmp_path is not None:
                tmp_path.unlink(missing_ok=True)

    def run(self) -> None:
        cfg = self.cfg
        log.info(
            "worker mulai: camera=%s detector=%s target_fps=%s",
            cfg.camera_id,
            cfg.detector,
            cfg.target_fps,
        )
        app = create_app(self.hub, self.state, detect_service=self)
        start_server(app, cfg.vision_host, cfg.vision_port)

        infer_interval = 1.0 / max(cfg.target_fps, 0.1)
        last_infer = 0.0
        failures = 0
        backoff = cfg.reconnect_backoff_initial

        while True:
            try:
                if self.camera_uuid is None:
                    if self.load_camera() is None:
                        self.set_state("error")
                        self.state["error_message"] = (
                            f"kamera {cfg.camera_id} belum terdaftar di DB"
                        )
                        time.sleep(5)
                        continue
                    self.state["error_message"] = None

                now = time.time()
                if now - self.last_enabled_poll >= cfg.enabled_poll_seconds:
                    self.last_enabled_poll = now
                    self.enabled = self.poll_enabled()

                if not self.enabled:
                    if self.source is not None:
                        self.source.close()
                        self.source = None
                    self.set_state("stopped")
                    self.push_heartbeat()
                    time.sleep(1)
                    continue

                if self.detector is None and time.time() >= self.model_retry_at:
                    self.load_detector()
                if self.detector is None:
                    self.push_heartbeat()
                    time.sleep(2)
                    continue

                if self.source is None:
                    camera = self.camera_row
                    self.source = create_source(camera.source_type, camera.stream_config_ref)
                    if self.source is None:
                        self.set_state("error")
                        self.state["error_message"] = (
                            f"stream_config_ref kamera {camera.name} belum diatur"
                        )
                        self.push_heartbeat()
                        time.sleep(10)
                        continue
                    if self.source.connect():
                        failures = 0
                        backoff = cfg.reconnect_backoff_initial
                        log.info("kamera terhubung (%s)", camera.source_type)
                    else:
                        self.source = None
                        failures += 1
                        status = "reconnecting" if failures < 3 else "offline"
                        self.set_state(status)
                        self.push_heartbeat(camera_status=status)
                        time.sleep(backoff)
                        backoff = min(backoff * 2, cfg.reconnect_backoff_max)
                        continue

                frame = self.source.read_frame()
                if frame is None:
                    self.source.close()
                    self.source = None
                    failures += 1
                    status = "reconnecting" if failures < 3 else "offline"
                    self.set_state(status)
                    self.push_heartbeat(camera_status=status)
                    time.sleep(backoff)
                    backoff = min(backoff * 2, cfg.reconnect_backoff_max)
                    continue

                self.last_seen = utcnow()
                failures = 0
                backoff = cfg.reconnect_backoff_initial
                self.set_state("running")

                now = time.time()
                if now - last_infer >= infer_interval:
                    last_infer = now
                    self.process_frame(frame, now)

                if now - self.last_heartbeat >= cfg.heartbeat_seconds:
                    self.last_heartbeat = now
                    self.push_heartbeat(camera_status="online")
            except KeyboardInterrupt:
                raise
            except Exception as exc:
                log.exception("error di loop worker: %s", exc)
                self.state["error_message"] = f"worker error: {exc}"
                time.sleep(1)

    def shutdown(self) -> None:
        if self.source is not None:
            self.source.close()
            self.source = None
        self.set_state("stopped")
        self.push_heartbeat()


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    cfg = Config.from_env()
    worker = Worker(cfg)
    try:
        worker.run()
    except KeyboardInterrupt:
        log.info("worker dihentikan")
    finally:
        worker.shutdown()


if __name__ == "__main__":
    main()
