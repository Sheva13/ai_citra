"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import CameraSelector from "@/components/CameraSelector";
import LiveFeed from "@/components/LiveFeed";
import { CameraStatusBadge } from "@/components/Status";
import {
  ApiError,
  listCameras,
  listEvents,
  startCamera,
  stopCamera,
  wsUrl,
} from "@/lib/api";
import { formatWib, formatWibTime } from "@/lib/format";
import { getSession } from "@/lib/session";
import type {
  Camera,
  CameraStatusMessage,
  EventItem,
  WsMessage,
} from "@/lib/types";

// Single-focus: feed 2/3 + info 1/3. Selector di body, state via ?camera=.
export default function MonitoringPage() {
  return (
    <Suspense
      fallback={
        <p className="py-16 text-center text-sm text-muted">Memuat monitoring…</p>
      }
    >
      <MonitoringInner />
    </Suspense>
  );
}

function MonitoringInner() {
  const searchParams = useSearchParams();
  const requestedId = searchParams.get("camera");

  const [cameras, setCameras] = useState<Camera[] | null>(null);
  const [recent, setRecent] = useState<EventItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [wsState, setWsState] = useState<"connecting" | "connected" | "disconnected">(
    "connecting",
  );
  const [toast, setToast] = useState<EventItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const activeId = requestedId ?? cameras?.[0]?.id ?? null;
  const activeIdRef = useRef<string | null>(null);
  activeIdRef.current = activeId;
  const activeCamera = cameras?.find((c) => c.id === activeId) ?? cameras?.[0] ?? null;
  const effectiveId = activeCamera?.id ?? null;

  useEffect(() => {
    setIsAdmin(getSession()?.role === "admin");
  }, []);

  const loadCameras = useCallback(async () => {
    try {
      const data = await listCameras();
      setCameras(data.items);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal memuat kamera");
    }
  }, []);

  useEffect(() => {
    loadCameras();
  }, [loadCameras]);

  // Kejadian terbaru untuk kamera aktif.
  useEffect(() => {
    if (!effectiveId) return;
    let cancelled = false;
    listEvents({ cameraId: effectiveId, pageSize: 3 })
      .then((data) => {
        if (!cancelled) setRecent(data.items);
      })
      .catch(() => {
        if (!cancelled) setRecent([]);
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveId]);

  // WebSocket realtime: camera.status + event.created, reconnect otomatis.
  useEffect(() => {
    let socket: WebSocket | null = null;
    let retryTimer: number | null = null;
    let closed = false;

    function connect() {
      if (closed) return;
      setWsState("connecting");
      socket = new WebSocket(wsUrl());

      socket.onopen = () => setWsState("connected");

      socket.onmessage = (event) => {
        let message: WsMessage;
        try {
          message = JSON.parse(event.data) as WsMessage;
        } catch {
          return;
        }

        if (message.type === "camera.status") {
          const payload = message.payload as CameraStatusMessage;
          setCameras((prev) =>
            prev
              ? prev.map((camera) =>
                  camera.id === payload.camera_id
                    ? {
                        ...camera,
                        status: payload.status,
                        last_seen_at: payload.last_seen_at,
                        fps: payload.fps,
                        latency_p95_ms: payload.latency_ms,
                        worker_state: payload.state,
                      }
                    : camera,
                )
              : prev,
          );
          return;
        }

        if (message.type === "event.created") {
          const payload = message.payload as EventItem;
          setCameras((prev) =>
            prev
              ? prev.map((camera) =>
                  camera.id === payload.camera_id
                    ? { ...camera, last_seen_at: payload.detected_at }
                    : camera,
                )
              : prev,
          );
          if (payload.camera_id === activeIdRef.current) {
            setRecent((prev) => [payload, ...prev].slice(0, 3));
            setToast(payload);
          }
        }
      };

      socket.onclose = () => {
        setWsState("disconnected");
        if (!closed) {
          retryTimer = window.setTimeout(connect, 3000);
        }
      };

      socket.onerror = () => {
        socket?.close();
      };
    }

    connect();
    return () => {
      closed = true;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      socket?.close();
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function handleToggle(enabled: boolean) {
    if (!activeCamera || busy) return;
    setBusy(true);
    try {
      if (enabled) {
        await stopCamera(activeCamera.id);
      } else {
        await startCamera(activeCamera.id);
      }
      setCameras((prev) =>
        prev
          ? prev.map((camera) =>
              camera.id === activeCamera.id
                ? { ...camera, enabled: !enabled }
                : camera,
            )
          : prev,
      );
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal mengubah status kamera");
    } finally {
      setBusy(false);
    }
  }

  if (!cameras && !error) {
    return <p className="py-16 text-center text-sm text-muted">Memuat kamera…</p>;
  }

  return (
    <div className="space-y-6">
      {toast ? (
        <div className="fixed bottom-6 right-6 z-20 w-80 rounded-xl border border-red-100 bg-white p-4 shadow-card">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#B91C1C]">
            Kejadian baru
          </p>
          <p className="mt-1 text-sm font-medium">
            {toast.camera_name} · no_helmet · {toast.confidence.toFixed(2)}
          </p>
          <p className="mono mt-0.5 text-xs text-muted">
            {formatWibTime(toast.detected_at)} WIB
          </p>
          <a
            href={`/logs/${toast.event_id}`}
            className="mt-2 inline-block text-[13px] font-medium text-ink hover:underline"
          >
            Lihat detail →
          </a>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-[#B91C1C]">
          {error}{" "}
          <button type="button" onClick={loadCameras} className="font-medium underline">
            Muat ulang
          </button>
        </p>
      ) : null}

      {cameras && cameras.length === 0 ? (
        <p className="rounded-xl border border-hairline bg-white px-4 py-8 text-center text-sm text-muted">
          Belum ada kamera terdaftar. Tambahkan lewat menu admin → Kelola kamera.
        </p>
      ) : null}

      {cameras && activeCamera ? (
        <>
          <CameraSelector cameras={cameras} activeId={activeCamera.id} />

          <div className="grid items-start gap-6 lg:grid-cols-3">
            <section className="space-y-3 lg:col-span-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h1 className="text-xl font-semibold tracking-tight">
                  {activeCamera.name}{" "}
                  <span className="font-normal text-muted">· {activeCamera.location}</span>
                </h1>
                <CameraStatusBadge status={activeCamera.status} />
              </div>
              <LiveFeed camera={activeCamera} />
              <div className="mono flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-muted">
                <span>
                  FPS{" "}
                  <strong className="text-ink">{activeCamera.fps.toFixed(1)}</strong>
                </span>
                <span>
                  p95{" "}
                  <strong className="text-ink">
                    {activeCamera.latency_p95_ms.toFixed(0)} ms
                  </strong>
                </span>
                <span>
                  Worker <strong className="text-ink">{activeCamera.worker_state}</strong>
                </span>
                <span>
                  WS{" "}
                  <strong
                    className={
                      wsState === "connected" ? "text-[#059669]" : "text-[#B45309]"
                    }
                  >
                    {wsState === "connected"
                      ? "aktif"
                      : wsState === "connecting"
                        ? "menghubungkan…"
                        : "terputus"}
                  </strong>
                </span>
              </div>
              {isAdmin ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy || activeCamera.enabled}
                    onClick={() => handleToggle(false)}
                    className="rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
                  >
                    Start
                  </button>
                  <button
                    type="button"
                    disabled={busy || !activeCamera.enabled}
                    onClick={() => handleToggle(true)}
                    className="rounded-full border border-hairline bg-white px-4 py-1.5 text-sm font-medium hover:border-ink/40 disabled:opacity-40"
                  >
                    Stop
                  </button>
                </div>
              ) : null}
            </section>

            <aside className="signal-card p-6 shadow-card" style={{ ["--signal" as string]: signalFor(activeCamera.status) }}>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">
                Informasi kamera
              </p>
              <p className="mt-1 text-lg font-semibold tracking-tight">
                {activeCamera.location}
              </p>
              <p className="mono text-xs text-muted">
                {activeCamera.name} · {activeCamera.source_type}
              </p>

              <dl className="mt-5 space-y-3 border-t border-hairline pt-5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">Status</dt>
                  <dd>
                    <CameraStatusBadge status={activeCamera.status} />
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Terakhir terlihat</dt>
                  <dd className="mono text-[13px]">
                    {formatWib(activeCamera.last_seen_at)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Model</dt>
                  <dd className="mono text-[13px]">
                    {activeCamera.model_loaded
                      ? (activeCamera.model_version ?? "aktif")
                      : "belum dimuat"}
                  </dd>
                </div>
              </dl>

              <div className="mt-5 border-t border-hairline pt-5">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">
                    Kejadian terbaru
                  </p>
                  <a
                    href={`/logs?kamera=${activeCamera.id}`}
                    className="text-[13px] font-medium hover:underline"
                  >
                    Semua →
                  </a>
                </div>
                {recent.length === 0 ? (
                  <p className="rounded-lg bg-paper px-3 py-4 text-center text-[13px] text-muted">
                    Belum ada kejadian di kamera ini.
                  </p>
                ) : (
                  <ul className="divide-y divide-hairline">
                    {recent.map((e) => (
                      <li
                        key={e.event_id}
                        className="flex items-center justify-between py-2.5"
                      >
                        <span className="mono text-[13px]">
                          {formatWibTime(e.detected_at)}
                        </span>
                        <a
                          href={`/logs/${e.event_id}`}
                          className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-[#B91C1C] ring-1 ring-inset ring-red-100 hover:bg-red-100"
                        >
                          no_helmet · {e.confidence.toFixed(2)}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </aside>
          </div>
        </>
      ) : null}
    </div>
  );
}

function signalFor(status: string) {
  if (status === "online") return "#059669";
  if (status === "offline" || status === "error") return "#DC2626";
  return "#D97706";
}
