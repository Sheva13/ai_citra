import CameraSelector from "@/components/CameraSelector";
import LiveFeed from "@/components/LiveFeed";
import { CameraStatusBadge } from "@/components/Status";
import { MOCK_CAMERAS, MOCK_EVENTS, MOCK_SESSION } from "@/lib/mock";

function signalFor(status: string) {
  if (status === "online") return "#059669";
  if (status === "offline" || status === "error") return "#DC2626";
  return "#D97706";
}

// Single-focus: feed 2/3 + info 1/3. Selector di body, state via ?camera=.
export default function MonitoringPage({
  searchParams,
}: {
  searchParams: { camera?: string };
}) {
  const activeId = searchParams.camera ?? MOCK_CAMERAS[0].id;
  const camera = MOCK_CAMERAS.find((c) => c.id === activeId) ?? MOCK_CAMERAS[0];
  const recent = MOCK_EVENTS.filter((e) => e.camera_id === camera.id).slice(0, 3);
  const isAdmin = MOCK_SESSION.role === "admin";

  return (
    <div className="space-y-6">
      <CameraSelector cameras={MOCK_CAMERAS} activeId={camera.id} />

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <section className="space-y-3 lg:col-span-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="text-xl font-semibold tracking-tight">
              {camera.name}{" "}
              <span className="font-normal text-muted">· {camera.location}</span>
            </h1>
            <CameraStatusBadge status={camera.status} />
          </div>
          <LiveFeed camera={camera} />
          <div className="mono flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-muted">
            <span>
              FPS <strong className="text-ink">{camera.fps?.toFixed(1) ?? "—"}</strong>
            </span>
            <span>
              p95 <strong className="text-ink">{camera.latency_p95_ms ?? "—"} ms</strong>
            </span>
            <span>
              Worker <strong className="text-ink">running</strong>
            </span>
          </div>
          {isAdmin ? (
            <div className="flex gap-2">
              <button className="rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-white hover:opacity-90">
                Start
              </button>
              <button className="rounded-full border border-hairline bg-white px-4 py-1.5 text-sm font-medium hover:border-ink/40">
                Stop
              </button>
            </div>
          ) : null}
        </section>

        <aside
          className="signal-card p-6 shadow-card"
          style={{ ["--signal" as string]: signalFor(camera.status) }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">
            Informasi kamera
          </p>
          <p className="mt-1 text-lg font-semibold tracking-tight">{camera.location}</p>
          <p className="mono text-xs text-muted">
            {camera.name} · {camera.source_type}
          </p>

          <dl className="mt-5 space-y-3 border-t border-hairline pt-5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Status</dt>
              <dd>
                <CameraStatusBadge status={camera.status} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Terakhir terlihat</dt>
              <dd className="mono text-[13px]">{camera.last_seen_at ?? "—"}</dd>
            </div>
          </dl>

          <div className="mt-5 border-t border-hairline pt-5">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">
                Kejadian terbaru
              </p>
              <a href="/logs" className="text-[13px] font-medium hover:underline">
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
                  <li key={e.event_id} className="flex items-center justify-between py-2.5">
                    <span className="mono text-[13px]">
                      {new Date(e.detected_at).toLocaleTimeString("id-ID", {
                        timeZone: "Asia/Jakarta",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
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
    </div>
  );
}
