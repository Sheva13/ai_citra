"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ReviewPill } from "@/components/Status";
import { ApiError, getEvent, reviewEvent, snapshotUrl } from "@/lib/api";
import { formatWib } from "@/lib/format";
import type { EventDetail, ReviewStatus } from "@/lib/types";

export default function LogDetailPage({ params }: { params: { id: string } }) {
  const eventId = params.id;
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"annotated" | "original">("annotated");
  const [verdict, setVerdict] = useState<Exclude<ReviewStatus, "pending">>("confirmed");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getEvent(eventId);
      setDetail(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 404
          ? "Kejadian tidak ditemukan."
          : err instanceof ApiError
            ? err.message
            : "Gagal memuat detail kejadian",
      );
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setImageFailed(false);
  }, [tab]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (saving || !detail) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      await reviewEvent(detail.event_id, verdict, notes);
      await load();
      setNotes("");
      setSaveMessage("Review tersimpan.");
    } catch (err) {
      setSaveMessage(
        err instanceof ApiError ? err.message : "Gagal menyimpan review",
      );
    } finally {
      setSaving(false);
    }
  }

  if (error) {
    return (
      <div className="space-y-5">
        <Link href="/logs" className="text-sm font-medium text-muted hover:text-ink">
          ← Kembali ke logs
        </Link>
        <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-[#B91C1C]">
          {error}
        </p>
      </div>
    );
  }

  if (!detail) {
    return <p className="py-16 text-center text-sm text-muted">Memuat detail…</p>;
  }

  const topDetection = detail.detections[0] ?? null;
  const annotatedAvailable = detail.snapshot_status === "ok";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/logs" className="text-sm font-medium text-muted hover:text-ink">
          ← Kembali ke logs
        </Link>
        <ReviewPill status={detail.review_status} />
      </div>

      <h1 className="mono text-lg font-semibold tracking-tight">{detail.event_id}</h1>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div
          className="signal-card overflow-hidden shadow-card"
          style={{ ["--signal" as string]: "#DC2626" }}
        >
          <div className="flex gap-1 border-b border-hairline px-4 pt-3 text-sm">
            <button
              type="button"
              onClick={() => setTab("annotated")}
              className={`px-2 pb-2 ${
                tab === "annotated"
                  ? "border-b-2 border-ink font-medium"
                  : "text-muted hover:text-ink"
              }`}
            >
              Beranotasi
            </button>
            <button
              type="button"
              onClick={() => setTab("original")}
              className={`px-2 pb-2 ${
                tab === "original"
                  ? "border-b-2 border-ink font-medium"
                  : "text-muted hover:text-ink"
              }`}
            >
              Asli
            </button>
          </div>
          {annotatedAvailable && !imageFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={tab}
              src={snapshotUrl(detail.event_id, tab)}
              alt={`Snapshot ${tab} ${detail.event_id}`}
              className="viewfinder aspect-video w-full bg-black object-contain"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <div className="viewfinder flex aspect-video items-center justify-center bg-paper text-sm text-muted">
              {detail.snapshot_status === "failed"
                ? "Snapshot gagal disimpan saat kejadian."
                : "Snapshot tidak dapat dimuat."}
            </div>
          )}
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
                  {formatWib(detail.detected_at)} WIB
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Kamera</dt>
                <dd className="text-right font-medium">
                  {detail.camera.name} · {detail.camera.location}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Kelas</dt>
                <dd>
                  <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-[#B91C1C] ring-1 ring-inset ring-red-100">
                    {detail.event_type} ·{" "}
                    {topDetection ? topDetection.confidence.toFixed(2) : "—"}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Model</dt>
                <dd className="mono text-[13px]">{detail.model_version ?? "—"}</dd>
              </div>
            </div>

            {detail.detections.length > 0 ? (
              <div className="mt-5 border-t border-hairline pt-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted">
                  Deteksi
                </p>
                <ul className="space-y-1.5">
                  {detail.detections.map((d) => (
                    <li
                      key={d.id}
                      className="mono flex justify-between text-[13px] text-muted"
                    >
                      <span>
                        {d.class_name} · track {d.track_id}
                      </span>
                      <span className="text-ink">{d.confidence.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </dl>

          <form
            className="rounded-xl border border-hairline bg-white p-6 shadow-card"
            onSubmit={handleSubmit}
          >
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted">
              Review · operator & admin
            </p>
            <div className="grid grid-cols-2 gap-2 rounded-full border border-hairline bg-paper p-1 text-sm">
              <button
                type="button"
                onClick={() => setVerdict("confirmed")}
                className={`rounded-full px-3 py-2 font-medium ${
                  verdict === "confirmed" ? "bg-ink text-white" : "text-muted hover:text-ink"
                }`}
              >
                Confirmed
              </button>
              <button
                type="button"
                onClick={() => setVerdict("false_positive")}
                className={`rounded-full px-3 py-2 font-medium ${
                  verdict === "false_positive"
                    ? "bg-ink text-white"
                    : "text-muted hover:text-ink"
                }`}
              >
                False positive
              </button>
            </div>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan (opsional)"
              className="mt-3 w-full rounded-lg border border-hairline bg-white px-3.5 py-2.5 text-sm placeholder:text-muted/70 focus:border-ink focus:outline-none"
            />
            <button
              type="submit"
              disabled={saving}
              className="mt-3 w-full rounded-full bg-ink py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {saving ? "Menyimpan…" : "Simpan review"}
            </button>
            {saveMessage ? (
              <p className="mt-2 text-center text-[13px] text-muted">{saveMessage}</p>
            ) : null}
          </form>

          {detail.reviews.length > 0 ? (
            <div className="rounded-xl border border-hairline bg-white p-6 shadow-card">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted">
                Riwayat review
              </p>
              <ul className="divide-y divide-hairline text-sm">
                {detail.reviews.map((review) => (
                  <li key={review.id} className="py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium capitalize">
                        {review.verdict === "false_positive"
                          ? "False positive"
                          : review.verdict}
                      </span>
                      <span className="mono text-xs text-muted">
                        {formatWib(review.reviewed_at)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      {review.reviewed_by}
                      {review.notes ? ` · ${review.notes}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
