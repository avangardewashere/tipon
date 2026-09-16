import { isDayKey, type DayKey } from "@/lib/dates/dayKey";
import { findProjectNameProblem } from "./rules";
import type { Dump, Project, Task, Workspace } from "./types";

/** Leave a field out to keep it as it is. */
export type ProjectChanges = Readonly<{ name?: string; notes?: string }>;

/** Leave a field out to keep it as it is. `due: null` removes the due date. */
export type TaskChanges = Readonly<{ title?: string; due?: DayKey | null }>;

/**
 * Every change to the workspace is one of these actions. In v1 this list becomes the API.
 *
 * Actions that create a record bring its `id`, and actions that change a record bring `now`.
 * The reducer never makes up ids or reads the clock, so the same actions always give the
 * same result. That's what lets a test say "it is now 3pm" in one line.
 */
export type WorkspaceAction =
  | { type: "project/add"; id: string; name: string; now: number }
  | { type: "project/edit"; id: string; changes: ProjectChanges; now: number }
  | { type: "project/archive"; id: string; now: number }
  | { type: "project/unarchive"; id: string; now: number }
  | { type: "task/add"; id: string; title: string; projectId: string | null; due: DayKey | null; now: number }
  | { type: "task/edit"; id: string; changes: TaskChanges; now: number }
  | { type: "task/complete"; id: string; now: number }
  | { type: "task/reopen"; id: string; now: number }
  | { type: "task/move"; id: string; projectId: string | null; now: number }
  | { type: "task/delete"; id: string }
  | {
      type: "dump/record";
      id: string;
      text: string;
      projectIds: readonly string[];
      taskIds: readonly string[];
      now: number;
    };

/**
 * Returns the workspace after `action`.
 *
 * An action that isn't allowed (an empty name, an unknown id, a date like `2026-02-30`) or
 * that changes nothing returns the **same object** it was given. React sees that and skips
 * re-rendering, and tests use it to prove "this action was ignored".
 */
export function workspaceReducer(state: Workspace, action: WorkspaceAction): Workspace {
  switch (action.type) {
    case "project/add":
      return addProject(state, action.id, action.name, action.now);

    case "project/edit":
      return withProjects(
        state,
        updateById(state.projects, action.id, (project) =>
          applyProjectChanges(state.projects, project, action.changes, action.now),
        ),
      );

    case "project/archive":
    case "project/unarchive": {
      const status = action.type === "project/archive" ? "archived" : "active";
      return withProjects(
        state,
        updateById(state.projects, action.id, (project) =>
          project.status === status ? project : { ...project, status, updatedAt: action.now },
        ),
      );
    }

    case "task/add":
      return addTask(state, action);

    case "task/edit":
      return withTasks(
        state,
        updateById(state.tasks, action.id, (task) => applyTaskChanges(task, action.changes, action.now)),
      );

    case "task/complete":
      return withTasks(
        state,
        // Completing a finished task keeps the original completion time.
        updateById(state.tasks, action.id, (task) =>
          task.doneAt === null ? { ...task, doneAt: action.now, updatedAt: action.now } : task,
        ),
      );

    case "task/reopen":
      return withTasks(
        state,
        updateById(state.tasks, action.id, (task) =>
          task.doneAt === null ? task : { ...task, doneAt: null, updatedAt: action.now },
        ),
      );

    case "task/move":
      if (!acceptsNewTasks(state, action.projectId)) return state;
      return withTasks(
        state,
        updateById(state.tasks, action.id, (task) =>
          task.projectId === action.projectId ? task : { ...task, projectId: action.projectId, updatedAt: action.now },
        ),
      );

    case "task/delete": {
      const tasks = state.tasks.filter((task) => task.id !== action.id);
      return tasks.length === state.tasks.length ? state : { ...state, tasks };
    }

    case "dump/record": {
      if (hasId(state.dumps, action.id)) return state;

      // The text is kept exactly as typed: this is the record of what you wrote, not a
      // tidied version of it.
      const dump: Dump = {
        id: action.id,
        text: action.text,
        createdAt: action.now,
        projectIds: [...action.projectIds],
        taskIds: [...action.taskIds],
      };
      return { ...state, dumps: [...state.dumps, dump] };
    }

    default: {
      // If someone adds an action type above and forgets to handle it, TypeScript flags this line.
      const unhandled: never = action;
      void unhandled;
      return state;
    }
  }
}

function addProject(state: Workspace, id: string, name: string, now: number): Workspace {
  if (hasId(state.projects, id)) return state;
  if (findProjectNameProblem(state.projects, name) !== null) return state;

  const project: Project = {
    id,
    name: name.trim(),
    notes: "",
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
  return { ...state, projects: [...state.projects, project] };
}

function applyProjectChanges(
  projects: readonly Project[],
  project: Project,
  changes: ProjectChanges,
  now: number,
): Project {
  // All or nothing: if the new name isn't allowed, the notes don't change either.
  if (changes.name !== undefined && findProjectNameProblem(projects, changes.name, project.id) !== null) {
    return project;
  }

  const name = changes.name === undefined ? project.name : changes.name.trim();
  const notes = changes.notes === undefined ? project.notes : changes.notes;
  if (name === project.name && notes === project.notes) return project;

  return { ...project, name, notes, updatedAt: now };
}

function addTask(state: Workspace, action: Extract<WorkspaceAction, { type: "task/add" }>): Workspace {
  const title = action.title.trim();
  if (title === "" || hasId(state.tasks, action.id)) return state;
  if (action.due !== null && !isDayKey(action.due)) return state;
  if (!acceptsNewTasks(state, action.projectId)) return state;

  const task: Task = {
    id: action.id,
    projectId: action.projectId,
    title,
    due: action.due,
    doneAt: null,
    createdAt: action.now,
    updatedAt: action.now,
  };
  return { ...state, tasks: [...state.tasks, task] };
}

function applyTaskChanges(task: Task, changes: TaskChanges, now: number): Task {
  const title = changes.title === undefined ? task.title : changes.title.trim();
  const due = changes.due === undefined ? task.due : changes.due;

  // All or nothing, like the project version.
  if (title === "" || (due !== null && !isDayKey(due))) return task;
  if (title === task.title && due === task.due) return task;

  return { ...task, title, due, updatedAt: now };
}

/** The Inbox always takes new tasks. A project only does while it's active. */
function acceptsNewTasks(state: Workspace, projectId: string | null): boolean {
  if (projectId === null) return true;
  return state.projects.find((project) => project.id === projectId)?.status === "active";
}

function hasId(items: readonly { id: string }[], id: string): boolean {
  return items.some((item) => item.id === id);
}

/**
 * Swaps the record with `id` for `update(record)`.
 * Returns the same array when there's no such record or `update` hands back the same object.
 */
function updateById<T extends { id: string }>(
  items: readonly T[],
  id: string,
  update: (item: T) => T,
): readonly T[] {
  const current = items.find((item) => item.id === id);
  if (current === undefined) return items;

  const updated = update(current);
  if (updated === current) return items;

  return items.map((item) => (item === current ? updated : item));
}

function withProjects(state: Workspace, projects: readonly Project[]): Workspace {
  return projects === state.projects ? state : { ...state, projects };
}

function withTasks(state: Workspace, tasks: readonly Task[]): Workspace {
  return tasks === state.tasks ? state : { ...state, tasks };
}
