"use client";

import { useServiceWorker } from "@/lib/offline/useServiceWorker";

/**
 * One quiet line in the footer when a newer Tipon is ready, and a button to take it.
 *
 * It waits for a click on purpose. A service worker that swapped itself in would change
 * the app out from under whatever you were typing.
 */
export function NewVersionNotice() {
  const { updateReady, applyUpdate } = useServiceWorker({
    reload: () => globalThis.location?.reload(),
  });

  if (!updateReady) return null;

  return (
    <p role="status">
      There&apos;s a newer version of Tipon.{" "}
      <button type="button" onClick={applyUpdate} className="border-b-2 border-highlight font-semibold text-ink">
        Reload to use it
      </button>
    </p>
  );
}
