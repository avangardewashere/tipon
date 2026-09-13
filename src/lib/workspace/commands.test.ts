import { stamp, type WorkspaceCommand } from "./commands";
import type { WorkspaceAction } from "./reducer";

const NEW_ID = "id-new";
const NOW = 1_700;

describe("stamp", () => {
  const cases: ReadonlyArray<readonly [string, WorkspaceCommand, WorkspaceAction]> = [
    [
      "gives a new project the new id and the time",
      { type: "project/add", name: "Website" },
      { type: "project/add", id: NEW_ID, name: "Website", now: NOW },
    ],
    [
      "gives a new task the new id and the time",
      { type: "task/add", title: "Call the bank", projectId: null, due: "2026-09-20" },
      { type: "task/add", id: NEW_ID, title: "Call the bank", projectId: null, due: "2026-09-20", now: NOW },
    ],
    [
      "keeps the project's own id when editing",
      { type: "project/edit", id: "p-web", changes: { notes: "hello" } },
      { type: "project/edit", id: "p-web", changes: { notes: "hello" }, now: NOW },
    ],
    [
      "keeps the project's own id when archiving",
      { type: "project/archive", id: "p-web" },
      { type: "project/archive", id: "p-web", now: NOW },
    ],
    [
      "keeps the project's own id when unarchiving",
      { type: "project/unarchive", id: "p-web" },
      { type: "project/unarchive", id: "p-web", now: NOW },
    ],
    [
      "keeps the task's own id when editing",
      { type: "task/edit", id: "t-1", changes: { title: "Call the bank" } },
      { type: "task/edit", id: "t-1", changes: { title: "Call the bank" }, now: NOW },
    ],
    [
      "keeps the task's own id when completing",
      { type: "task/complete", id: "t-1" },
      { type: "task/complete", id: "t-1", now: NOW },
    ],
    [
      "keeps the task's own id when reopening",
      { type: "task/reopen", id: "t-1" },
      { type: "task/reopen", id: "t-1", now: NOW },
    ],
    [
      "keeps the task's own id when moving",
      { type: "task/move", id: "t-1", projectId: "p-web" },
      { type: "task/move", id: "t-1", projectId: "p-web", now: NOW },
    ],
    [
      "leaves a delete alone: it needs neither an id nor a time",
      { type: "task/delete", id: "t-1" },
      { type: "task/delete", id: "t-1" },
    ],
  ];

  it.each(cases)("%s", (_name, command, action) => {
    expect(stamp(command, NEW_ID, NOW)).toEqual(action);
  });

  it("never lets a new record borrow an id from the command", () => {
    // A screen can't accidentally choose the id of a record it creates.
    const action = stamp({ type: "project/add", name: "Website" }, NEW_ID, NOW);

    expect(action).toHaveProperty("id", NEW_ID);
  });
});
