/**
 * @jest-environment node
 */
import { workspaceReducer, type WorkspaceAction } from "./reducer";
import { emptyWorkspace, type Workspace } from "./types";

// Made-up clock readings. The reducer never reads the real clock, so any numbers work.
const T0 = 1_000;
const T1 = 2_000;
const T2 = 3_000;

type TaskAdd = Extract<WorkspaceAction, { type: "task/add" }>;

/** Applies actions one after another, like a user doing them in order. */
function run(state: Workspace, ...actions: WorkspaceAction[]): Workspace {
  return actions.reduce(workspaceReducer, state);
}

function addProject(id: string, name: string): WorkspaceAction {
  return { type: "project/add", id, name, now: T0 };
}

function addTask(id: string, overrides: Partial<TaskAdd> = {}): WorkspaceAction {
  return { type: "task/add", id, title: `Task ${id}`, projectId: null, due: null, now: T0, ...overrides };
}

function projectById(state: Workspace, id: string) {
  return state.projects.find((project) => project.id === id);
}

function taskById(state: Workspace, id: string) {
  return state.tasks.find((task) => task.id === id);
}

describe("project/add", () => {
  it("adds an active project with a trimmed name and empty notes", () => {
    const state = run(emptyWorkspace, addProject("p-web", "  Website  "));

    expect(state.projects).toEqual([
      { id: "p-web", name: "Website", notes: "", status: "active", createdAt: T0, updatedAt: T0 },
    ]);
  });

  it("keeps projects in the order they were added", () => {
    const state = run(emptyWorkspace, addProject("p-web", "Website"), addProject("p-garden", "Garden"));

    expect(state.projects.map((project) => project.name)).toEqual(["Website", "Garden"]);
  });

  it.each(["", "   ", "\n\t"])("ignores the blank name %j", (name) => {
    expect(run(emptyWorkspace, addProject("p1", name))).toBe(emptyWorkspace);
  });

  it("ignores a name that's already taken, ignoring case and spaces", () => {
    const base = run(emptyWorkspace, addProject("p-web", "Website"));

    expect(run(base, addProject("p2", " website "))).toBe(base);
  });

  it("counts archived projects as taken", () => {
    const base = run(emptyWorkspace, addProject("p-web", "Website"), {
      type: "project/archive",
      id: "p-web",
      now: T1,
    });

    expect(run(base, addProject("p2", "Website"))).toBe(base);
  });

  it("ignores an id that's already used", () => {
    const base = run(emptyWorkspace, addProject("p-web", "Website"));

    expect(run(base, addProject("p-web", "Garden"))).toBe(base);
  });
});

describe("project/edit", () => {
  const base = run(emptyWorkspace, addProject("p-web", "Website"), addProject("p-garden", "Garden"));

  it("renames a project and records when", () => {
    const state = run(base, { type: "project/edit", id: "p-web", changes: { name: " Blog " }, now: T1 });

    expect(projectById(state, "p-web")).toMatchObject({ name: "Blog", createdAt: T0, updatedAt: T1 });
  });

  it("can change just the upper/lower case of its own name", () => {
    const state = run(base, { type: "project/edit", id: "p-web", changes: { name: "WEBSITE" }, now: T1 });

    expect(projectById(state, "p-web")?.name).toBe("WEBSITE");
  });

  it("ignores a name another project already has", () => {
    expect(run(base, { type: "project/edit", id: "p-web", changes: { name: "garden" }, now: T1 })).toBe(base);
  });

  it("ignores a blank name", () => {
    expect(run(base, { type: "project/edit", id: "p-web", changes: { name: "  " }, now: T1 })).toBe(base);
  });

  it("keeps notes exactly as typed, spaces and line breaks included", () => {
    const notes = "  Launch before October.\n\n- ask Ana about hosting  ";
    const state = run(base, { type: "project/edit", id: "p-web", changes: { notes }, now: T1 });

    expect(projectById(state, "p-web")).toMatchObject({ notes, updatedAt: T1 });
  });

  it("is all or nothing: a refused name also blocks the notes", () => {
    const action: WorkspaceAction = {
      type: "project/edit",
      id: "p-web",
      changes: { name: "Garden", notes: "New notes" },
      now: T1,
    };

    expect(run(base, action)).toBe(base);
  });

  it.each([{}, { name: "Website" }, { name: "  Website  " }, { notes: "" }])(
    "returns the same workspace when %j changes nothing",
    (changes) => {
      expect(run(base, { type: "project/edit", id: "p-web", changes, now: T1 })).toBe(base);
    },
  );

  it("ignores an unknown id", () => {
    expect(run(base, { type: "project/edit", id: "nope", changes: { name: "Blog" }, now: T1 })).toBe(base);
  });
});

