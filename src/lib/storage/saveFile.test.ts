/** @jest-environment node */
import {
  describeProblem,
  parseSaveFile,
  SAVE_FILE_VERSION,
  serializeSaveFile,
  toSaveFile,
} from "./saveFile";
import type { Workspace } from "@/lib/workspace/types";

const workspace: Workspace = {
  projects: [
    { id: "p-web", name: "Website relaunch", notes: "Launch in March.", status: "active", createdAt: 1, updatedAt: 2 },
    { id: "p-old", name: "Old site", notes: "", status: "archived", createdAt: 1, updatedAt: 3 },
  ],
  tasks: [
    { id: "t-1", projectId: "p-web", title: "Pick a host", due: "2026-09-18", doneAt: null, createdAt: 4, updatedAt: 4 },
    { id: "t-2", projectId: null, title: "Call the bank", due: null, doneAt: 9, createdAt: 5, updatedAt: 9 },
  ],
};

/** A valid file, then one field spoiled, is how every rejection below is built. */
function fileWith(change: (value: Record<string, unknown>) => void): string {
  const value = JSON.parse(serializeSaveFile(toSaveFile(workspace, 1_000))) as Record<string, unknown>;
  change(value);
  return JSON.stringify(value);
}

function projectsOf(value: Record<string, unknown>): Record<string, unknown>[] {
  return (value.workspace as { projects: Record<string, unknown>[] }).projects;
}

function tasksOf(value: Record<string, unknown>): Record<string, unknown>[] {
  return (value.workspace as { tasks: Record<string, unknown>[] }).tasks;
}

describe("save file", () => {
  it("survives the round trip unchanged", () => {
    const result = parseSaveFile(serializeSaveFile(toSaveFile(workspace, 1_000)));

    expect(result).toEqual({ ok: true, saveFile: { app: "tipon", version: 1, savedAt: 1_000, workspace } });
  });

  it("writes the version into the file, not into the key", () => {
    expect(toSaveFile(workspace, 1_000).version).toBe(SAVE_FILE_VERSION);
  });

  it("is readable text, so a person can look inside their own backup", () => {
    expect(serializeSaveFile(toSaveFile(workspace, 1_000))).toContain('\n  "app": "tipon"');
  });

  it.each([
    ["not JSON at all", "{ this is not json", "not-json"],
    ["an empty file", "", "not-json"],
    ["JSON that isn't an object", '"hello"', "not-a-save-file"],
    ["a file from a newer Tipon", JSON.stringify({ app: "tipon", version: 2, savedAt: 1, workspace }), "newer-version"],
    ["another app's JSON", JSON.stringify({ app: "notion", version: 1, savedAt: 1, workspace }), "not-a-save-file"],
    ["a missing workspace", JSON.stringify({ app: "tipon", version: 1, savedAt: 1 }), "not-a-save-file"],
  ])("refuses %s", (_name, text, kind) => {
    const result = parseSaveFile(text);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.problem.kind).toBe(kind);
  });

  it.each([
    ["a due date that isn't a real day", (v: Record<string, unknown>) => void (tasksOf(v)[0].due = "2026-02-30")],
    ["a due date of the wrong shape", (v: Record<string, unknown>) => void (tasksOf(v)[0].due = "next friday")],
    ["a task with no title", (v: Record<string, unknown>) => void (tasksOf(v)[0].title = "")],
    ["a project with an unknown status", (v: Record<string, unknown>) => void (projectsOf(v)[0].status = "deleted")],
    ["a project with no name", (v: Record<string, unknown>) => void (projectsOf(v)[0].name = "")],
    ["notes that aren't text", (v: Record<string, unknown>) => void (projectsOf(v)[0].notes = 42)],
    ["a time that isn't a number", (v: Record<string, unknown>) => void (projectsOf(v)[0].createdAt = "yesterday")],
    ["two projects with the same id", (v: Record<string, unknown>) => void (projectsOf(v)[1].id = "p-web")],
    ["two tasks with the same id", (v: Record<string, unknown>) => void (tasksOf(v)[1].id = "t-1")],
    ["a task in a project that isn't in the file", (v: Record<string, unknown>) => void (tasksOf(v)[0].projectId = "p-gone")],
  ])("refuses %s", (_name, change) => {
    const result = parseSaveFile(fileWith(change));

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.problem.kind).toBe("not-a-save-file");
  });

  it("says where the trouble is, so the message can name it", () => {
    const result = parseSaveFile(fileWith((v) => void (tasksOf(v)[0].due = "2026-02-30")));

    expect(result.ok === false && describeProblem(result.problem)).toContain("workspace.tasks.0.due");
    expect(result.ok === false && describeProblem(result.problem)).toContain("not a real calendar day");
  });

  it("explains a file from a newer version by version number", () => {
    const result = parseSaveFile(JSON.stringify({ app: "tipon", version: 7, savedAt: 1, workspace }));

    expect(result.ok === false && describeProblem(result.problem)).toContain("v7");
  });

  it("keeps an empty workspace", () => {
    const empty: Workspace = { projects: [], tasks: [] };

    const result = parseSaveFile(serializeSaveFile(toSaveFile(empty, 1)));

    expect(result.ok === true && result.saveFile.workspace).toEqual(empty);
  });
});
