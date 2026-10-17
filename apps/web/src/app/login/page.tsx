export default function LoginPage() {
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
      <div className="space-y-2.5">
        <input
          placeholder="Email"
          className="w-full rounded-lg border border-hairline px-3.5 py-2.5 text-sm focus:border-ink focus:outline-none"
        />
        <input
          placeholder="Password"
          type="password"
          className="w-full rounded-lg border border-hairline px-3.5 py-2.5 text-sm focus:border-ink focus:outline-none"
        />
        <a
          href="/monitoring"
          className="block rounded-full bg-ink py-2.5 text-center text-sm font-medium text-white hover:opacity-90"
        >
          Masuk
        </a>
      </div>
      <p className="mono mt-5 text-center text-[11px] text-muted">
        POST /api/auth/login · role admin / operator
      </p>
    </div>
  );
}
