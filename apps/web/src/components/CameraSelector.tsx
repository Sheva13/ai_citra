import type { Camera } from "@/lib/types";
import { CameraStatusBadge } from "./Status";

// Selector kamera di BODY /monitoring — bukan di header.
export default function CameraSelector({
  cameras,
  activeId,
}: {
  cameras: Camera[];
  activeId: string;
}) {
  return (
    <section aria-label="Pilih kamera">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted">
        Kamera · {cameras.length} terdaftar
      </p>
      <div className="flex flex-wrap gap-2.5">
        {cameras.map((c) => {
          const active = c.id === activeId;
          return (
            <a
              key={c.id}
              href={`/monitoring?camera=${c.id}`}
              aria-current={active ? "true" : undefined}
              className={`group flex min-w-[220px] items-center justify-between gap-4 rounded-xl border bg-white px-4 py-3 shadow-card transition-colors ${
                active ? "border-ink" : "border-hairline hover:border-ink/40"
              }`}
            >
              <span>
                <span className="block text-sm font-semibold tracking-tight">
                  {c.name}
                  <span className="ml-2 font-normal text-muted">{c.location}</span>
                </span>
                <span className="mt-1 block">
                  <CameraStatusBadge status={c.status} />
                </span>
              </span>
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  active ? "bg-ink text-white" : "bg-paper text-muted group-hover:text-ink"
                }`}
              >
                →
              </span>
            </a>
          );
        })}
      </div>
    </section>
  );
}
