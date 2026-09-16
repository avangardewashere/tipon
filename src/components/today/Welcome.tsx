"use client";

import Link from "next/link";
import { useWorkspace } from "@/lib/workspace/store";
import { useSavedText, WELCOME_KEY } from "@/lib/dump/useSavedText";

/**
 * The first thing a new person sees, and only then.
 *
 * It goes away by itself once there's anything in the workspace, so it can't become
 * furniture, and "Got it" is remembered per browser for anyone who wants it gone sooner.
 */
export function Welcome() {
  const { workspace, store, status } = useWorkspace();
  const { text: dismissed, setText: dismiss } = useSavedText(store, WELCOME_KEY);

  const empty =
    workspace.projects.length === 0 && workspace.tasks.length === 0 && workspace.dumps.length === 0;
  if (status !== "ready" || !empty || dismissed !== "") return null;

  return (
    <section aria-labelledby="welcome-heading" className="space-y-3 border border-rule bg-paper-raised p-5">
      <h2 id="welcome-heading" className="font-serif text-xl">
        Welcome to Tipon
      </h2>
      <p className="text-ink-soft">
        <em>Tipon</em> is Tagalog for <em>to gather</em>. Write everything down in one go, and it becomes projects
        and tasks you can actually act on.
      </p>
      <ol className="list-decimal space-y-1 pl-5 text-ink-soft">
        <li>
          <Link href="/dump" className="underline">
            Dump
          </Link>{" "}
          whatever is on your mind — one thing per line, a line ending in <code>:</code> starts a project.
        </li>
        <li>Check what it found. Nothing is added until you say so.</li>
        <li>Come back here tomorrow for what&apos;s due.</li>
      </ol>
      <p className="text-sm text-ink-faint">
        Everything stays in this browser.{" "}
        <Link href="/backup" className="underline">
          Export a backup
        </Link>{" "}
        to move it to another device — or before you clear your browsing data.
      </p>
      <button type="button" onClick={() => dismiss("done")} className="text-sm text-ink-soft underline">
        Got it
      </button>
    </section>
  );
}