describe("project/archive and project/unarchive", () => {
  const base = run(emptyWorkspace, addProject("p-web", "Website"), addTask("t1", { projectId: "p-web" }));

  it("archives a project and leaves its tasks where they are", () => {
    const state = run(base, { type: "project/archive", id: "p-web", now: T1 });

    expect(projectById(state, "p-web")).toMatchObject({ status: "archived", updatedAt: T1 });
    expect(state.tasks).toBe(base.tasks);
  });

  it("changes nothing when archiving an archived project", () => {
    const archived = run(base, { type: "project/archive", id: "p-web", now: T1 });

    expect(run(archived, { type: "project/archive", id: "p-web", now: T2 })).toBe(archived);
  });

  it("brings an archived project back", () => {
    const state = run(
      base,
      { type: "project/archive", id: "p-web", now: T1 },
      { type: "project/unarchive", id: "p-web", now: T2 },
    );

    expect(projectById(state, "p-web")).toMatchObject({ status: "active", updatedAt: T2 });
  });

  it("changes nothing when unarchiving an active project", () => {
    expect(run(base, { type: "project/unarchive", id: "p-web", now: T1 })).toBe(base);
  });

  it("ignores an unknown id", () => {
    expect(run(base, { type: "project/archive", id: "nope", now: T1 })).toBe(base);
  });
});

describe("task/add", () => {
  const base = run(emptyWorkspace, addProject("p-web", "Website"));

  it("adds an open task to the Inbox with a trimmed title", () => {
    const state = run(base, addTask("t1", { title: "  Call the bank  " }));

    expect(state.tasks).toEqual([
      { id: "t1", projectId: null, title: "Call the bank", due: null, doneAt: null, createdAt: T0, updatedAt: T0 },
    ]);
  });

  it("adds a task to a project with a due date", () => {
    const state = run(base, addTask("t1", { projectId: "p-web", due: "2026-09-18" }));

    expect(taskById(state, "t1")).toMatchObject({ projectId: "p-web", due: "2026-09-18" });
  });

  it.each(["", "   "])("ignores the blank title %j", (title) => {
    expect(run(base, addTask("t1", { title }))).toBe(base);
  });

  it("ignores a project that doesn't exist", () => {
    expect(run(base, addTask("t1", { projectId: "nope" }))).toBe(base);
  });

  it("won't add to an archived project", () => {
    const archived = run(base, { type: "project/archive", id: "p-web", now: T1 });

    expect(run(archived, addTask("t1", { projectId: "p-web" }))).toBe(archived);
  });

  it.each(["2026-02-30", "2026-9-18", "tomorrow", "18/09/2026", ""])("ignores the invalid due date %j", (due) => {
    expect(run(base, addTask("t1", { due }))).toBe(base);
  });

  it("ignores an id that's already used", () => {
    const withTask = run(base, addTask("t1"));

    expect(run(withTask, addTask("t1", { title: "Something else" }))).toBe(withTask);
  });
});

