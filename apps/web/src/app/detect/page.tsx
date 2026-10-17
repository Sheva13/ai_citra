"use client";

import { useRef, useState } from "react";
import { ApiError, detectImage, detectVideo, detectVideoUrl } from "@/lib/api";
import type { ImageDetectResult, UploadDetection, VideoDetectResult } from "@/lib/types";

type Mode = "image" | "video";

export default function DetectPage() {
  const [mode, setMode] = useState<Mode>("image");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Deteksi upload</h1>
        <p className="mt-1 text-sm text-muted">
          Unggah gambar atau video untuk diuji dengan model yang sedang aktif — hasil anotasi
          tampil langsung. Output adalah indikasi untuk ditinjau, bukan keputusan otomatis.
        </p>
      </div>

      <div className="grid max-w-md grid-cols-2 gap-2 rounded-full border border-hairline bg-paper p-1 text-sm">
        <button
          type="button"
          onClick={() => setMode("image")}
          className={`rounded-full px-3 py-2 font-medium ${
            mode === "image" ? "bg-ink text-white" : "text-muted hover:text-ink"
          }`}
        >
          Gambar
        </button>
        <button
          type="button"
          onClick={() => setMode("video")}
          className={`rounded-full px-3 py-2 font-medium ${
            mode === "video" ? "bg-ink text-white" : "text-muted hover:text-ink"
          }`}
        >
          Video
        </button>
      </div>

      {mode === "image" ? <ImageMode /> : <VideoMode />}
    </div>
  );
}

