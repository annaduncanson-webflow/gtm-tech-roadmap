import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = { title: "GTM Tech Roadmap", description: "Quarterly roadmap, capacity and steer-co decisions. Jira is the source of truth." };

const nav = [["/roadmap", "Roadmap"], ["/capacity", "Capacity"], ["/decisions", "Decisions"], ["/intake", "Intake"], ["/sync", "Sync"]];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-50 text-neutral-900 antialiased">
        <header className="border-b bg-white">
          <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
            <Link href="/roadmap" className="font-semibold tracking-tight">GTM Tech Roadmap</Link>
            <nav className="flex gap-4 text-sm">
              {nav.map(([href, label]) => <Link key={href} href={href} className="text-neutral-600 hover:text-neutral-900">{label}</Link>)}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
