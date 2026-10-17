import cv2

COLORS = {"no_helmet": (0, 0, 255), "helmet": (0, 200, 0)}
FALLBACK_COLOR = (255, 255, 0)


def draw_tracks(frame, tracks):
    out = frame.copy()
    for track in tracks:
        x1, y1, x2, y2 = track.bbox
        color = COLORS.get(track.class_name, FALLBACK_COLOR)
        cv2.rectangle(out, (x1, y1), (x2, y2), color, 2)
        label = f"{track.class_name} {track.confidence:.2f}"
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
        cv2.rectangle(out, (x1, y1 - th - 8), (x1 + tw + 4, y1), color, -1)
        cv2.putText(
            out, label, (x1 + 2, y1 - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2
        )
    return out
