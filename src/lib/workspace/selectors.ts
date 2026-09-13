import type { Project, Task, Workspace } from "./types";

/** The Inbox is "no project", which is why it's spelled `null` everywhere. */
export const INBOX_ID = null;

export function activeProjects(workspace: Workspace): readonly Project[] {
  return workspace.projects.filter((project) => project.status === "active");
}

export function archivedProjects(workspace: Workspace): readonly Project[] {
  return workspace.projects.filter((project) => project.status === "archived");
}

export function findProject(workspace: Workspace, id: string): Project | null {
  return workspace.projects.find((project) => project.id === id) ?? null;
}

/**
 * The tasks of one project, or of the Inbox when `projectId` is `null`.
 *
 * Open tasks come first in the order they were added, then finished ones with the
 * most recently finished at the top. Sorting here, not in state, keeps one fact in one place.
 */
export function tasksIn(workspace: Workspace, projectId: string | null): readonly Task[] {
  const mine = workspace.tasks.filter((task) => task.projectId === projectId);
  return [...mine].sort(compareTasks);
}

export function openTaskCount(workspace: Workspace, projectId: string | null): number {
  return workspace.tasks.filter((task) => task.projectId === projectId && task.doneAt === null).length;
}

function compareTasks(a: Task, b: Task): number {
  if (a.doneAt === null && b.doneAt === null) return a.createdAt - b.createdAt;
  if (a.doneAt === null) return -1;
  if (b.doneAt === null) return 1;
  return b.doneAt - a.doneAt;
}
