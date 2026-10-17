import { clearSession, getToken } from "./session";
import type {
  Camera,
  EventDetail,
  EventsPage,
  ImageDetectResult,
  LoginResponse,
  ReviewStatus,
  SourceType,
  VideoDetectResult,
} from "./types";

export const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"
).replace(/\/+$/, "");

export const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws";

export class ApiError extends Error {
  status: number;
  code: string | null;

  constructor(status: number, code: string | null, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  options: { auth?: boolean } = {},
): Promise<T> {
  const auth = options.auth !== false;
  const headers = new Headers(init.headers);
  if (typeof init.body === "string") headers.set("Content-Type", "application/json");
  if (auth) {
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Tidak dapat menghubungi server API");
  }

  if (response.status === 401 && auth) {
    clearSession();
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
  }

  if (!response.ok) {
    let code: string | null = null;
    let message = `Permintaan gagal (HTTP ${response.status})`;
    try {
      const body = await response.json();
      if (body?.error?.message) {
        message = body.error.message;
        code = body.error.code ?? null;
      }
    } catch {
      // biarkan pesan default
    }
    throw new ApiError(response.status, code, message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function login(email: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>(
    "/api/auth/login",
    { method: "POST", body: JSON.stringify({ email, password }) },
    { auth: false },
  );
}

export function listCameras(): Promise<{ items: Camera[] }> {
  return request<{ items: Camera[] }>("/api/cameras");
}

export function getCamera(id: string): Promise<Camera> {
  return request<Camera>(`/api/cameras/${encodeURIComponent(id)}`);
}

export function startCamera(id: string): Promise<{ id: string; enabled: boolean }> {
  return request(`/api/cameras/${encodeURIComponent(id)}/start`, { method: "POST" });
}

export function stopCamera(id: string): Promise<{ id: string; enabled: boolean }> {
  return request(`/api/cameras/${encodeURIComponent(id)}/stop`, { method: "POST" });
}

export interface CreateCameraPayload {
  name: string;
  location: string;
  source_type: SourceType;
  stream_config_ref: string;
}

export function createCamera(payload: CreateCameraPayload): Promise<Camera> {
  return request<Camera>("/api/cameras", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface EventFilters {
  page?: number;
  pageSize?: number;
  cameraId?: string;
  status?: ReviewStatus | "";
  dateFrom?: string;
  dateTo?: string;
}

export function listEvents(filters: EventFilters = {}): Promise<EventsPage> {
  const params = new URLSearchParams();
  if (filters.page) params.set("page", String(filters.page));
  if (filters.pageSize) params.set("page_size", String(filters.pageSize));
  if (filters.cameraId) params.set("camera_id", filters.cameraId);
  if (filters.status) params.set("status", filters.status);
  if (filters.dateFrom) params.set("date_from", filters.dateFrom);
  if (filters.dateTo) params.set("date_to", filters.dateTo);
  const query = params.toString();
  return request<EventsPage>(`/api/events${query ? `?${query}` : ""}`);
}

export function getEvent(id: string): Promise<EventDetail> {
  return request<EventDetail>(`/api/events/${encodeURIComponent(id)}`);
}

export function reviewEvent(
  id: string,
  verdict: Exclude<ReviewStatus, "pending">,
  notes: string,
): Promise<{ event_id: string; review_status: ReviewStatus }> {
  return request(`/api/events/${encodeURIComponent(id)}/review`, {
    method: "PATCH",
    body: JSON.stringify({ verdict, notes: notes.trim() ? notes.trim() : null }),
  });
}

// URL gambar/MJPEG: token lewat query (?token=) karena <img> tidak bisa set header.
export function snapshotUrl(eventId: string, type: "annotated" | "original"): string {
  const token = getToken() ?? "";
  return `${API_BASE}/api/events/${encodeURIComponent(eventId)}/snapshot?type=${type}&token=${encodeURIComponent(token)}`;
}

export function streamUrl(cameraId: string): string {
  const token = getToken() ?? "";
  return `${API_BASE}/api/stream/${encodeURIComponent(cameraId)}?token=${encodeURIComponent(token)}`;
}

export function wsUrl(): string {
  const token = getToken() ?? "";
  return `${WS_BASE}?token=${encodeURIComponent(token)}`;
}

export function detectImage(file: File): Promise<ImageDetectResult> {
  const form = new FormData();
  form.append("file", file);
  return request<ImageDetectResult>("/api/detect/image", {
    method: "POST",
    body: form,
  });
}

export function detectVideo(file: File, stride: number): Promise<VideoDetectResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("stride", String(stride));
  return request<VideoDetectResult>("/api/detect/video", {
    method: "POST",
    body: form,
  });
}

export function detectVideoUrl(videoId: string): string {
  const token = getToken() ?? "";
  return `${API_BASE}/api/detect/video/${encodeURIComponent(videoId)}?token=${encodeURIComponent(token)}`;
}
