import { activeProjects } from "@/lib/workspace/selectors";
import type { DayKey } from "@/lib/dates/dayKey";
import type { Project, Task, Workspace } from "@/lib/workspace/types";

/**
 * What Today shows, worked out from the workspace every time it's drawn.
 *
 * Nothing here is stored. "Overdue" isn't a flag on a task that something has to remember
 * to set at midnight — it's `task.due < today`, asked afresh. That's why the day can roll
 * over while the app is open and the page is simply right afterwards.
 */
export type NextInProject = Readonly<{ project: Project; task: Task }>;

export type Today = Readonly<{
  /** Open tasks whose day has been and gone, oldest first. */
  overdue: readonly Task[];
  /** Open tasks due today. */
  dueToday: readonly Task[];
  /**
   * The next open task in each active project, for projects with nothing above.
   * One line each: Today is a nudge, not a second Projects page.
   */
  nextInProjects: readonly NextInProject[];
  /** How many open tasks are sitting in the Inbox. */
  inboxOpen: number;
  /** Finished today, so a day's work doesn't vanish the moment it's ticked off. */
  doneToday: readonly Task[];
}>;

export type TodayOptions = Readonly<{
  /**
   * Turns a completion time into the day it happened, in the reader's own time zone.
   * Passed in rather than imported so a test can put the clock wherever it likes.
   */
  dayOf: (at: number) => DayKey;
}>;

export function buildToday(workspace: Workspace, today: DayKey, { dayOf }: TodayOptions): Today {
  const open = workspace.tasks.filter((task) => task.doneAt === null);

  const overdue = open
    .filter((task) => task.due !== null && task.due < today)
    .sort((a, b) => compare(a.due, b.due) || a.createdAt - b.createdAt);

  const dueToday = open.filter((task) => task.due === today).sort((a, b) => a.createdAt - b.createdAt);

  // A task already listed above doesn't need listing again further down.
  const alreadyShown = new Set([...overdue, ...dueToday].map((task) => task.id));

  const nextInProjects: NextInProject[] = [];
  for (const project of activeProjects(workspace)) {
    const task = open
      .filter((candidate) => candidate.projectId === project.id && !alreadyShown.has(candidate.id))
      .sort((a, b) => a.createdAt - b.createdAt)[0];

    if (task !== undefined) nextInProjects.push({ project, task });
  }

  const doneToday = workspace.tasks
    .filter((task) => task.doneAt !== null && dayOf(task.doneAt) === today)
    .sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));

  return {
    overdue,
    dueToday,
    nextInProjects,
    inboxOpen: open.filter((task) => task.projectId === null).length,
    doneToday,
  };
}

/** True when there is genuinely nothing to show, which deserves its own sentence. */
export function isQuietDay(today: Today): boolean {
  return (
    today.overdue.length === 0 &&
    today.dueToday.length === 0 &&
    today.nextInProjects.length === 0 &&
    today.inboxOpen === 0
  );
}

/** Day keys sort the same way as the calendar, which is the whole point of the format. */
function compare(a: DayKey | null, b: DayKey | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? -1 : 1;
}
