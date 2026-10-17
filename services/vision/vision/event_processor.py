import uuid
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timedelta


def iou(a: tuple[int, int, int, int], b: tuple[int, int, int, int]) -> float:
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    iw, ih = max(0, ix2 - ix1), max(0, iy2 - iy1)
    inter = iw * ih
    if inter == 0:
        return 0.0
    area_a = max(0, ax2 - ax1) * max(0, ay2 - ay1)
    area_b = max(0, bx2 - bx1) * max(0, by2 - by1)
    union = area_a + area_b - inter
    return inter / union if union else 0.0


@dataclass
class Observation:
    track_id: int
    class_name: str
    confidence: float
    bbox: tuple[int, int, int, int]


@dataclass
class EventRequest:
    event_id: str
    track_id: int
    class_name: str
    confidence: float
    bbox: tuple[int, int, int, int]
    detected_at: datetime


@dataclass
class _TrackState:
    state: str = "IDLE"
    window: deque = field(default_factory=deque)
    cooldown_until: datetime | None = None
    last_seen_index: int = 0
    best_confidence: float = 0.0
    best_bbox: tuple[int, int, int, int] | None = None


class EventProcessor:
    def __init__(
        self,
        conf_min: float = 0.5,
        confirm_n: int = 3,
        confirm_m: int = 5,
        cooldown_seconds: float = 10.0,
        dedup_iou: float = 0.3,
        event_type: str = "no_helmet",
    ):
        self.conf_min = conf_min
        self.confirm_n = confirm_n
        self.confirm_m = confirm_m
        self.cooldown_seconds = cooldown_seconds
        self.dedup_iou = dedup_iou
        self.event_type = event_type
        self._states: dict[int, _TrackState] = {}
        self._last_event_time: datetime | None = None
        self._last_event_bbox: tuple[int, int, int, int] | None = None
        self._index = 0

    def seed_last_event(self, detected_at: datetime | None, bbox) -> None:
        if detected_at is None or bbox is None:
            return
        if self._last_event_time is None or detected_at > self._last_event_time:
            self._last_event_time = detected_at
            self._last_event_bbox = tuple(int(v) for v in bbox)

    def update(self, observations: list[Observation], now: datetime) -> list[EventRequest]:
        self._index += 1
        events: list[EventRequest] = []
        by_track = {o.track_id: o for o in observations}

        for state in self._states.values():
            if state.state == "COOLDOWN" and state.cooldown_until and now >= state.cooldown_until:
                state.state = "IDLE"
                state.window.clear()
                state.best_confidence = 0.0
                state.best_bbox = None

        for track_id, obs in by_track.items():
            state = self._states.setdefault(track_id, _TrackState())
            state.last_seen_index = self._index
            if state.state == "COOLDOWN":
                continue
            is_nohelmet = obs.class_name == self.event_type and obs.confidence >= self.conf_min
            state.window.append(is_nohelmet)
            while len(state.window) > self.confirm_m:
                state.window.popleft()
            if is_nohelmet and obs.confidence >= state.best_confidence:
                state.best_confidence = obs.confidence
                state.best_bbox = obs.bbox
            if is_nohelmet and state.state == "IDLE":
                state.state = "CANDIDATE"
            if state.state == "CANDIDATE":
                hits = sum(1 for v in state.window if v)
                if hits >= self.confirm_n:
                    event = self._confirm(state, obs.track_id, now)
                    if event:
                        events.append(event)
                elif len(state.window) == self.confirm_m and hits == 0:
                    state.state = "IDLE"

        for track_id, state in list(self._states.items()):
            if track_id in by_track:
                continue
            if state.state != "COOLDOWN":
                state.window.append(False)
                while len(state.window) > self.confirm_m:
                    state.window.popleft()
                hits = sum(1 for v in state.window if v)
                if state.state == "CANDIDATE" and len(state.window) >= self.confirm_m and hits == 0:
                    state.state = "IDLE"
            if self._index - state.last_seen_index > self.confirm_m * 2:
                del self._states[track_id]

        return events

    def _confirm(
        self, state: _TrackState, track_id: int, now: datetime
    ) -> EventRequest | None:
        bbox = state.best_bbox
        confidence = state.best_confidence
        state.window.clear()
        if bbox is None:
            state.state = "IDLE"
            return None

        if (
            self._last_event_time is not None
            and (now - self._last_event_time).total_seconds() < self.cooldown_seconds
            and self._last_event_bbox is not None
            and iou(bbox, self._last_event_bbox) > self.dedup_iou
        ):
            state.state = "COOLDOWN"
            state.cooldown_until = self._last_event_time + timedelta(
                seconds=self.cooldown_seconds
            )
            state.best_confidence = 0.0
            state.best_bbox = None
            return None

        state.state = "COOLDOWN"
        state.cooldown_until = now + timedelta(seconds=self.cooldown_seconds)
        state.best_confidence = 0.0
        state.best_bbox = None
        self._last_event_time = now
        self._last_event_bbox = bbox
        return EventRequest(
            event_id=str(uuid.uuid4()),
            track_id=track_id,
            class_name=self.event_type,
            confidence=confidence,
            bbox=bbox,
            detected_at=now,
        )
