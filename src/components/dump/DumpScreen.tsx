"use client";

import { useState } from "react";
import { ReviewSheet } from "./ReviewSheet";
import { keepEverything, toActions, type Kept } from "@/lib/dump/commit";
import { isEmptyProposal, type Proposal } from "@/lib/dump/proposal";
import { sortDump } from "@/lib/dump/sortDump";
import { ACCESS_CODE_KEY, DRAFT_KEY, useSavedText } from "@/lib/dump/useSavedText";
import { dayKeyFromDate, todayKey } from "@/lib/dates/calendar";
import { useWorkspace } from "@/lib/workspace/store";
import type { Dump } from "@/lib/workspace/types";
import type { SortOutcome } from "@/lib/dump/sortDump";

/** What was added last time, so pressing Add tells you it worked. */
type Added = Readonly<{ projects: number; tasks: number }>;

export function DumpScreen() {
  const { workspace, store, now, createId, runAll } = useWorkspace();
  const { text: draft, setText: setDraft, clearText: clearDraft } = useSavedText(store, DRAFT_KEY);
  const { text: accessCode, setText: setAccessCode } = useSavedText(store, ACCESS_CODE_KEY);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [kept, setKept] = useState<Kept>({ projectKeys: new Set(), taskKeys: new Set() });
  const [added, setAdded] = useState<Added | null>(null);
  const [sorting, setSorting] = useState(false);
  const [sortedBy, setSortedBy] = useState<SortOutcome | null>(null);

  async function onSort() {
    setAdded(null);
    setSorting(true);

    // Claude when there's an access code, the rules otherwise — and the rules again
    // whenever Claude can't help. `sortDump` decides; this screen only draws the answer.
    const outcome = await sortDump({
      text: draft,
      today: todayKey(now()),
      projects: workspace.projects,
      accessCode,
    });
    setSorting(false);

    setSortedBy(outcome);
    if (isEmptyProposal(outcome.proposal)) return;

    setProposal(outcome.proposal);
    setKept(keepEverything(outcome.proposal));
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
        source={sortedBy?.source ?? "rules"}
        problem={sortedBy?.problem ?? null}
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
            disabled={draft.trim() === "" || sorting}
            className="border-b-2 border-highlight py-1 text-sm font-semibold disabled:opacity-50"
          >
            {sorting ? "Sorting…" : "Sort it"}
          </button>
          {draft !== "" && (
            <button type="button" onClick={clearDraft} className="py-1 text-sm text-ink-soft underline">
              Clear the page
            </button>
          )}
          <span className="text-sm text-ink-faint">Kept as you type.</span>
        </div>
        {sortedBy !== null && proposal === null && sortedBy.problem !== null && (
          <p role="alert" className="text-sm text-danger">
            {sortedBy.problem}
          </p>
        )}
        {added !== null && (
          <p role="status" className="text-sm text-ink-soft">
            Added {describe(added)}.
          </p>
        )}
      </div>

      <AccessCode value={accessCode} onChange={setAccessCode} />

      {workspace.dumps.length > 0 && <DumpHistory dumps={workspace.dumps} />}
    </div>
  );
}

/**
 * Without a code, Tipon never calls the server at all — no key needed, no money spent.
 * With one, the same dump goes to Claude, and the rules wait behind it as a fallback.
 */
function AccessCode({ value, onChange }: Readonly<{ value: string; onChange: (code: string) => void }>) {
  return (
    <details className="border-t border-rule pt-4 text-sm">
      <summary className="cursor-pointer text-ink-soft">
        Sorting: {value.trim() === "" ? "rules only" : "Claude, with rules as a fallback"}
      </summary>
      <div className="space-y-2 pt-3">
        <label className="block text-ink-soft">
          <span className="block pb-1">Access code</span>
          <input
            type="password"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            autoComplete="off"
            className="w-full max-w-xs border-b border-rule bg-transparent py-1 text-base text-ink outline-none focus:border-ink"
          />
        </label>
        <p className="text-ink-faint">
          With a code, dumps are sent to Claude, which reads them better than rules can — and costs a few cents each.
          Without one, Tipon sorts everything on this device for nothing. The code is kept in this browser only.
        </p>
      </div>
    </details>
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
