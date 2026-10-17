import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";

export const metadata: Metadata = { title: "HelmetWatch" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <Header />
        <main className="mx-auto w-full max-w-7xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