function ImageMode() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImageDetectResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDetect() {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await detectImage(file));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal memproses gambar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="max-w-xl space-y-2.5 rounded-xl border border-hairline bg-white p-6 shadow-card">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">
          Pilih gambar
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/bmp,image/tiff"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setResult(null);
          }}
          className="block w-full cursor-pointer rounded-lg border border-dashed border-hairline px-3.5 py-3 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-ink file:px-4 file:py-1.5 file:text-xs file:font-medium file:text-white hover:border-ink/40"
        />
        <p className="text-xs text-muted">JPG / PNG / WEBP · maksimal 10 MB</p>
        <button
          type="button"
          disabled={!file || busy}
          onClick={handleDetect}
          className="w-full rounded-full bg-ink py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Mendeteksi…" : "Deteksi gambar"}
        </button>
        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-[#B91C1C]">{error}</p>
        ) : null}
      </div>

      {result ? (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <div className="viewfinder overflow-hidden rounded-xl border border-hairline bg-black shadow-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:${result.media_type};base64,${result.image_base64}`}
              alt="Hasil anotasi deteksi"
              className="w-full object-contain"
            />
          </div>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <CountChip label="no_helmet" count={result.no_helmet_count} tone="danger" />
              <CountChip label="helmet" count={result.helmet_count} tone="ok" />
            </div>
            <div className="mono flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-muted">
              <span>
                Model <strong className="text-ink">{result.model_version}</strong>
              </span>
              <span>
                Inferensi{" "}
                <strong className="text-ink">{result.duration_ms.toFixed(0)} ms</strong>
              </span>
              <span>
                Resolusi{" "}
                <strong className="text-ink">
                  {result.width}×{result.height}
                </strong>
              </span>
            </div>
            <DetectionList detections={result.detections} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function VideoMode() {
  const [file, setFile] = useState<File | null>(null);
  const [stride, setStride] = useState(5);
  const [result, setResult] = useState<VideoDetectResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDetect() {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await detectVideo(file, stride));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal memproses video");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="max-w-xl space-y-2.5 rounded-xl border border-hairline bg-white p-6 shadow-card">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">
          Pilih video
        </p>
        <input
          type="file"
          accept="video/mp4,video/quicktime,video/x-msvideo,video/webm,video/x-matroska"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setResult(null);
          }}
          className="block w-full cursor-pointer rounded-lg border border-dashed border-hairline px-3.5 py-3 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-ink file:px-4 file:py-1.5 file:text-xs file:font-medium file:text-white hover:border-ink/40"
        />
        <p className="text-xs text-muted">
          MP4 / MOV / AVI / MKV / WEBM · maksimal 150 MB · diproses di CPU, video pendek lebih
          cepat
        </p>
        <label className="flex items-center justify-between text-sm">
          <span className="text-muted">Interval frame (stride)</span>
          <select
            value={stride}
            onChange={(event) => setStride(Number(event.target.value))}
            className="rounded-full border border-hairline bg-white px-3.5 py-1.5"
          >
            <option value={1}>tiap frame (paling akurat, lambat)</option>
            <option value={3}>1 dari 3 frame</option>
            <option value={5}>1 dari 5 frame (seimbang)</option>
            <option value={10}>1 dari 10 frame (cepat)</option>
          </select>
        </label>
        <button
          type="button"
          disabled={!file || busy}
          onClick={handleDetect}
          className="w-full rounded-full bg-ink py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Memproses video… (bisa puluhan detik)" : "Deteksi video"}
        </button>
        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-[#B91C1C]">{error}</p>
        ) : null}
      </div>

      {result ? (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <video
              key={result.video_id}
              controls
              src={detectVideoUrl(result.video_id)}
              className="viewfinder w-full rounded-xl border border-hairline bg-black shadow-card"
            />
            <p className="mono text-center text-[12px] text-muted">
              hasil anotasi · video diproses tiap {result.stride} frame
            </p>
          </div>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <CountChip
                label="frame no_helmet"
                count={result.frames_with_no_helmet}
                tone="danger"
              />
              <CountChip
                label="frame helmet"
                count={result.frames_with_helmet}
                tone="ok"
              />
            </div>
            <div className="mono flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-muted">
              <span>
                Model <strong className="text-ink">{result.model_version}</strong>
              </span>
              <span>
                Proses <strong className="text-ink">{result.duration_ms.toFixed(0)} ms</strong>
              </span>
              <span>
                Frame{" "}
                <strong className="text-ink">
                  {result.frames_processed}
                  {result.frames_total ? ` / ${result.frames_total}` : ""}
                </strong>
              </span>
              {result.video_duration_sec ? (
                <span>
                  Durasi{" "}
                  <strong className="text-ink">{formatSec(result.video_duration_sec)}</strong>
                </span>
              ) : null}
              {result.peak_no_helmet ? (
                <span>
                  Puncak no_helmet{" "}
                  <strong className="text-ink">
                    {result.peak_no_helmet.confidence.toFixed(2)} @{" "}
                    {formatSec(result.peak_no_helmet.time_sec)}
                  </strong>
                </span>
              ) : null}
            </div>

            {result.timeline.length === 0 ? (
              <p className="rounded-lg bg-paper px-3 py-4 text-center text-[13px] text-muted">
                Tidak ada deteksi pada video ini.
              </p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-hairline bg-white shadow-card">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-hairline text-[11px] uppercase tracking-widest text-muted">
                      <th className="px-4 py-2.5 font-semibold">Waktu</th>
                      <th className="px-4 py-2.5 font-semibold">Deteksi</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Conf</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {result.timeline.map((entry) => (
                      <tr key={`${entry.time_sec}-${entry.top_class}`}>
                        <td className="mono px-4 py-2.5 text-[13px] text-muted">
                          {formatSec(entry.time_sec)}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="flex flex-wrap gap-1.5">
                            {entry.no_helmet > 0 ? (
                              <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-[#B91C1C] ring-1 ring-inset ring-red-100">
                                no_helmet × {entry.no_helmet}
                              </span>
                            ) : null}
                            {entry.helmet > 0 ? (
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-[#047857] ring-1 ring-inset ring-emerald-200">
                                helmet × {entry.helmet}
                              </span>
                            ) : null}
                          </span>
                        </td>
                        <td className="mono px-4 py-2.5 text-right text-[13px]">
                          {entry.top_confidence.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DetectionList({ detections }: { detections: UploadDetection[] }) {
  if (detections.length === 0) {
    return (
      <p className="rounded-lg bg-paper px-3 py-4 text-center text-[13px] text-muted">
        Tidak ada deteksi pada gambar ini.
      </p>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-white shadow-card">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-hairline text-[11px] uppercase tracking-widest text-muted">
            <th className="px-4 py-2.5 font-semibold">Kelas</th>
            <th className="px-4 py-2.5 font-semibold">BBox</th>
            <th className="px-4 py-2.5 text-right font-semibold">Conf</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {detections.map((d, index) => (
            <tr key={`${d.class_name}-${index}`}>
              <td className="px-4 py-2.5">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                    d.class_name === "no_helmet"
                      ? "bg-red-50 text-[#B91C1C] ring-red-100"
                      : "bg-emerald-50 text-[#047857] ring-emerald-200"
                  }`}
                >
                  {d.class_name}
                </span>
              </td>
              <td className="mono px-4 py-2.5 text-[12px] text-muted">
                {d.bbox.x1},{d.bbox.y1} → {d.bbox.x2},{d.bbox.y2}
              </td>
              <td className="mono px-4 py-2.5 text-right text-[13px]">
                {d.confidence.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CountChip({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: "danger" | "ok";
}) {
  const toneClass =
    tone === "danger"
      ? "bg-red-50 text-[#B91C1C] ring-red-100"
      : "bg-emerald-50 text-[#047857] ring-emerald-200";
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 ring-inset ${toneClass}`}
    >
      {label}
      <span className="mono">{count}</span>
    </span>
  );
}

function formatSec(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}
