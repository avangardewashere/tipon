"use client";

import { useEffect, useRef } from "react";
import { askForDurableStorage, DURABLE_ASKED_KEY } from "@/lib/storage/durability";
import { useWorkspace } from "@/lib/workspace/store";

/**
 * Asks the browser, once, to keep Tipon's storage rather than evicting it.
 *
 * Draws nothing: it only runs an effect. The asking is silent — there is no good way to
 * explain a permission the browser may decide on its own, and nothing the person needs to
 * do about a refusal that "keep a backup" doesn't already cover.
 */
export function KeepMyNotebook() {
  const { store } = useWorkspace();
  // StrictMode runs effects twice in development, and this one must not ask twice.
  const asked = useRef(false);

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;

    try {
      if (store.read(DURABLE_ASKED_KEY) !== null) return;
    } catch {
      // A store that can't be read can't remember we asked, so don't ask at all:
      // better one missed request than a prompt on every single visit.
      return;
    }

    void askForDurableStorage(globalThis.navigator?.storage).then((outcome) => {
      if (outcome === "unsupported") return;
      try {
        store.write(DURABLE_ASKED_KEY, outcome);
      } catch {
        // Out of room, or storage is off. Either way there is nothing to do here.
      }
    });
  }, [store]);

  return null;
}
