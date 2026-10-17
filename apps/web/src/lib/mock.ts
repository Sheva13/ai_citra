import type { Camera, EventItem } from "./types";

// Data dummy agar UI bisa didemo tanpa backend.
// Nanti ganti dengan GET /api/cameras dan GET /api/events.

export const MOCK_CAMERAS: Camera[] = [
  {
    id: "cam-01",
    name: "CAM-01",
    location: "Parkiran Depan",
    source_type: "phone",
    status: "online",
    last_seen_at: new Date().toISOString(),
    fps: 12.4,
    latency_p95_ms: 310,
  },
  {
    id: "cam-02",
    name: "CAM-02",
    location: "Gerbang Masuk",
    source_type: "rtsp",
    status: "offline",
    last_seen_at: null,
    fps: 0,
    latency_p95_ms: 0,
  },
];

export const MOCK_EVENTS: EventItem[] = [
  {
    event_id: "3f9a-mock-01",
    camera_id: "cam-01",
    camera_name: "CAM-01",
    camera_location: "Parkiran Depan",
    detected_at: new Date().toISOString(),
    event_type: "no_helmet",
    confidence: 0.91,
    review_status: "pending",
    snapshot_available: true,
  },
  {
    event_id: "b21c-mock-02",
    camera_id: "cam-02",
    camera_name: "CAM-02",
    camera_location: "Gerbang Masuk",
    detected_at: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
    event_type: "no_helmet",
    confidence: 0.88,
    review_status: "confirmed",
    snapshot_available: true,
  },
];

// Ganti role di sini untuk tes guard: "admin" bisa buka /cameras, "operator" 403.
export const MOCK_SESSION = { email: "admin@example.com", role: "admin" as const };
