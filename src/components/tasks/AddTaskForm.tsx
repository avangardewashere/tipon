"use client";

import { useState, type FormEvent } from "react";
import { useWorkspace } from "@/lib/workspace/store";

export type AddTaskFormProps = Readonly<{
  /** `null` adds to the Inbox. */
  projectId: string | null;
  /** An archived project takes no new tasks, so the form is shown but switched off. */
  disabled?: boolean;
}>;

export function AddTaskForm({ projectId, disabled = false }: AddTaskFormProps) {
  const { run } = useWorkspace();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (title.trim() === "") return;

    run({ type: "task/add", title, projectId, due: due === "" ? null : due });
    setTitle("");
    setDue("");
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3 border-b border-rule pb-4">
      <label className="flex-1 basis-48 text-sm text-ink-soft">
        <span className="block pb-1">Task</span>
        <input
          type="text"
          value={title}
          disabled={disabled}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="What needs doing?"
          className="w-full border-b border-rule bg-transparent py-1 text-base text-ink outline-none placeholder:text-ink-faint focus:border-ink disabled:opacity-50"
        />
      </label>

      <label className="text-sm text-ink-soft">
        <span className="block pb-1">Due date</span>
        <input
          type="date"
          value={due}
          disabled={disabled}
          onChange={(event) => setDue(event.target.value)}
          className="border-b border-rule bg-transparent py-1 text-base text-ink outline-none focus:border-ink disabled:opacity-50"
        />
      </label>

      <button
        type="submit"
        disabled={disabled}
        className="border-b-2 border-highlight py-1 text-sm font-semibold text-ink disabled:opacity-50"
      >
        Add task
      </button>
    </form>
  );
}
