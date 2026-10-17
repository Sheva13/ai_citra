import type { Camera } from "@/lib/types";

// Ganti div placeholder dengan <img src={`${API}/stream/${camera.id}`>
// + overlay bbox dari WS detection.live saat backend ada.
export default function LiveFeed({ camera }: { camera: Camera }) {
  if (camera.status === "offline" || camera.status === "error") {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-hairline bg-white text-sm">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-paper text-muted">
          ○
        </span>
        <p className="font-medium">Tidak ada sinyal</p>
        <p className="mono text-xs text-muted">last seen · {camera.last_seen_at ?? "—"}</p>
      </div>
    );
  }
  return (
    <div className="viewfinder relative aspect-video w-full overflow-hidden rounded-xl border border-hairline bg-white shadow-card">
      {/* corner ticks ala viewfinder */}
      <span className="absolute left-3 top-3 h-4 w-4 rounded-tl border-l-2 border-t-2 border-ink/30" />
      <span className="absolute right-3 top-3 h-4 w-4 rounded-tr border-r-2 border-t-2 border-ink/30" />
      <span className="absolute bottom-3 left-3 h-4 w-4 rounded-bl border-b-2 border-l-2 border-ink/30" />
      <span className="absolute bottom-3 right-3 h-4 w-4 rounded-br border-b-2 border-r-2 border-ink/30" />

      <div className="flex h-full flex-col items-center justify-center gap-1">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">
          Live · {camera.name}
        </p>
        <p className="text-sm text-muted">Sambungkan /stream/{camera.id} di sini</p>
      </div>

      <span className="absolute left-1/2 top-1/3 -translate-x-1/2 rounded-md bg-[#DC2626] px-2.5 py-1 font-mono text-xs font-semibold text-white shadow">
        no_helmet · 0.91
      </span>

      <span className="mono absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-ink/85 px-3 py-1 text-[11px] text-white">
        ● REC · {camera.location}
      </span>
    </div>
  );
}
