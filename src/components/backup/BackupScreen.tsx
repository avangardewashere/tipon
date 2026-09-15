"use client";

import { useState, type ChangeEvent } from "react";
import { useWorkspace } from "@/lib/workspace/store";
import { downloadText } from "@/lib/storage/download";
import { readTextFile } from "@/lib/storage/readTextFile";
import { describeProblem, parseSaveFile } from "@/lib/storage/saveFile";
import { EXPORT_FILE_NAME, exportText, importText, keptCopies } from "@/lib/storage/workspaceStorage";
import type { Workspace } from "@/lib/workspace/types";

/** A file that has been read and checked, waiting for a yes before it replaces anything. */
type Pending = Readonly<{ text: string; workspace: Workspace; savedAt: number }>;

export function BackupScreen() {
  const { workspace, store, now, replaceWorkspace } = useWorkspace();
  const [pending, setPending] = useState<Pending | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function onPick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    setPending(null);
    setProblem(null);
    setDone(null);
    if (file === undefined) return;

    let text: string;
    try {
      text = await readTextFile(file);
    } catch {
      setProblem("That file couldn't be read from your device.");
      return;
    }

    const result = parseSaveFile(text);
    if (!result.ok) {
      setProblem(describeProblem(result.problem));
      return;
    }

    // Nothing is replaced until the summary below has been read and agreed to.
    setPending({ text, workspace: result.saveFile.workspace, savedAt: result.saveFile.savedAt });
  }

  function onReplace() {
    if (pending === null) return;

    const outcome = importText(store, pending.text, now());
    if (!outcome.ok) {
      setProblem(describeProblem(outcome.problem));
      setPending(null);
      return;
    }

    replaceWorkspace(outcome.workspace);
    setPending(null);
    setDone(
      outcome.keptAs === null
        ? "Imported. There was nothing here before."
        : `Imported. What was here before was kept as “${outcome.keptAs}”.`,
    );
  }

  const copies = keptCopies(store);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-serif text-3xl">Backup</h1>
        <p className="pt-1 text-ink-soft">
          Tipon saves to this browser only. A backup file is how your work reaches another device — and how it
          survives clearing your browsing data.
        </p>
      </header>

      <section aria-labelledby="export-heading" className="space-y-3 border-t border-rule pt-6">
        <h2 id="export-heading" className="font-serif text-xl">
          Export
        </h2>
        <p className="text-ink-soft">{summarize(workspace)} in this browser right now.</p>
        <button
          type="button"
          onClick={() => downloadText(EXPORT_FILE_NAME, exportText(workspace, now()))}
          className="border-b-2 border-highlight py-1 text-sm font-semibold"
        >
          Export a backup
        </button>
      </section>

      <section aria-labelledby="import-heading" className="space-y-3 border-t border-rule pt-6">
        <h2 id="import-heading" className="font-serif text-xl">
          Import
        </h2>
        <p className="text-ink-soft">
          Importing replaces everything in this browser. What&apos;s here now is kept as a copy first.
        </p>
        <label className="block text-sm text-ink-soft">
          <span className="block pb-1">Backup file</span>
          <input type="file" accept="application/json,.json" onChange={onPick} className="text-ink" />
        </label>

        {pending !== null && (
          <div role="group" aria-label="Confirm import" className="space-y-2 border border-rule bg-paper-raised p-4">
            <p>
              That file holds {summarize(pending.workspace)}. Replace everything in this browser with it?
            </p>
            <div className="flex gap-4">
              <button type="button" onClick={onReplace} className="border-b-2 border-highlight py-1 text-sm font-semibold">
                Replace everything
              </button>
              <button type="button" onClick={() => setPending(null)} className="py-1 text-sm text-ink-soft underline">
                Cancel
              </button>
            </div>
          </div>
        )}

        {problem !== null && (
          <p role="alert" className="text-sm text-danger">
            {problem} Nothing has changed.
          </p>
        )}
        {done !== null && (
          <p role="status" className="text-sm text-ink-soft">
            {done}
          </p>
        )}
      </section>

      {copies.length > 0 && (
        <section aria-labelledby="kept-heading" className="space-y-2 border-t border-rule pt-6">
          <h2 id="kept-heading" className="font-serif text-xl">
            Copies we kept
          </h2>
          <p className="text-ink-soft">
            Tipon never throws data away. Anything it couldn&apos;t read, and anything an import replaced, is still in
            this browser under these names.
          </p>
          <ul className="font-mono text-sm text-ink-soft">
            {copies.map((key) => (
              <li key={key}>{key}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function summarize(workspace: Workspace): string {
  return `${count(workspace.projects.length, "project")} and ${count(workspace.tasks.length, "task")}`;
}

function count(n: number, noun: string): string {
  return n === 1 ? `1 ${noun}` : `${n} ${noun}s`;
}
