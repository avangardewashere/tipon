"use client";

import { useState } from "react";
import type { Kept } from "@/lib/dump/commit";
import type { Proposal, ProposedProject, ProposedTask } from "@/lib/dump/proposal";
import { findProjectNameProblem } from "@/lib/workspace/rules";
import type { Project } from "@/lib/workspace/types";

export type ReviewSheetProps = Readonly<{
  proposal: Proposal;
  kept: Kept;
  /** Who did the sorting, so nobody has to guess whether Claude was involved. */
  source: "claude" | "rules";
  /** Why it fell back to the rules, when it did. */
  problem: string | null;
  /** Your projects, so an edited name can be checked before anything is added. */
  projects: readonly Project[];
  onToggleProject: (key: string) => void;
  onToggleTask: (key: string) => void;
  onEditProject: (key: string, name: string) => void;
  onEditTask: (key: string, changes: { title?: string; due: string | null }) => void;
  onCommit: () => void;
  onCancel: () => void;
}>;

/**
 * The middle step of **propose → review → commit**: everything the parser thinks it found,
 * with a tick beside it, before a single thing is added.
 *
 * Block 5 swaps the parser for Claude and this sheet doesn't change, which is the whole
 * reason it takes a proposal rather than text.
 */
export function ReviewSheet({
  proposal,
  kept,
  source,
  problem: sortProblem,
  projects,
  onToggleProject,
  onToggleTask,
  onEditProject,
  onEditTask,
  onCommit,
  onCancel,
}: ReviewSheetProps) {
  const problems = nameProblems(proposal, kept, projects);
  const nothingKept = kept.projectKeys.size === 0 && kept.taskKeys.size === 0;

  return (
    <section aria-labelledby="review-heading" className="space-y-6">
      <div>
        <h2 id="review-heading" className="font-serif text-2xl">
          Sort it out
        </h2>
        <p className="pt-1 text-ink-soft">
          Nothing has been added yet. Untick anything you don&apos;t want, fix what&apos;s wrong, then add the rest.
        </p>
        <p className="pt-2 text-sm text-ink-faint">
          {source === "claude" ? "Sorted by Claude." : "Sorted with rules, on this device."}
        </p>
        {sortProblem !== null && (
          <p role="alert" className="pt-1 text-sm text-danger">
            {sortProblem}
          </p>
        )}
      </div>

      {proposal.projects.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm tracking-wide text-ink-faint uppercase">Projects</h3>
          <ul className="divide-y divide-rule">
            {proposal.projects.map((project) => (
              <li key={project.key} className="py-3">
                <ProjectRow
                  project={project}
                  checked={kept.projectKeys.has(project.key)}
                  problem={problems.get(project.key) ?? null}
                  onToggle={() => onToggleProject(project.key)}
                  onEdit={(name) => onEditProject(project.key, name)}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {proposal.tasks.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm tracking-wide text-ink-faint uppercase">Tasks</h3>
          <ul className="divide-y divide-rule">
            {proposal.tasks.map((task) => (
              <li key={task.key} className="py-3">
                <TaskRow
                  task={task}
                  projectName={nameOfProject(proposal, task.projectKey, kept)}
                  checked={kept.taskKeys.has(task.key)}
                  onToggle={() => onToggleTask(task.key)}
                  onEdit={(changes) => onEditTask(task.key, changes)}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {problems.size > 0 && (
        <p role="alert" className="text-sm text-danger">
          You already have a project with that name. Change it, or untick it to put its tasks in the Inbox.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4 border-t border-rule pt-4">
        <button
          type="button"
          onClick={onCommit}
          disabled={nothingKept || problems.size > 0}
          className="border-b-2 border-highlight py-1 text-sm font-semibold disabled:opacity-50"
        >
          {addLabel(kept)}
        </button>
        <button type="button" onClick={onCancel} className="py-1 text-sm text-ink-soft underline">
          Back to writing
        </button>
      </div>
    </section>
  );
}

function ProjectRow({
  project,
  checked,
  problem,
  onToggle,
  onEdit,
}: Readonly<{
  project: ProposedProject;
  checked: boolean;
  problem: string | null;
  onToggle: () => void;
  onEdit: (name: string) => void;
}>) {
  // The name this row arrived with. Labels stay put while you edit, so a row keeps the
  // name a person (or a test) is looking for instead of renaming itself mid-keystroke.
  const [label] = useState(project.name);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <input
        type="checkbox"
        id={`keep-${project.key}`}
        checked={checked}
        onChange={onToggle}
        className="size-4 accent-[var(--highlight)]"
      />
      <label htmlFor={`keep-${project.key}`} className="sr-only">
        {`Keep project “${label}”`}
      </label>
      <input
        type="text"
        aria-label={`Project name for “${label}”`}
        value={project.name}
        aria-invalid={problem !== null}
        onChange={(event) => onEdit(event.target.value)}
        className="flex-1 basis-48 border-b border-rule bg-transparent py-1 text-ink outline-none focus:border-ink"
      />
      <span className="text-sm text-ink-soft">
        {project.existingId === null ? "new project" : project.wasArchived ? "yours, archived" : "yours"}
      </span>
    </div>
  );
}

function TaskRow({
  task,
  projectName,
  checked,
  onToggle,
  onEdit,
}: Readonly<{
  task: ProposedTask;
  projectName: string;
  checked: boolean;
  onToggle: () => void;
  onEdit: (changes: { title?: string; due: string | null }) => void;
}>) {
  // The date input wants "" for empty; the proposal uses null. One place to translate.
  const [due, setDue] = useState(task.due ?? "");
  // As above: the title this row arrived with, so its labels don't move while you type.
  const [label] = useState(task.title);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <input
        type="checkbox"
        id={`keep-${task.key}`}
        checked={checked}
        onChange={onToggle}
        className="size-4 accent-[var(--highlight)]"
      />
      <label htmlFor={`keep-${task.key}`} className="sr-only">
        {`Keep task “${label}”`}
      </label>
      <input
        type="text"
        aria-label={`Task title for “${label}”`}
        value={task.title}
        onChange={(event) => onEdit({ title: event.target.value, due: task.due })}
        className="flex-1 basis-48 border-b border-rule bg-transparent py-1 text-ink outline-none focus:border-ink"
      />
      <label className="text-sm text-ink-soft">
        <span className="sr-only">{`Due date for “${label}”`}</span>
        <input
          type="date"
          value={due}
          onChange={(event) => {
            setDue(event.target.value);
            onEdit({ due: event.target.value === "" ? null : event.target.value });
          }}
          className="border-b border-rule bg-transparent py-1 text-ink outline-none focus:border-ink"
        />
      </label>
      <span className="text-sm text-ink-faint">{projectName}</span>
    </div>
  );
}

/** What the button says, so you know what you're agreeing to before you press it. */
function addLabel(kept: Kept): string {
  const parts = [
    kept.projectKeys.size > 0 ? count(kept.projectKeys.size, "project") : null,
    kept.taskKeys.size > 0 ? count(kept.taskKeys.size, "task") : null,
  ].filter((part) => part !== null);

  return parts.length === 0 ? "Nothing ticked" : `Add ${parts.join(" and ")}`;
}

function count(n: number, noun: string): string {
  return n === 1 ? `1 ${noun}` : `${n} ${noun}s`;
}

/** A task shows where it will land, and the Inbox is where an unticked project sends it. */
function nameOfProject(proposal: Proposal, projectKey: string | null, kept: Kept): string {
  if (projectKey === null || !kept.projectKeys.has(projectKey)) return "Inbox";
  return proposal.projects.find((project) => project.key === projectKey)?.name ?? "Inbox";
}

/**
 * Edited names are checked against the projects you already have — the same rule the
 * reducer uses — because a refused name would silently send its tasks to the Inbox.
 */
function nameProblems(proposal: Proposal, kept: Kept, projects: readonly Project[]): Map<string, string> {
  const problems = new Map<string, string>();
  const takenHere = new Set<string>();

  for (const project of proposal.projects) {
    if (!kept.projectKeys.has(project.key)) continue;

    const name = project.name.trim().toLowerCase();
    // Two rows edited to the same name clash with each other, not with anything saved.
    const problem = takenHere.has(name)
      ? "taken"
      : findProjectNameProblem(projects, project.name, project.existingId ?? undefined);

    if (problem === null) {
      takenHere.add(name);
    } else {
      problems.set(project.key, problem);
    }
  }

  return problems;
}