describe("task/edit", () => {
  const base = run(emptyWorkspace, addTask("t1", { title: "Call the bank", due: "2026-09-18" }));

  it("changes the title, keeps the due date and records when", () => {
    const state = run(base, { type: "task/edit", id: "t1", changes: { title: " Call Ana " }, now: T1 });

    expect(taskById(state, "t1")).toMatchObject({ title: "Call Ana", due: "2026-09-18", updatedAt: T1 });
  });

  it("sets a new due date", () => {
    const state = run(base, { type: "task/edit", id: "t1", changes: { due: "2026-10-01" }, now: T1 });

    expect(taskById(state, "t1")?.due).toBe("2026-10-01");
  });

  it("removes the due date when given null", () => {
    const state = run(base, { type: "task/edit", id: "t1", changes: { due: null }, now: T1 });

    expect(taskById(state, "t1")?.due).toBeNull();
  });

  it("ignores a blank title", () => {
    expect(run(base, { type: "task/edit", id: "t1", changes: { title: " " }, now: T1 })).toBe(base);
  });

  it("ignores an invalid due date", () => {
    expect(run(base, { type: "task/edit", id: "t1", changes: { due: "2026-13-01" }, now: T1 })).toBe(base);
  });

  it("is all or nothing: a bad date also blocks a good title", () => {
    const action: WorkspaceAction = {
      type: "task/edit",
      id: "t1",
      changes: { title: "Call Ana", due: "2026-13-01" },
      now: T1,
    };

    expect(run(base, action)).toBe(base);
  });

  it.each([{}, { title: "Call the bank" }, { due: "2026-09-18" }])(
    "returns the same workspace when %j changes nothing",
    (changes) => {
      expect(run(base, { type: "task/edit", id: "t1", changes, now: T1 })).toBe(base);
    },
  );

  it("ignores an unknown id", () => {
    expect(run(base, { type: "task/edit", id: "nope", changes: { title: "Hi" }, now: T1 })).toBe(base);
  });
});

describe("task/complete and task/reopen", () => {
  const base = run(emptyWorkspace, addTask("t1"));
  const done = run(base, { type: "task/complete", id: "t1", now: T1 });

  it("records when a task was completed", () => {
    expect(taskById(done, "t1")).toMatchObject({ doneAt: T1, updatedAt: T1 });
  });

  it("keeps the first completion time when completed again", () => {
    expect(run(done, { type: "task/complete", id: "t1", now: T2 })).toBe(done);
  });

  it("reopens a completed task", () => {
    const reopened = run(done, { type: "task/reopen", id: "t1", now: T2 });

    expect(taskById(reopened, "t1")).toMatchObject({ doneAt: null, updatedAt: T2 });
  });

  it("changes nothing when reopening an open task", () => {
    expect(run(base, { type: "task/reopen", id: "t1", now: T1 })).toBe(base);
  });

  it("ignores an unknown id", () => {
    expect(run(base, { type: "task/complete", id: "nope", now: T1 })).toBe(base);
  });
});

describe("task/move", () => {
  const base = run(emptyWorkspace, addProject("p-web", "Website"), addProject("p-garden", "Garden"), addTask("t1"));

  it("moves a task from the Inbox into a project", () => {
    const state = run(base, { type: "task/move", id: "t1", projectId: "p-web", now: T1 });

    expect(taskById(state, "t1")).toMatchObject({ projectId: "p-web", updatedAt: T1 });
  });

  it("moves a task from one project to another, then back to the Inbox", () => {
    const state = run(
      base,
      { type: "task/move", id: "t1", projectId: "p-web", now: T1 },
      { type: "task/move", id: "t1", projectId: "p-garden", now: T1 },
      { type: "task/move", id: "t1", projectId: null, now: T2 },
    );

    expect(taskById(state, "t1")).toMatchObject({ projectId: null, updatedAt: T2 });
  });

  it("changes nothing when the task is already there", () => {
    expect(run(base, { type: "task/move", id: "t1", projectId: null, now: T1 })).toBe(base);
  });

  it("won't move a task into an archived project", () => {
    const archived = run(base, { type: "project/archive", id: "p-web", now: T1 });

    expect(run(archived, { type: "task/move", id: "t1", projectId: "p-web", now: T2 })).toBe(archived);
  });

  it("won't move a task into a project that doesn't exist", () => {
    expect(run(base, { type: "task/move", id: "t1", projectId: "nope", now: T1 })).toBe(base);
  });

  it("still lets a task leave an archived project", () => {
    const archived = run(
      base,
      { type: "task/move", id: "t1", projectId: "p-web", now: T1 },
      { type: "project/archive", id: "p-web", now: T1 },
    );
    const state = run(archived, { type: "task/move", id: "t1", projectId: null, now: T2 });

    expect(taskById(state, "t1")?.projectId).toBeNull();
  });

  it("keeps a completed task completed when it moves", () => {
    const state = run(
      base,
      { type: "task/complete", id: "t1", now: T1 },
      { type: "task/move", id: "t1", projectId: "p-web", now: T2 },
    );

    expect(taskById(state, "t1")).toMatchObject({ projectId: "p-web", doneAt: T1 });
  });

  it("ignores an unknown task id", () => {
    expect(run(base, { type: "task/move", id: "nope", projectId: "p-web", now: T1 })).toBe(base);
  });
});

