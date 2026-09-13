import type { DayKey } from "@/lib/dates/dayKey";

// Everything is `readonly`: TypeScript refuses code that changes a record in place.
// Changes always make a new object, which is how React notices something changed.

export type ProjectStatus = "active" | "archived";

export type Project = Readonly<{
  id: string;
  /** Trimmed, never empty, and unique across all projects (ignoring upper/lower case). */
  name: string;
  /** Free-form context for the project, kept exactly as typed. */
  notes: string;
  status: ProjectStatus;
  /** Milliseconds since 1970, the same number `Date.now()` gives. */
  createdAt: number;
  updatedAt: number;
}>;

export type Task = Readonly<{
  id: string;
  /** `null` means the task sits in the Inbox. */
  projectId: string | null;
  /** Trimmed and never empty. */
  title: string;
  due: DayKey | null;
  /** When the task was completed, or `null` while it's still open. */
  doneAt: number | null;
  createdAt: number;
  updatedAt: number;
}>;

/** Everything the app knows. In v1, each list becomes a database table. */
export type Workspace = Readonly<{
  projects: readonly Project[];
  tasks: readonly Task[];
}>;

export const emptyWorkspace: Workspace = { projects: [], tasks: [] };
