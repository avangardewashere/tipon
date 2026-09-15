"use client";

import { useState } from "react";
import { ReviewSheet } from "./ReviewSheet";
import { keepEverything, toActions, type Kept } from "@/lib/dump/commit";
import { isEmptyProposal, type Proposal } from "@/lib/dump/proposal";
import { parseDump } from "@/lib/dump/quickParser";
import { useDraft } from "@/lib/dump/useDraft";
import { dayKeyFromDate, todayKey } from "@/lib/dates/calendar";
import { useWorkspace } from "@/lib/workspace/store";
import type { Dump } from "@/lib/workspace/types";

/** What was added last time, so pressing Add tells you it worked. */
type Added = Readonly<{ projects: number; tasks: number }>;

export function DumpScreen() {
  const { workspace, store, now, createId, runAll } = useWorkspace();
  const { draft, setDraft, clearDraft } = useDraft(store);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [kept, setKept] = useState<Kept>({ projectKeys: new Set(), taskKeys: new Set() });
  const [added, setAdded] = useState<Added | null>(null);

  function onSort() {
    const found = parseDump(draft, { today: todayKey(now()), projects: workspace.projects });
    setAdded(null);
    if (isEmptyProposal(found)) return;

    setProposal(found);
    setKept(keepEverything(found));
  }

  function onCommit() {
    if (proposal === null) return;

    const actions = toActions(proposal, kept, { text: draft, createId, now: now() });
    runAll(actions);

    setAdded({
      projects: actions.filter((action) => action.type === "project/add").length,
      tasks: actions.filter((action) => action.type === "task/add").length,
    });
    setProposal(null);
    clearDraft();
  }

  if (proposal !== null) {
    return (
      <ReviewSheet
        proposal={proposal}
        kept={kept}
        projects={workspace.projects}
        onToggleProject={(key) => setKept((current) => ({ ...current, projectKeys: toggle(current.projectKeys, key) }))}
        onToggleTask={(key) => setKept((current) => ({ ...current, taskKeys: toggle(current.taskKeys, key) }))}
        onEditProject={(key, name) =>
          setProposal((current) =>
            current === null
              ? current
              : {
                  ...current,
                  projects: current.projects.map((project) => (project.key === key ? { ...project, name } : project)),
                },
          )
        }
        onEditTask={(key, changes) =>
          setProposal((current) =>
            current === null
              ? current
              : {
                  ...current,
                  tasks: current.tasks.map((task) => (task.key === key ? { ...task, ...changes } : task)),
                },
          )
        }
        onCommit={onCommit}
        onCancel={() => setProposal(null)}
      />
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-serif text-3xl">Dump</h1>
        <p className="pt-1 text-ink-soft">
          Write everything down, one thing per line. A line ending in <code>:</code> starts a project. Press{" "}
          <strong>Sort it</strong> and check what it found before anything is added.
        </p>
      </header>

      <div className="space-y-3">
        <label htmlFor="dump-text" className="sr-only">
          Your dump
        </label>
        <textarea
          id="dump-text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={12}
          placeholder={"call the bank tomorrow\nWebsite relaunch:\n- pick a hosting plan fri\n- write the about page"}
          className="ruled w-full resize-y bg-paper-raised px-3 py-0 text-ink outline-none placeholder:text-ink-faint"
        />
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={onSort}
            disabled={draft.trim() === ""}
            className="border-b-2 border-highlight py-1 text-sm font-semibold disabled:opacity-50"
          >
            Sort it
          </button>
          {draft !== "" && (
            <button type="button" onClick={clearDraft} className="py-1 text-sm text-ink-soft underline">
              Clear the page
            </button>
          )}
          <span className="text-sm text-ink-faint">Kept as you type.</span>
        </div>
        {added !== null && (
          <p role="status" className="text-sm text-ink-soft">
            Added {describe(added)}.
          </p>
        )}
      </div>

      {workspace.dumps.length > 0 && <DumpHistory dumps={workspace.dumps} />}
    </div>
  );
}

function DumpHistory({ dumps }: Readonly<{ dumps: readonly Dump[] }>) {
  // Newest first: the last thing you wrote is the one you want to look back at.
  const recent = [...dumps].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <section aria-labelledby="history-heading" className="space-y-3 border-t border-rule pt-6">
      <h2 id="history-heading" className="font-serif text-xl">
        Earlier dumps
      </h2>
      <ul className="space-y-4">
        {recent.map((dump) => (
          <li key={dump.id} className="space-y-1">
            <p className="text-sm text-ink-faint">
              {dayKeyFromDate(new Date(dump.createdAt))} · added{" "}
              {describe({ projects: dump.projectIds.length, tasks: dump.taskIds.length })}
            </p>
            <p className="whitespace-pre-wrap text-ink-soft">{dump.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function describe({ projects, tasks }: Added): string {
  const parts = [
    projects > 0 ? count(projects, "project") : null,
    tasks > 0 ? count(tasks, "task") : null,
  ].filter((part) => part !== null);

  return parts.length === 0 ? "nothing" : parts.join(" and ");
}

function count(n: number, noun: string): string {
  return n === 1 ? `1 ${noun}` : `${n} ${noun}s`;
}

function toggle(keys: ReadonlySet<string>, key: string): ReadonlySet<string> {
  const next = new Set(keys);
  if (!next.delete(key)) next.add(key);
  return next;
}
