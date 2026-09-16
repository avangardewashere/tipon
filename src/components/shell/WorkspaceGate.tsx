"use client";

import type { ReactNode } from "react";
import { useWorkspace } from "@/lib/workspace/store";

/**
 * Holds the screens back until the saved copy has been read.
 *
 * The server has no `localStorage`, so it renders "Opening your notebook…" — and so does
 * the browser's first render, which is what keeps the two identical. Without this, the
 * first thing you'd see after a refresh is "No projects yet", replaced a moment later by
 * your actual projects.
 */
export function WorkspaceGate({ children }: Readonly<{ children: ReactNode }>) {
  const { status, notice, dismissNotice } = useWorkspace();

  return (
    <>
      {notice !== null && (
        <div role="alert" className="mb-6 border-l-2 border-danger bg-paper-raised p-4 text-sm">
          <p>{notice}</p>
          <button type="button" onClick={dismissNotice} className="pt-2 text-ink-soft underline">
            Dismiss
          </button>
        </div>
      )}
      {status === "loading" ? <p className="text-ink-soft">Opening your notebook…</p> : children}
    </>
  );
}
