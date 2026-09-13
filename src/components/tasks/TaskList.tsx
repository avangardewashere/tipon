"use client";

import { useState, type FormEvent } from "react";
import { useWorkspace } from "@/lib/workspace/store";
import { activeProjects } from "@/lib/workspace/selectors";
import type { Task } from "@/lib/workspace/types";

export type TaskListProps = Readonly<{
  tasks: readonly Task[];
  /** Shown when there's nothing to draw, so a screen is never blank. */
  emptyMessage: string;
}>;

export function TaskList({ tasks, emptyMessage }: TaskListProps) {
  if (tasks.length === 0) {
    return <p className="py-6 text-ink-soft">{emptyMessage}</p>;
  }

  return (
    <ul className="divide-y divide-rule">
      {tasks.map((task) => (
        <li key={task.id} className="py-3">
          <TaskRow task={task} />
        </li>
      ))}
    </ul>
  );
}

function TaskRow({ task }: Readonly<{ task: Task }>) {
  const { workspace, run } = useWorkspace();
  const [editing, setEditing] = useState(false);
  const done = task.doneAt !== null;

  if (editing) {
    return <TaskEditForm task={task} onDone={() => setEditing(false)} />;
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <input
        type="checkbox"
        id={`done-${task.id}`}
        checked={done}
        onChange={() => run({ type: done ? "task/reopen" : "task/complete", id: task.id })}
        className="size-4 accent-[var(--highlight)]"
      />
      <label htmlFor={`done-${task.id}`} className={`flex-1 basis-40 ${done ? "text-ink-faint line-through" : ""}`}>
        {task.title}
      </label>

      {task.due !== null && (
        <span className="text-sm text-ink-soft" data-testid={`due-${task.id}`}>
          Due {task.due}
        </span>
      )}

      <label className="text-sm text-ink-soft">
        <span className="sr-only">{`Move “${task.title}” to`}</span>
        <select
          value={task.projectId ?? ""}
          onChange={(event) =>
            run({ type: "task/move", id: task.id, projectId: event.target.value === "" ? null : event.target.value })
          }
          className="border-b border-rule bg-transparent py-1 text-ink outline-none focus:border-ink"
        >
          <option value="">Inbox</option>
          {activeProjects(workspace).map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </label>

      {/* The visible word stays short; screen readers hear which task it belongs to. */}
      <button type="button" onClick={() => setEditing(true)} className="text-sm text-ink-soft underline">
        Edit<span className="sr-only">{` “${task.title}”`}</span>
      </button>
      <button
        type="button"
        onClick={() => run({ type: "task/delete", id: task.id })}
        className="text-sm text-danger underline"
      >
        Delete<span className="sr-only">{` “${task.title}”`}</span>
      </button>
    </div>
  );
}

function TaskEditForm({ task, onDone }: Readonly<{ task: Task; onDone: () => void }>) {
  const { run } = useWorkspace();
  const [title, setTitle] = useState(task.title);
  const [due, setDue] = useState(task.due ?? "");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // The reducer refuses an empty title and keeps the old one; say so here instead of
    // letting the click do nothing.
    if (title.trim() === "") return;

    run({ type: "task/edit", id: task.id, changes: { title, due: due === "" ? null : due } });
    onDone();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <label className="flex-1 basis-48 text-sm text-ink-soft">
        <span className="block pb-1">Title</span>
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="w-full border-b border-rule bg-transparent py-1 text-base text-ink outline-none focus:border-ink"
        />
      </label>
      <label className="text-sm text-ink-soft">
        <span className="block pb-1">Due date</span>
        <input
          type="date"
          value={due}
          onChange={(event) => setDue(event.target.value)}
          className="border-b border-rule bg-transparent py-1 text-base text-ink outline-none focus:border-ink"
        />
      </label>
      <button type="submit" className="border-b-2 border-highlight py-1 text-sm font-semibold">
        Save task
      </button>
      <button type="button" onClick={onDone} className="py-1 text-sm text-ink-soft underline">
        Cancel
      </button>
    </form>
  );
}
