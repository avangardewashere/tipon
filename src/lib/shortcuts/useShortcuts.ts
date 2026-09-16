"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { shortcutFor } from "./shortcuts";

/** Listens for the keys in `SHORTCUTS` and goes there. Mounted once, in the app shell. */
export function useShortcuts(): void {
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const shortcut = shortcutFor(event);
      if (shortcut === null) return;

      event.preventDefault();
      router.push(shortcut.href);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [router]);
}
