// Kontrak tipe mengikuti docs/05-API-SPEC-ERD.md (Draft v2) + payload API aktual.

export type Role = "admin" | "operator";

export type CameraStatus = "online" | "offline" | "error" | "reconnecting";

export type SourceType = "phone" | "rtsp" | "webcam";

export interface Camera {
  id: string;
  name: string;
  location: string;
  source_type: SourceType;
  status: CameraStatus;
  enabled: boolean;
  last_seen_at: string | null;
  fps: number;
  latency_p95_ms: number;
  worker_state: string;
  model_loaded: boolean;
  model_version: string | null;
  error_message: string | null;
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
  model_version: string | null;
}

export interface EventDetection extends Detection {
  id: string;
}

export interface EventReview {
  id: string;
  verdict: ReviewStatus;
  notes: string | null;
  reviewed_by: string;
  reviewed_at: string;
}

export interface EventDetail {
  event_id: string;
  camera: { id: string; name: string; location: string };
  detected_at: string;
  event_type: string;
  model_version: string | null;
  snapshot_status: "ok" | "failed";
  review_status: ReviewStatus;
  detections: EventDetection[];
  reviews: EventReview[];
}

export interface EventsPage {
  items: EventItem[];
  page: number;
  page_size: number;
  total: number;
}

export interface Session {
  email: string;
  role: Role;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  role: Role;
  email: string;
  expires_in: number;
}

export interface CameraStatusMessage {
  camera_id: string;
  name: string;
  status: CameraStatus;
  last_seen_at: string | null;
  fps: number;
  latency_ms: number;
  state: string;
}

export interface WsMessage {
  type: "camera.status" | "event.created";
  payload: CameraStatusMessage | EventItem;
}

// ===== Deteksi upload (gambar/video) =====

export interface UploadDetection {
  class_name: "helmet" | "no_helmet";
  confidence: number;
  bbox: { x1: number; y1: number; x2: number; y2: number };
}

export interface ImageDetectResult {
  model_version: string;
  duration_ms: number;
  width: number;
  height: number;
  no_helmet_count: number;
  helmet_count: number;
  detections: UploadDetection[];
  media_type: string;
  image_base64: string;
}

export interface VideoTimelineEntry {
  time_sec: number;
  no_helmet: number;
  helmet: number;
  top_class: string;
  top_confidence: number;
}

export interface VideoDetectResult {
  video_id: string;
  model_version: string;
  duration_ms: number;
  video_duration_sec: number | null;
  fps: number;
  frames_total: number | null;
  frames_processed: number;
  stride: number;
  frames_with_no_helmet: number;
  frames_with_helmet: number;
  peak_no_helmet: { confidence: number; time_sec: number } | null;
  timeline: VideoTimelineEntry[];
}
