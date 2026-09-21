"use client";

import { useOffline } from "next/offline";

/**
 * One line, only when there's no network.
 *
 * Deliberately reassuring rather than alarming: Tipon's notebook lives on this device, so
 * being offline costs you exactly one feature. Saying "you are offline" and nothing else
 * would imply the app is broken, which it isn't.
 */
export function OfflineBanner() {
  const offline = useOffline();

  if (!offline) return null;

  return (
    <p role="status" className="border-b border-rule bg-paper-raised px-4 py-2 text-sm text-ink-soft">
      No signal. Everything here still works — your notebook is on this device. Only sorting with
      Claude needs a connection.
    </p>
  );
}