describe("task/delete", () => {
  const base = run(emptyWorkspace, addTask("t1"), addTask("t2"));

  it("removes only that task", () => {
    const state = run(base, { type: "task/delete", id: "t1" });

    expect(state.tasks.map((task) => task.id)).toEqual(["t2"]);
  });

  it("ignores an unknown id", () => {
    expect(run(base, { type: "task/delete", id: "nope" })).toBe(base);
  });
});

describe("the reducer as a whole", () => {
  /** Freezes an object and everything inside it. Changing a frozen object throws in a test. */
  function deepFreeze<T>(value: T): T {
    if (value !== null && typeof value === "object") {
      Object.values(value).forEach(deepFreeze);
      Object.freeze(value);
    }
    return value;
  }

  it("never changes a workspace in place, across every kind of action", () => {
    const actions: WorkspaceAction[] = [
      addProject("p-web", "Website"),
      addProject("p-garden", "Garden"),
      { type: "project/edit", id: "p-web", changes: { name: "Blog", notes: "Launch soon" }, now: T1 },
      addTask("t1", { title: "Call the bank", due: "2026-09-18" }),
      addTask("t2", { title: "Write the about page", projectId: "p-web" }),
      { type: "task/edit", id: "t1", changes: { title: "Call Ana" }, now: T1 },
      { type: "task/complete", id: "t2", now: T1 },
      { type: "task/reopen", id: "t2", now: T2 },
      { type: "task/move", id: "t1", projectId: "p-garden", now: T2 },
      { type: "project/archive", id: "p-garden", now: T2 },
      { type: "project/unarchive", id: "p-garden", now: T2 },
      { type: "task/delete", id: "t2" },
    ];

    let state = deepFreeze(emptyWorkspace);
    for (const action of actions) {
      state = deepFreeze(workspaceReducer(state, action));
    }

    expect(state.projects.map((project) => [project.name, project.status])).toEqual([
      ["Blog", "active"],
      ["Garden", "active"],
    ]);
    expect(state.tasks).toEqual([
      { id: "t1", projectId: "p-garden", title: "Call Ana", due: "2026-09-18", doneAt: null, createdAt: T0, updatedAt: T2 },
    ]);
  });

  it("ignores an action type it doesn't know", () => {
    const base = run(emptyWorkspace, addProject("p-web", "Website"));
    const unknown = { type: "project/explode", id: "p-web" } as unknown as WorkspaceAction;

    expect(workspaceReducer(base, unknown)).toBe(base);
  });
});

describe("dump/record", () => {
  const dump = {
    type: "dump/record",
    id: "d-1",
    text: "call the bank tomorrow\n\nWebsite:\n- pick a host",
    projectIds: ["p-web"],
    taskIds: ["t-1", "t-2"],
    now: 1_000,
  } as const;

  it("keeps the dump exactly as it was typed", () => {
    const after = workspaceReducer(emptyWorkspace, dump);

    expect(after.dumps).toEqual([
      {
        id: "d-1",
        text: "call the bank tomorrow\n\nWebsite:\n- pick a host",
        createdAt: 1_000,
        projectIds: ["p-web"],
        taskIds: ["t-1", "t-2"],
      },
    ]);
  });

  it("keeps a dump that added nothing at all", () => {
    const after = workspaceReducer(emptyWorkspace, { ...dump, projectIds: [], taskIds: [] });

    expect(after.dumps[0]).toMatchObject({ projectIds: [], taskIds: [] });
  });

  it("ignores an id that is already used", () => {
    const after = workspaceReducer(emptyWorkspace, dump);

    expect(workspaceReducer(after, { ...dump, text: "something else" })).toBe(after);
  });

  it("leaves projects and tasks exactly as they were", () => {
    const before = workspaceReducer(emptyWorkspace, { type: "project/add", id: "p-web", name: "Website", now: 1 });

    const after = workspaceReducer(before, dump);

    expect(after.projects).toBe(before.projects);
    expect(after.tasks).toBe(before.tasks);
  });
});
