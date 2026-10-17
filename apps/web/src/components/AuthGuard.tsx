"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getSession } from "@/lib/session";

// Guard sederhana di client: tanpa sesi → /login; sudah login tapi buka /login → /monitoring.
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/login";
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const session = getSession();
    if (!session && !isLogin) {
      router.replace("/login");
      return;
    }
    if (session && isLogin) {
      router.replace("/monitoring");
      return;
    }
    setReady(true);
  }, [pathname, isLogin, router]);

  if (isLogin) return <>{children}</>;
  if (!ready) return null;
  return <>{children}</>;
}
