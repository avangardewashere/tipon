/** @jest-environment node */
import { keepEverything, toActions, type Kept } from "./commit";
import type { Proposal } from "./proposal";
import { workspaceReducer } from "@/lib/workspace/reducer";
import { emptyWorkspace, type Workspace } from "@/lib/workspace/types";

const NOW = 1_000;

const proposal: Proposal = {
  projects: [
    { key: "p1", name: "Website relaunch", existingId: null, wasArchived: false },
    { key: "p2", name: "Old site", existingId: "p-old", wasArchived: true },
    { key: "p3", name: "Health", existingId: "p-health", wasArchived: false },
  ],
  tasks: [
    { key: "t1", title: "call the bank", due: "2026-09-15", projectKey: null },
    { key: "t2", title: "pick a host", due: null, projectKey: "p1" },
    { key: "t3", title: "cancel the hosting", due: null, projectKey: "p2" },
    { key: "t4", title: "gym", due: "2026-09-14", projectKey: "p3" },
  ],
};

function ids() {
  let made = 0;
  return () => `id-${(made += 1)}`;
}

function commit(kept: Kept, text = "a dump") {
  return toActions(proposal, kept, { text, createId: ids(), now: NOW });
}

function only(projectKeys: string[], taskKeys: string[]): Kept {
  return { projectKeys: new Set(projectKeys), taskKeys: new Set(taskKeys) };
}

describe("toActions", () => {
  it("adds a new project, brings an archived one back, and leaves an active one alone", () => {
    const actions = commit(only(["p1", "p2", "p3"], []));

    expect(actions.slice(0, 2)).toEqual([
      { type: "project/add", id: "id-1", name: "Website relaunch", now: NOW },
      { type: "project/unarchive", id: "p-old", now: NOW },
    ]);
    expect(actions.some((action) => action.type === "project/add" && action.name === "Health")).toBe(false);
  });

  it("points each task at the right project, new or already yours", () => {
    const actions = commit(keepEverything(proposal));
    const tasks = actions.filter((action) => action.type === "task/add");

    expect(tasks).toEqual([
      { type: "task/add", id: "id-2", title: "call the bank", projectId: null, due: "2026-09-15", now: NOW },
      { type: "task/add", id: "id-3", title: "pick a host", projectId: "id-1", due: null, now: NOW },
      { type: "task/add", id: "id-4", title: "cancel the hosting", projectId: "p-old", due: null, now: NOW },
      { type: "task/add", id: "id-5", title: "gym", projectId: "p-health", due: "2026-09-14", now: NOW },
    ]);
  });

  it("adds only what is still ticked", () => {
    const actions = commit(only(["p1"], ["t2"]));

    expect(actions.map((action) => action.type)).toEqual(["project/add", "task/add", "dump/record"]);
  });

  it("puts a task in the Inbox when its project was unticked, rather than dropping it", () => {
    const actions = commit(only([], ["t2"]));

    expect(actions[0]).toMatchObject({ type: "task/add", title: "pick a host", projectId: null });
  });

  it("records the dump with the ids it created", () => {
    const actions = commit(only(["p1", "p2"], ["t2", "t3"]), "the text as typed");

    expect(actions.at(-1)).toEqual({
      type: "dump/record",
      id: "id-4",
      text: "the text as typed",
      // "Old site" was joined, not created, so it isn't listed.
      projectIds: ["id-1"],
      taskIds: ["id-2", "id-3"],
      now: NOW,
    });
  });

  it("does nothing at all when everything is unticked", () => {
    expect(commit(only([], []))).toEqual([]);
  });

  it("gives every new record its own id", () => {
    const actions = commit(keepEverything(proposal));
    const created = actions.flatMap((action) => ("id" in action ? [action.id] : []));

    expect(new Set(created).size).toBe(created.length);
  });

  it("produces actions the reducer really accepts", () => {
    const start: Workspace = {
      ...emptyWorkspace,
      projects: [
        { id: "p-old", name: "Old site", notes: "", status: "archived", createdAt: 1, updatedAt: 1 },
        { id: "p-health", name: "Health", notes: "", status: "active", createdAt: 1, updatedAt: 1 },
      ],
    };

    const after = commit(keepEverything(proposal)).reduce(workspaceReducer, start);

    expect(after.projects.map((project) => `${project.name} (${project.status})`)).toEqual([
      "Old site (active)",
      "Health (active)",
      "Website relaunch (active)",
    ]);
    expect(after.tasks.map((task) => `${task.title} → ${task.projectId ?? "Inbox"}`)).toEqual([
      "call the bank → Inbox",
      "pick a host → id-1",
      "cancel the hosting → p-old",
      "gym → p-health",
    ]);
    expect(after.dumps).toHaveLength(1);
  });
});

describe("keepEverything", () => {
  it("ticks every proposed project and task", () => {
    const kept = keepEverything(proposal);

    expect([...kept.projectKeys]).toEqual(["p1", "p2", "p3"]);
    expect([...kept.taskKeys]).toEqual(["t1", "t2", "t3", "t4"]);
  });
});
