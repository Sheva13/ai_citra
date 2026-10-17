"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, login } from "@/lib/api";
import { setSession } from "@/lib/session";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@helmetwatch.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await login(email.trim(), password);
      setSession({
        token: response.access_token,
        email: response.email,
        role: response.role,
        expiresAt: Date.now() + response.expires_in * 1000,
      });
      router.replace("/monitoring");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.status === 401 ? "Email atau password salah." : err.message);
      } else {
        setError("Terjadi kesalahan tak terduga.");
      }
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-10 w-full max-w-sm rounded-2xl border border-hairline bg-white p-8 shadow-card">
      <div className="mb-6 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink text-sm font-bold text-white">
          H
        </span>
        <div>
          <p className="text-sm font-semibold tracking-tight">HelmetWatch</p>
          <p className="text-[11px] uppercase tracking-widest text-muted">Masuk operator</p>
        </div>
      </div>
      <form className="space-y-2.5" onSubmit={handleSubmit}>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          type="email"
          autoComplete="username"
          required
          className="w-full rounded-lg border border-hairline px-3.5 py-2.5 text-sm focus:border-ink focus:outline-none"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          type="password"
          autoComplete="current-password"
          required
          autoFocus
          className="w-full rounded-lg border border-hairline px-3.5 py-2.5 text-sm focus:border-ink focus:outline-none"
        />
        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-[#B91C1C]">{error}</p>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          className="block w-full rounded-full bg-ink py-2.5 text-center text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Memeriksa…" : "Masuk"}
        </button>
      </form>
      <p className="mono mt-5 text-center text-[11px] text-muted">
        POST /api/auth/login · role admin / operator
      </p>
    </div>
  );
}
