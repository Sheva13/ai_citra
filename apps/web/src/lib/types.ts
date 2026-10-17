// Kontrak tipe mengikuti docs/05-API-SPEC-ERD.md (Draft v2).
// ponytail: mock dulu, ganti fetch REST/WS saat backend ada.

export type Role = "admin" | "operator";

export type CameraStatus = "online" | "offline" | "error" | "reconnecting";

export interface Camera {
  id: string;
  name: string;
  location: string;
  source_type: "phone" | "rtsp";
  status: CameraStatus;
  last_seen_at: string | null;
  fps?: number;
  latency_p95_ms?: number;
}

export type ReviewStatus = "pending" | "confirmed" | "false_positive";

export interface Detection {
  class_name: "helmet" | "no_helmet";
  confidence: number;
  bbox: { x1: number; y1: number; x2: number; y2: number };
  track_id: string;
}

export interface EventItem {
  event_id: string;
  camera_id: string;
  camera_name: string;
  camera_location: string;
  detected_at: string;
  event_type: "no_helmet";
  confidence: number;
  review_status: ReviewStatus;
  snapshot_available: boolean;
}

export interface Session {
  email: string;
  role: Role;
}
