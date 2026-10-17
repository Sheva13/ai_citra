"use client";

import { useEffect, useMemo, useState } from "react";
import { streamUrl } from "@/lib/api";
import { formatWib } from "@/lib/format";
import type { Camera } from "@/lib/types";

// Live feed MJPEG lewat proxy API. onError → placeholder sampai status berubah.
export default function LiveFeed({ camera }: { camera: Camera }) {
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const src = useMemo(() => streamUrl(camera.id), [camera.id, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setFailed(false);
    setReloadKey((key) => key + 1);
  }, [camera.id]);

  useEffect(() => {
    if (camera.status === "online" && failed) {
      const timer = window.setTimeout(() => {
        setFailed(false);
        setReloadKey((key) => key + 1);
      }, 3000);
      return () => window.clearTimeout(timer);
    }
  }, [camera.status, failed]);

  const showPlaceholder =
    camera.status === "offline" || camera.status === "error" || failed;

  if (showPlaceholder) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-hairline bg-white text-sm">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-paper text-muted">
          ○
        </span>
        <p className="font-medium">
          {camera.status === "error" ? "Kamera bermasalah" : "Tidak ada sinyal"}
        </p>
        <p className="mono text-xs text-muted">
          {camera.error_message ?? `last seen · ${formatWib(camera.last_seen_at)}`}
        </p>
        <button
          type="button"
          onClick={() => {
            setFailed(false);
            setReloadKey((key) => key + 1);
          }}
          className="mt-1 rounded-full border border-hairline px-3.5 py-1 text-xs font-medium hover:border-ink/40"
        >
          Coba lagi
        </button>
      </div>
    );
  }

  return (
    <div className="viewfinder relative aspect-video w-full overflow-hidden rounded-xl border border-hairline bg-black shadow-card">
      <span className="absolute left-3 top-3 z-10 h-4 w-4 rounded-tl border-l-2 border-t-2 border-white/60" />
      <span className="absolute right-3 top-3 z-10 h-4 w-4 rounded-tr border-r-2 border-t-2 border-white/60" />
      <span className="absolute bottom-3 left-3 z-10 h-4 w-4 rounded-bl border-b-2 border-l-2 border-white/60" />
      <span className="absolute bottom-3 right-3 z-10 h-4 w-4 rounded-br border-b-2 border-r-2 border-white/60" />

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={`${camera.id}-${reloadKey}`}
        src={src}
        alt={`Live feed ${camera.name}`}
        className="h-full w-full object-contain"
        onError={() => setFailed(true)}
      />

      <span className="mono absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-ink/85 px-3 py-1 text-[11px] text-white">
        ● LIVE · {camera.location}
      </span>
    </div>
  );
}
