from dataclasses import dataclass
from pathlib import Path


@dataclass
class Detection:
    class_name: str
    confidence: float
    bbox: tuple[int, int, int, int]


class BaseDetector:
    model_loaded = False
    model_version = ""

    def load(self) -> bool:
        raise NotImplementedError

    def detect(self, frame) -> list[Detection]:
        raise NotImplementedError


class YoloDetector(BaseDetector):
    def __init__(self, model_path: Path, device: str, imgsz: int, conf: float, model_version: str):
        self.model_path = Path(model_path)
        self.device = device
        self.imgsz = imgsz
        self.conf = conf
        self.model_version = model_version
        self.model = None
        self.names: dict[int, str] = {}

    def load(self) -> bool:
        from ultralytics import YOLO

        if not self.model_path.exists():
            return False
        self.model = YOLO(str(self.model_path))
        self.names = {int(k): str(v) for k, v in self.model.names.items()}
        self.model_loaded = True
        return True

    def detect(self, frame) -> list[Detection]:
        if self.model is None:
            return []
        results = self.model.predict(
            frame, conf=self.conf, imgsz=self.imgsz, device=self.device, verbose=False
        )[0]
        detections = []
        for box in results.boxes:
            x1, y1, x2, y2 = (int(v) for v in box.xyxy[0].tolist())
            cls_id = int(box.cls[0])
            confidence = float(box.conf[0])
            name = self.names.get(cls_id, str(cls_id))
            detections.append(Detection(name, confidence, (x1, y1, x2, y2)))
        return detections


class FakeDetector(BaseDetector):
    def __init__(self):
        self.model_loaded = True
        self.model_version = "fake-detector"
        self.frame_count = 0
        self.period = 60

    def load(self) -> bool:
        self.model_loaded = True
        return True

    def detect(self, frame) -> list[Detection]:
        h, w = frame.shape[:2]
        i = self.frame_count % self.period
        self.frame_count += 1
        if i < 30:
            shift = 0.3 * (i / 30)
            bbox = (
                int(w * (0.15 + shift * 0.3)),
                int(h * 0.35),
                int(w * (0.25 + shift * 0.3)),
                int(h * 0.65),
            )
            return [Detection("no_helmet", 0.9, bbox)]
        bbox = (int(w * 0.6), int(h * 0.35), int(w * 0.7), int(h * 0.65))
        return [Detection("helmet", 0.85, bbox)]
