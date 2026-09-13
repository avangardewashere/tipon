"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useWorkspace } from "@/lib/workspace/store";
import { findProject, tasksIn } from "@/lib/workspace/selectors";
import { findProjectNameProblem, type ProjectNameProblem } from "@/lib/workspace/rules";
import type { Project } from "@/lib/workspace/types";
import { AddTaskForm } from "@/components/tasks/AddTaskForm";
import { TaskList } from "@/components/tasks/TaskList";
import { nameProblemMessage } from "./ProjectsScreen";

export function ProjectScreen({ projectId }: Readonly<{ projectId: string }>) {
  const { workspace, run } = useWorkspace();
  const project = findProject(workspace, projectId);

  if (project === null) {
    return (
      <div className="space-y-3">
        <h1 className="font-serif text-3xl">Project not found</h1>
        <p className="text-ink-soft">
          This project isn&apos;t in your workspace. In Block 2 a refresh empties it, because nothing is saved yet.
        </p>
        <Link href="/projects" className="underline">
          Back to projects
        </Link>
      </div>
    );
  }

  const archived = project.status === "archived";
  const tasks = tasksIn(workspace, project.id);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <Link href="/projects" className="text-sm text-ink-soft underline">
          Back to projects
        </Link>
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="font-serif text-3xl">{project.name}</h1>
          {archived && <span className="text-sm text-ink-soft">Archived</span>}
        </div>
        <div className="flex gap-4">
          <RenameProject project={project} />
          <button
            type="button"
            onClick={() => run({ type: archived ? "project/unarchive" : "project/archive", id: project.id })}
            className="text-sm text-ink-soft underline"
          >
            {archived ? "Unarchive project" : "Archive project"}
          </button>
        </div>
      </header>

      <section className="space-y-2">
        <h2 className="font-serif text-xl">Notes</h2>
        <label htmlFor="project-notes" className="sr-only">
          Notes
        </label>
        <textarea
          id="project-notes"
          value={project.notes}
          onChange={(event) => run({ type: "project/edit", id: project.id, changes: { notes: event.target.value } })}
          rows={5}
          placeholder="What is this project about? Anything you'd have to remember."
          className="ruled w-full resize-y bg-paper-raised px-3 py-0 text-ink outline-none placeholder:text-ink-faint"
        />
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-xl">Tasks</h2>
        {archived && <p className="text-sm text-ink-soft">Archived projects take no new tasks. Unarchive to add one.</p>}
        <AddTaskForm projectId={project.id} disabled={archived} />
        <TaskList tasks={tasks} emptyMessage="No tasks here yet." />
      </section>
    </div>
  );
}

function RenameProject({ project }: Readonly<{ project: Project }>) {
  const { workspace, run } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(project.name);
  const [problem, setProblem] = useState<ProjectNameProblem | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setName(project.name);
          setProblem(null);
          setOpen(true);
        }}
        className="text-sm text-ink-soft underline"
      >
        Rename project
      </button>
    );
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const found = findProjectNameProblem(workspace.projects, name, project.id);
    setProblem(found);
    if (found !== null) return;

    run({ type: "project/edit", id: project.id, changes: { name } });
    setOpen(false);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <label className="text-sm text-ink-soft">
        <span className="block pb-1">New name</span>
        <input
          type="text"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setProblem(null);
          }}
          aria-invalid={problem !== null}
          className="border-b border-rule bg-transparent py-1 text-base text-ink outline-none focus:border-ink"
        />
      </label>
      <button type="submit" className="border-b-2 border-highlight py-1 text-sm font-semibold">
        Save name
      </button>
      <button type="button" onClick={() => setOpen(false)} className="py-1 text-sm text-ink-soft underline">
        Cancel
      </button>
      {problem !== null && (
        <p role="alert" className="basis-full text-sm text-danger">
          {nameProblemMessage(problem)}
        </p>
      )}
    </form>
  );
}
