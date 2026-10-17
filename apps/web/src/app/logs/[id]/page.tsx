import { ReviewPill } from "@/components/Status";
import { MOCK_EVENTS } from "@/lib/mock";

// ponytail: mock detail, ganti GET /api/events/{id} saat backend ada.
export default function LogDetailPage({ params }: { params: { id: string } }) {
  const e = MOCK_EVENTS.find((x) => x.event_id === params.id) ?? MOCK_EVENTS[0];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <a href="/logs" className="text-sm font-medium text-muted hover:text-ink">
          ← Kembali ke logs
        </a>
        <ReviewPill status={e.review_status} />
      </div>

      <h1 className="mono text-lg font-semibold tracking-tight">{e.event_id}</h1>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="signal-card overflow-hidden shadow-card" style={{ ["--signal" as string]: "#DC2626" }}>
          <div className="flex gap-1 border-b border-hairline px-4 pt-3 text-sm">
            <span className="border-b-2 border-ink px-2 pb-2 font-medium">Beranotasi</span>
            <span className="px-2 pb-2 text-muted">Asli</span>
          </div>
          <div className="viewfinder flex aspect-video items-center justify-center bg-paper text-sm text-muted">
            Snapshot menyusul — sambungkan /snapshot?type=annotated
          </div>
        </div>

        <div className="space-y-5">
          <dl className="rounded-xl border border-hairline bg-white p-6 shadow-card">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-muted">
              Metadata
            </p>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Waktu</dt>
                <dd className="mono text-right text-[13px]">
                  {new Date(e.detected_at).toLocaleString("id-ID", {
                    timeZone: "Asia/Jakarta",
                  })}{" "}
                  WIB
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Kamera</dt>
                <dd className="text-right font-medium">
                  {e.camera_name} · {e.camera_location}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Kelas</dt>
                <dd>
                  <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-[#B91C1C] ring-1 ring-inset ring-red-100">
                    {e.event_type} · {e.confidence.toFixed(2)}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Model</dt>
                <dd className="mono text-[13px]">helmet-v1.2</dd>
              </div>
            </div>
          </dl>

          <form className="rounded-xl border border-hairline bg-white p-6 shadow-card">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted">
              Review · operator & admin
            </p>
            <div className="grid grid-cols-2 gap-2 rounded-full border border-hairline bg-paper p-1 text-sm">
              <button
                type="button"
                className="rounded-full bg-ink px-3 py-2 font-medium text-white"
              >
                Confirmed
              </button>
              <button type="button" className="rounded-full px-3 py-2 text-muted hover:text-ink">
                False positive
              </button>
            </div>
            <input
              placeholder="Catatan (opsional)"
              className="mt-3 w-full rounded-lg border border-hairline bg-white px-3.5 py-2.5 text-sm placeholder:text-muted/70 focus:border-ink focus:outline-none"
            />
            <button className="mt-3 w-full rounded-full bg-ink py-2.5 text-sm font-medium text-white hover:opacity-90">
              Simpan review
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
