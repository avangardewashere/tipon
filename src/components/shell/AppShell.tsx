"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Three places to be. On a phone they sit under your thumb; on desktop they become a left rail. */
export const NAV_ITEMS = [
  { href: "/", label: "Today" },
  { href: "/dump", label: "Dump" },
  { href: "/projects", label: "Projects" },
] as const;

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname() ?? "/";

  return (
    <div className="flex min-h-full flex-1 flex-col sm:flex-row">
      <nav
        aria-label="Main"
        className="order-2 border-t border-rule bg-paper-raised sm:order-1 sm:w-44 sm:shrink-0 sm:border-t-0 sm:border-r"
      >
        <p className="hidden px-5 pt-6 pb-4 font-serif text-2xl sm:block">Tipon</p>
        <ul className="flex sm:flex-col">
          {NAV_ITEMS.map((item) => {
            const current = isCurrent(pathname, item.href);
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={current ? "page" : undefined}
                  className={`block px-5 py-3 text-center text-sm sm:text-left ${
                    current ? "font-semibold text-ink" : "text-ink-soft"
                  }`}
                >
                  <span className={current ? "border-b-2 border-highlight pb-0.5" : undefined}>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <main className="order-1 flex-1 px-5 py-8 sm:order-2 sm:px-10">
        <div className="mx-auto w-full max-w-2xl">
          {children}
          <footer className="pt-12 text-sm text-ink-faint">
            Saved in this browser only ·{" "}
            <Link href="/backup" className="underline">
              Backup &amp; restore
            </Link>
          </footer>
        </div>
      </main>
    </div>
  );
}

/** `/projects/p-1` keeps the Projects tab marked; only `/` matches itself exactly. */
function isCurrent(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
