from datetime import datetime, timedelta, timezone

from vision.event_processor import EventProcessor, Observation

NOW = datetime(2026, 10, 17, 12, 0, 0, tzinfo=timezone.utc)
BBOX = (100, 100, 200, 200)


def obs(track_id=1, class_name="no_helmet", confidence=0.9, bbox=BBOX):
    return Observation(track_id, class_name, confidence, bbox)


def test_confirm_after_n_of_m():
    processor = EventProcessor(conf_min=0.5, confirm_n=3, confirm_m=5, cooldown_seconds=10)
    events = []
    for i in range(2):
        events += processor.update([obs()], NOW + timedelta(seconds=0.1 * i))
    assert events == []
    events += processor.update([obs()], NOW + timedelta(seconds=0.2))
    assert len(events) == 1
    assert events[0].class_name == "no_helmet"
    assert events[0].track_id == 1


def test_low_confidence_ignored():
    processor = EventProcessor(conf_min=0.5, confirm_n=3, confirm_m=5)
    events = []
    for i in range(6):
        events += processor.update([obs(confidence=0.4)], NOW + timedelta(seconds=0.1 * i))
    assert events == []


def test_inconsistent_then_reset_needs_full_confirm():
    processor = EventProcessor(confirm_n=3, confirm_m=5, cooldown_seconds=10)
    t = NOW
    processor.update([obs()], t)
    for _ in range(5):
        t += timedelta(seconds=0.1)
        processor.update([obs(class_name="helmet")], t)
    events = []
    for _ in range(2):
        t += timedelta(seconds=0.1)
        events += processor.update([obs()], t)
    assert events == []
    t += timedelta(seconds=0.1)
    events += processor.update([obs()], t)
    assert len(events) == 1


def test_cooldown_suppresses_repeat_then_rearms():
    processor = EventProcessor(confirm_n=3, confirm_m=5, cooldown_seconds=10)
    t = NOW
    events = []
    for i in range(3):
        events += processor.update([obs()], t + timedelta(seconds=0.1 * i))
    assert len(events) == 1

    more = []
    for i in range(10):
        more += processor.update([obs()], t + timedelta(seconds=1 + 0.1 * i))
    assert more == []

    second = []
    for i in range(3):
        second += processor.update([obs()], t + timedelta(seconds=11 + 0.1 * i))
    assert len(second) == 1


def test_new_track_same_bbox_within_cooldown_suppressed():
    processor = EventProcessor(confirm_n=3, confirm_m=5, cooldown_seconds=10)
    t = NOW
    events = []
    for i in range(3):
        events += processor.update(
            [obs(track_id=1)], t + timedelta(seconds=0.1 * i)
        )
    assert len(events) == 1

    suppressed = []
    for i in range(3):
        suppressed += processor.update(
            [obs(track_id=2, bbox=(102, 102, 202, 202))],
            t + timedelta(seconds=1 + 0.1 * i),
        )
    assert suppressed == []


def test_new_track_far_bbox_emits_within_cooldown():
    processor = EventProcessor(confirm_n=3, confirm_m=5, cooldown_seconds=10)
    t = NOW
    processor.update([obs(track_id=1)], t)
    processor.update([obs(track_id=1)], t + timedelta(seconds=0.1))
    processor.update([obs(track_id=1)], t + timedelta(seconds=0.2))

    events = []
    for i in range(3):
        events += processor.update(
            [obs(track_id=3, bbox=(600, 600, 700, 700))],
            t + timedelta(seconds=1 + 0.1 * i),
        )
    assert len(events) == 1


def test_seed_last_event_prevents_duplicate_after_restart():
    processor = EventProcessor(confirm_n=3, confirm_m=5, cooldown_seconds=10)
    processor.seed_last_event(NOW, BBOX)
    events = []
    for i in range(3):
        events += processor.update([obs(track_id=9)], NOW + timedelta(seconds=1 + 0.1 * i))
    assert events == []
