"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MOCK_SESSION } from "@/lib/mock";

// Segmented nav dengan oval hitam yang BERGESER (sliding pill).
// Operator: 2 item (Monitoring, Logs). Admin: 3 item (+ Cameras).
function SlidingNav({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  const activeIndex = Math.max(
    0,
    items.findIndex((it) =>
      it.href === "/logs" || it.href === "/cameras"
        ? pathname.startsWith(it.href)
        : pathname === it.href,
    ),
  );
  const n = items.length;

  return (
    <nav
      aria-label="Navigasi utama"
      className="relative grid rounded-full border border-hairline bg-paper p-1"
      style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
    >
      {/* oval hitam yang geser */}
      <span
        aria-hidden
        className="absolute bottom-1 top-1 left-1 rounded-full bg-ink transition-transform duration-300 ease-[cubic-bezier(.32,.72,0,1)]"
        style={{
          width: `calc((100% - 8px) / ${n})`,
          transform: `translateX(${activeIndex * 100}%)`,
        }}
      />
      {items.map((it, i) => {
        const active = i === activeIndex;
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={`relative z-10 rounded-full px-5 py-1.5 text-center text-sm transition-colors duration-200 ${
              active ? "font-medium text-white" : "text-muted hover:text-ink"
            }`}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function Header() {
  const role = MOCK_SESSION.role;
  const items =
    role === "admin"
      ? [
          { href: "/monitoring", label: "Monitoring" },
          { href: "/logs", label: "Logs" },
          { href: "/cameras", label: "Cameras" },
        ]
      : [
          { href: "/monitoring", label: "Monitoring" },
          { href: "/logs", label: "Logs" },
        ];

  return (
    <header className="sticky top-0 z-10 border-b border-hairline bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-5">
          <Link href="/monitoring" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-sm font-bold text-white">
              H
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-semibold tracking-tight">HelmetWatch</span>
              <span className="block text-[11px] uppercase tracking-widest text-muted">
                Prototype
              </span>
            </span>
          </Link>
          <SlidingNav items={items} />
        </div>

        <div className="flex items-center gap-3 text-sm">
          <span className="mono hidden text-[13px] text-muted sm:block" suppressHydrationWarning>
            <WibClock />
          </span>
          <details className="relative">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-hairline bg-white py-1 pl-1 pr-3 hover:border-ink/30">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">
                {role === "admin" ? "A" : "O"}
              </span>
              <span className="text-[13px] text-muted">
                {role === "admin" ? "Admin" : "Operator"} ▾
              </span>
            </summary>
            <div className="absolute right-0 mt-2 w-48 rounded-xl border border-hairline bg-white p-1.5 shadow-card">
              <p className="px-2.5 py-1.5 text-xs text-muted">{MOCK_SESSION.email}</p>
              <Link
                href="/login"
                className="block rounded-lg px-2.5 py-2 text-[13px] hover:bg-paper"
              >
                Keluar
              </Link>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}

function WibClock() {
  return (
    <>
      {new Date().toLocaleString("id-ID", {
        timeZone: "Asia/Jakarta",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })}{" "}
      WIB
    </>
  );
}
