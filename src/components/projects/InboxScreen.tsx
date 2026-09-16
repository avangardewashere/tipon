"use client";

import { useWorkspace } from "@/lib/workspace/store";
import { tasksIn } from "@/lib/workspace/selectors";
import { AddTaskForm } from "@/components/tasks/AddTaskForm";
import { TaskList } from "@/components/tasks/TaskList";

/** Everything that hasn't been given a project yet. Block 4's brain dump fills this. */
export function InboxScreen() {
  const { workspace } = useWorkspace();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-3xl">Inbox</h1>
        <p className="pt-1 text-ink-soft">Tasks that don&apos;t belong to a project yet.</p>
      </header>

      <AddTaskForm projectId={null} />
      <TaskList tasks={tasksIn(workspace, null)} emptyMessage="Your Inbox is empty." />
    </div>
  );
}
