"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ReviewPill } from "@/components/Status";
import { ApiError, listCameras, listEvents } from "@/lib/api";
import { formatWib, wibDayRange } from "@/lib/format";
import type { Camera, EventsPage, ReviewStatus } from "@/lib/types";

const PAGE_SIZE = 20;

// Laporan penuh — independen dari ?camera= di /monitoring.
export default function LogsPage() {
  return (
    <Suspense fallback={<p className="py-16 text-center text-sm text-muted">Memuat logs…</p>}>
      <LogsInner />
    </Suspense>
  );
}

function LogsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const kamera = searchParams.get("kamera") ?? "";
  const status = (searchParams.get("status") ?? "") as ReviewStatus | "";
  const tanggal = searchParams.get("tanggal") ?? "";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);

  const [cameras, setCameras] = useState<Camera[]>([]);
  const [data, setData] = useState<EventsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listCameras()
      .then((res) => setCameras(res.items))
      .catch(() => setCameras([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const range = tanggal ? wibDayRange(tanggal) : null;
      const result = await listEvents({
        page,
        pageSize: PAGE_SIZE,
        cameraId: kamera,
        status,
        dateFrom: range?.from,
        dateTo: range?.to,
      });
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal memuat logs");
    } finally {
      setLoading(false);
    }
  }, [page, kamera, status, tanggal]);

  useEffect(() => {
    load();
  }, [load]);

  function pushFilters(next: Partial<Record<"kamera" | "status" | "tanggal" | "page", string>>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }
    if (!("page" in next)) params.delete("page");
    const query = params.toString();
    router.push(`/logs${query ? `?${query}` : ""}`);
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const rows = data?.items ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Logs</h1>
          <p className="mt-1 text-sm text-muted">
            {data ? `${data.total} kejadian` : "Memuat…"} · klik baris untuk detail & review
          </p>
        </div>
        <form
          className="flex flex-wrap items-center gap-2 text-sm"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            pushFilters({
              kamera: String(form.get("kamera") ?? ""),
              status: String(form.get("status") ?? ""),
              tanggal: String(form.get("tanggal") ?? ""),
            });
          }}
        >
          <label className="sr-only" htmlFor="kamera">
            Kamera
          </label>
          <select
            id="kamera"
            name="kamera"
            key={`kamera-${kamera}`}
            defaultValue={kamera}
            className="rounded-full border border-hairline bg-white px-3.5 py-2"
          >
            <option value="">Semua kamera</option>
            {cameras.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.location}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="status">
            Status
          </label>
          <select
            id="status"
            name="status"
            key={`status-${status}`}
            defaultValue={status}
            className="rounded-full border border-hairline bg-white px-3.5 py-2"
          >
            <option value="">Semua status</option>
            <option value="pending">pending</option>
            <option value="confirmed">confirmed</option>
            <option value="false_positive">false positive</option>
          </select>
          <label className="sr-only" htmlFor="tanggal">
            Tanggal
          </label>
          <input
            id="tanggal"
            name="tanggal"
            type="date"
            key={`tanggal-${tanggal}`}
            defaultValue={tanggal}
            className="mono rounded-full border border-hairline bg-white px-3.5 py-2 text-[13px]"
          />
          <button className="rounded-full bg-ink px-4 py-2 font-medium text-white hover:opacity-90">
            Filter
          </button>
        </form>
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
              <th className="px-5 py-3 font-semibold">ID</th>
              <th className="px-5 py-3 font-semibold">Waktu · WIB</th>
              <th className="px-5 py-3 font-semibold">Kamera · Lokasi</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 text-right font-semibold">Conf</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {rows.map((e) => (
              <tr
                key={e.event_id}
                className="cursor-pointer transition-colors hover:bg-paper"
                onClick={() => router.push(`/logs/${e.event_id}`)}
              >
                <td className="px-5 py-3.5">
                  <span className="mono text-[13px] font-medium">{e.event_id.slice(0, 6)}…</span>
                </td>
                <td className="mono px-5 py-3.5 text-[13px] text-muted">
                  {formatWib(e.detected_at, { year: undefined })}
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
        {!loading && rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">
            Belum ada kejadian untuk filter ini.
          </p>
        ) : null}
        {loading ? (
          <p className="px-5 py-10 text-center text-sm text-muted">Memuat…</p>
        ) : null}
      </div>

      <div className="flex items-center justify-center gap-3 text-[13px] text-muted">
        <button
          type="button"
          disabled={page <= 1 || loading}
          onClick={() => pushFilters({ page: String(page - 1) })}
          className="rounded-full border border-hairline px-3 py-1 disabled:opacity-40"
        >
          ‹
        </button>
        <span>
          Halaman {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages || loading}
          onClick={() => pushFilters({ page: String(page + 1) })}
          className="rounded-full border border-hairline px-3 py-1 disabled:opacity-40"
        >
          ›
        </button>
        <span className="text-muted">· {PAGE_SIZE} per halaman</span>
      </div>
    </div>
  );
}
