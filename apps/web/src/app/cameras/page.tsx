"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CameraStatusBadge } from "@/components/Status";
import {
  ApiError,
  createCamera,
  listCameras,
  startCamera,
  stopCamera,
} from "@/lib/api";
import { formatWib } from "@/lib/format";
import { getSession } from "@/lib/session";
import type { Camera, SourceType } from "@/lib/types";

// Admin-only. Operator → redirect (backend tetap 403).
export default function CamerasPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    location: "",
    source_type: "phone" as SourceType,
    stream_config_ref: "",
  });
  const [saving, setSaving] = useState(false);
  const [formMessage, setFormMessage] = useState<string | null>(null);

  useEffect(() => {
    const session = getSession();
    if (session?.role !== "admin") {
      router.replace("/monitoring");
      return;
    }
    setAllowed(true);
  }, [router]);

  const load = useCallback(async () => {
    try {
      const data = await listCameras();
      setCameras(data.items);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal memuat kamera");
    }
  }, []);

  useEffect(() => {
    if (allowed) load();
  }, [allowed, load]);

  async function toggle(camera: Camera) {
    if (busyId) return;
    setBusyId(camera.id);
    try {
      if (camera.enabled) {
        await stopCamera(camera.id);
      } else {
        await startCamera(camera.id);
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal mengubah status kamera");
    } finally {
      setBusyId(null);
    }
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setFormMessage(null);
    try {
      await createCamera({
        name: form.name.trim(),
        location: form.location.trim(),
        source_type: form.source_type,
        stream_config_ref: form.stream_config_ref.trim(),
      });
      setForm({ name: "", location: "", source_type: "phone", stream_config_ref: "" });
      setFormMessage("Kamera ditambahkan.");
      await load();
    } catch (err) {
      setFormMessage(
        err instanceof ApiError ? err.message : "Gagal menambah kamera",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!allowed) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Kelola kamera</h1>
        <p className="mt-1 text-sm text-muted">
          Hanya admin · URL/kredensial tidak pernah ditampilkan
        </p>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-[#B91C1C]">
          {error}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-hairline bg-white shadow-card">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-hairline text-[11px] uppercase tracking-widest text-muted">
              <th className="px-5 py-3 font-semibold">Nama</th>
              <th className="px-5 py-3 font-semibold">Lokasi</th>
              <th className="px-5 py-3 font-semibold">Tipe</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Worker</th>
              <th className="px-5 py-3 text-right font-semibold">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {cameras.map((camera) => (
              <tr key={camera.id} className="hover:bg-paper">
                <td className="px-5 py-3.5">
                  <span className="block font-medium">{camera.name}</span>
                  <span className="mono block text-xs text-muted">
                    {camera.model_loaded ? (camera.model_version ?? "model aktif") : "model —"}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <span className="block">{camera.location}</span>
                  <span className="mono block text-xs text-muted">
                    terakhir: {formatWib(camera.last_seen_at)}
                  </span>
                </td>
                <td className="mono px-5 py-3.5 text-[13px] text-muted">
                  {camera.source_type}
                </td>
                <td className="px-5 py-3.5">
                  <CameraStatusBadge status={camera.status} />
                </td>
                <td className="px-5 py-3.5">
                  <span className="mono text-[13px] text-muted">{camera.worker_state}</span>
                  {camera.error_message ? (
                    <span className="block text-xs text-[#B91C1C]">{camera.error_message}</span>
                  ) : null}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <button
                    type="button"
                    disabled={busyId === camera.id}
                    onClick={() => toggle(camera)}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-medium disabled:opacity-50 ${
                      camera.enabled
                        ? "border border-hairline bg-white hover:border-ink/40"
                        : "bg-ink text-white hover:opacity-90"
                    }`}
                  >
                    {busyId === camera.id
                      ? "…"
                      : camera.enabled
                        ? "Stop"
                        : "Start"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {cameras.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">
            Belum ada kamera terdaftar.
          </p>
        ) : null}
      </div>

      <form
        className="grid max-w-md gap-2.5 rounded-xl border border-hairline bg-white p-6 shadow-card"
        onSubmit={handleCreate}
      >
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">
          Tambah kamera
        </p>
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Nama — mis. CAM-03"
          required
          className="rounded-lg border border-hairline px-3.5 py-2.5 text-sm focus:border-ink focus:outline-none"
        />
        <input
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
          placeholder="Lokasi — mis. Parkiran Belakang"
          required
          className="rounded-lg border border-hairline px-3.5 py-2.5 text-sm focus:border-ink focus:outline-none"
        />
        <select
          value={form.source_type}
          onChange={(e) => setForm({ ...form, source_type: e.target.value as SourceType })}
          className="rounded-lg border border-hairline bg-white px-3.5 py-2.5 text-sm"
        >
          <option value="phone">phone</option>
          <option value="rtsp">rtsp</option>
          <option value="webcam">webcam</option>
        </select>
        <input
          value={form.stream_config_ref}
          onChange={(e) => setForm({ ...form, stream_config_ref: e.target.value })}
          placeholder="stream_config_ref — mis. CAM03_STREAM atau 0 (webcam)"
          required
          className="mono rounded-lg border border-hairline px-3.5 py-2.5 text-[13px] focus:border-ink focus:outline-none"
        />
        <button
          type="submit"
          disabled={saving}
          className="mt-1 rounded-full bg-ink py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {saving ? "Menyimpan…" : "Tambah kamera"}
        </button>
        {formMessage ? (
          <p className="text-center text-[13px] text-muted">{formMessage}</p>
        ) : null}
      </form>
    </div>
  );
}
