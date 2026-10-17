import type { Role } from "./types";

// Sesi disimpan di localStorage (prototype). Semua fungsi hanya dipanggil dari client.

export interface StoredSession {
  token: string;
  email: string;
  role: Role;
  expiresAt: number;
}

const STORAGE_KEY = "helmetwatch.session";

export function getSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed.token || !parsed.email || !parsed.role) return null;
    if (parsed.expiresAt && Date.now() >= parsed.expiresAt) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function setSession(session: StoredSession): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function getToken(): string | null {
  return getSession()?.token ?? null;
}
