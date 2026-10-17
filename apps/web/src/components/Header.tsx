"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearSession, getSession } from "@/lib/session";
import type { Role } from "@/lib/types";

// Nav utama: Monitoring, Logs, Deteksi (upload gambar/video) — /cameras via menu user admin.
const NAV_ITEMS = [
  { href: "/monitoring", label: "Monitoring" },
  { href: "/logs", label: "Logs" },
  { href: "/detect", label: "Deteksi" },
];

function SlidingNav({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  const activeIndex = Math.max(
    0,
    items.findIndex((it) => pathname.startsWith(it.href)),
  );
  const n = items.length;

  return (
    <nav
      aria-label="Navigasi utama"
      className="relative grid rounded-full border border-hairline bg-paper p-1"
      style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
    >
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
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSessionState] = useState<{ email: string; role: Role } | null>(null);
  const isLoginPage = pathname === "/login";

  useEffect(() => {
    const stored = getSession();
    setSessionState(stored ? { email: stored.email, role: stored.role } : null);
  }, [pathname]);

  function handleLogout() {
    clearSession();
    router.replace("/login");
  }

  const role = session?.role;

  return (
    <header className="sticky top-0 z-10 border-b border-hairline bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-5">
          <Link href={session ? "/monitoring" : "/login"} className="flex items-center gap-2.5">
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
          {session && !isLoginPage ? <SlidingNav items={NAV_ITEMS} /> : null}
        </div>

        <div className="flex items-center gap-3 text-sm">
          <span className="mono hidden text-[13px] text-muted sm:block">
            <WibClock />
          </span>
          {session ? (
            <details className="relative">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-hairline bg-white py-1 pl-1 pr-3 hover:border-ink/30">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">
                  {role === "admin" ? "A" : "O"}
                </span>
                <span className="text-[13px] text-muted">
                  {role === "admin" ? "Admin" : "Operator"} ▾
                </span>
              </summary>
              <div className="absolute right-0 mt-2 w-52 rounded-xl border border-hairline bg-white p-1.5 shadow-card">
                <p className="truncate px-2.5 py-1.5 text-xs text-muted">{session.email}</p>
                {role === "admin" ? (
                  <Link
                    href="/cameras"
                    className="block rounded-lg px-2.5 py-2 text-[13px] hover:bg-paper"
                  >
                    Kelola kamera
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="block w-full rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-paper"
                >
                  Keluar
                </button>
              </div>
            </details>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function WibClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!now) return <>&nbsp;</>;
  return (
    <>
      {now.toLocaleString("id-ID", {
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
