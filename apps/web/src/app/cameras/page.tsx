import { redirect } from "next/navigation";
import { CameraStatusBadge } from "@/components/Status";
import { MOCK_CAMERAS, MOCK_SESSION } from "@/lib/mock";

// Admin-only. Operator → redirect (backend tetap 403).
export default function CamerasPage() {
  if (MOCK_SESSION.role !== "admin") redirect("/monitoring");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Kelola kamera</h1>
        <p className="mt-1 text-sm text-muted">
          Hanya admin · URL/kredensial tidak pernah ditampilkan
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-hairline bg-white shadow-card">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-hairline text-[11px] uppercase tracking-widest text-muted">
              <th className="px-5 py-3 font-semibold">Nama</th>
              <th className="px-5 py-3 font-semibold">Lokasi</th>
              <th className="px-5 py-3 font-semibold">Tipe</th>
              <th className="px-5 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {MOCK_CAMERAS.map((c) => (
              <tr key={c.id} className="hover:bg-paper">
                <td className="px-5 py-3.5 font-medium">{c.name}</td>
                <td className="px-5 py-3.5">{c.location}</td>
                <td className="mono px-5 py-3.5 text-[13px] text-muted">{c.source_type}</td>
                <td className="px-5 py-3.5">
                  <CameraStatusBadge status={c.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form className="grid max-w-md gap-2.5 rounded-xl border border-hairline bg-white p-6 shadow-card">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">
          Tambah kamera
        </p>
        <input
          placeholder="Nama — mis. CAM-03"
          className="rounded-lg border border-hairline px-3.5 py-2.5 text-sm focus:border-ink focus:outline-none"
        />
        <input
          placeholder="Lokasi — mis. Parkiran Belakang"
          className="rounded-lg border border-hairline px-3.5 py-2.5 text-sm focus:border-ink focus:outline-none"
        />
        <select className="rounded-lg border border-hairline bg-white px-3.5 py-2.5 text-sm">
          <option value="phone">phone</option>
          <option value="rtsp">rtsp</option>
        </select>
        <input
          placeholder="stream_config_ref — mis. CAM03_STREAM"
          className="mono rounded-lg border border-hairline px-3.5 py-2.5 text-[13px] focus:border-ink focus:outline-none"
        />
        <button className="mt-1 rounded-full bg-ink py-2.5 text-sm font-medium text-white hover:opacity-90">
          Tambah kamera
        </button>
      </form>
    </div>
  );
}
