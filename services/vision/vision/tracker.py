from dataclasses import dataclass

from .detector import Detection
from .event_processor import iou


@dataclass
class Track:
    track_id: int
    class_name: str
    confidence: float
    bbox: tuple[int, int, int, int]
    misses: int = 0
    hits: int = 1


class IouTracker:
    def __init__(self, iou_min: float = 0.3, max_misses: int = 10):
        self.iou_min = iou_min
        self.max_misses = max_misses
        self._tracks: dict[int, Track] = {}
        self._next_id = 1

    def update(self, detections: list[Detection]) -> list[Track]:
        matched: set[int] = set()
        for track in self._tracks.values():
            best_index = None
            best_iou = self.iou_min
            for index, det in enumerate(detections):
                if index in matched or det.class_name != track.class_name:
                    continue
                value = iou(track.bbox, det.bbox)
                if value > best_iou:
                    best_iou = value
                    best_index = index
            if best_index is not None:
                det = detections[best_index]
                track.bbox = det.bbox
                track.confidence = det.confidence
                track.misses = 0
                track.hits += 1
                matched.add(best_index)
            else:
                track.misses += 1

        for track_id in [tid for tid, t in self._tracks.items() if t.misses > self.max_misses]:
            del self._tracks[track_id]

        for index, det in enumerate(detections):
            if index not in matched:
                self._tracks[self._next_id] = Track(
                    self._next_id, det.class_name, det.confidence, det.bbox
                )
                self._next_id += 1

        return [t for t in self._tracks.values() if t.misses == 0]
