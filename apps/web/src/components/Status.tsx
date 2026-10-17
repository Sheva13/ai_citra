import type { CameraStatus, ReviewStatus } from "@/lib/types";

const DOT: Record<CameraStatus, string> = {
  online: "bg-[#059669]",
  offline: "bg-[#DC2626]",
  error: "bg-[#DC2626]",
  reconnecting: "bg-[#D97706]",
};

export function CameraStatusBadge({ status }: { status: CameraStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      <span className={`h-2 w-2 rounded-full ${DOT[status]}`} />
      <span className="capitalize text-ink">{status}</span>
    </span>
  );
}

const PILL: Record<ReviewStatus, string> = {
  pending: "bg-amber-50 text-[#B45309] ring-amber-200",
  confirmed: "bg-emerald-50 text-[#047857] ring-emerald-200",
  false_positive: "bg-slate-100 text-slate-600 ring-slate-200",
};

export function ReviewPill({ status }: { status: ReviewStatus }) {
  const label = status === "false_positive" ? "false positive" : status;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${PILL[status]}`}
    >
      {label}
    </span>
  );
}
