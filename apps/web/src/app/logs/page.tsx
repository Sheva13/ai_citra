import { ReviewPill } from "@/components/Status";
import { MOCK_EVENTS } from "@/lib/mock";

// Laporan penuh — independen dari ?camera= di /monitoring.
export default function LogsPage({
  searchParams,
}: {
  searchParams: { kamera?: string; status?: string };
}) {
  const camFilter = searchParams.kamera ?? "Semua";
  const statusFilter = searchParams.status ?? "Semua";
  const rows = MOCK_EVENTS.filter(
    (e) =>
      (camFilter === "Semua" || e.camera_id === camFilter) &&
      (statusFilter === "Semua" || e.review_status === statusFilter),
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Logs</h1>
          <p className="mt-1 text-sm text-muted">
            {rows.length} kejadian · klik baris untuk detail & review
          </p>
        </div>
        <form className="flex flex-wrap items-center gap-2 text-sm">
          <label className="sr-only" htmlFor="kamera">
            Kamera
          </label>
          <select
            id="kamera"
            name="kamera"
            defaultValue={camFilter}
            className="rounded-full border border-hairline bg-white px-3.5 py-2"
          >
            <option>Semua</option>
            <option value="cam-01">CAM-01 · Parkiran Depan</option>
            <option value="cam-02">CAM-02 · Gerbang Masuk</option>
          </select>
          <label className="sr-only" htmlFor="status">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={statusFilter}
            className="rounded-full border border-hairline bg-white px-3.5 py-2"
          >
            <option>Semua</option>
            <option value="pending">pending</option>
            <option value="confirmed">confirmed</option>
            <option value="false_positive">false positive</option>
          </select>
          <button className="rounded-full bg-ink px-4 py-2 font-medium text-white hover:opacity-90">
            Filter
          </button>
        </form>
      </div>

      <div className="overflow-hidden rounded-xl border border-hairline bg-white shadow-card">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-hairline text-[11px] uppercase tracking-widest text-muted">
              <th className="px-5 py-3 font-semibold">ID</th>
              <th className="px-5 py-3 font-semibold">Waktu · WIB</th>
              <th className="px-5 py-3 font-semibold">Kamera · Lokasi</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 text-right font-semibold">Conf</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {rows.map((e) => (
              <tr key={e.event_id} className="transition-colors hover:bg-paper">
                <td className="px-5 py-3.5">
                  <a
                    href={`/logs/${e.event_id}`}
                    className="mono text-[13px] font-medium hover:underline"
                  >
                    {e.event_id.slice(0, 6)}…
                  </a>
                </td>
                <td className="mono px-5 py-3.5 text-[13px] text-muted">
                  {new Date(e.detected_at).toLocaleString("id-ID", {
                    timeZone: "Asia/Jakarta",
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td className="px-5 py-3.5">
                  <span className="block font-medium">{e.camera_name}</span>
                  <span className="block text-xs text-muted">{e.camera_location}</span>
                </td>
                <td className="px-5 py-3.5">
                  <ReviewPill status={e.review_status} />
                </td>
                <td className="mono px-5 py-3.5 text-right">{e.confidence.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">
            Belum ada kejadian untuk filter ini.
          </p>
        ) : null}
      </div>

      <p className="text-center text-[13px] text-muted">‹ 1 › · 20 per halaman</p>
    </div>
  );
}
