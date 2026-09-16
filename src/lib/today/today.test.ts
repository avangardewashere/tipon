/** @jest-environment node */
import { buildToday, isQuietDay } from "./today";
import { dayKeyFromDate } from "@/lib/dates/calendar";
import { emptyWorkspace, type Task, type Workspace } from "@/lib/workspace/types";

const TODAY = "2026-09-14";
const dayOf = (at: number) => dayKeyFromDate(new Date(at));

function project(id: string, name: string, status: "active" | "archived" = "active") {
  return { id, name, notes: "", status, createdAt: 0, updatedAt: 0 } as const;
}

function task(id: string, changes: Partial<Task> = {}): Task {
  return {
    id,
    projectId: null,
    title: id,
    due: null,
    doneAt: null,
    createdAt: 0,
    updatedAt: 0,
    ...changes,
  };
}

function build(workspace: Partial<Workspace>) {
  return buildToday({ ...emptyWorkspace, ...workspace }, TODAY, { dayOf });
}

describe("buildToday", () => {
  it("has nothing to say about an empty workspace", () => {
    const today = build({});

    expect(today).toEqual({ overdue: [], dueToday: [], nextInProjects: [], inboxOpen: 0, doneToday: [] });
    expect(isQuietDay(today)).toBe(true);
  });

  it("splits tasks by their day", () => {
    const today = build({
      tasks: [
        task("yesterday", { due: "2026-09-13" }),
        task("today", { due: TODAY }),
        task("tomorrow", { due: "2026-09-15" }),
        task("someday", { due: null }),
      ],
    });

    expect(today.overdue.map((t) => t.id)).toEqual(["yesterday"]);
    expect(today.dueToday.map((t) => t.id)).toEqual(["today"]);
    // Tomorrow and no-date are not Today's business.
    expect([...today.overdue, ...today.dueToday].map((t) => t.id)).not.toContain("tomorrow");
  });

  it("puts the oldest overdue task first", () => {
    const today = build({
      tasks: [
        task("last week", { due: "2026-09-07" }),
        task("last month", { due: "2026-08-30" }),
        task("yesterday", { due: "2026-09-13" }),
      ],
    });

    expect(today.overdue.map((t) => t.id)).toEqual(["last month", "last week", "yesterday"]);
  });

  it.each([
    ["the end of a month", "2026-09-01", "2026-08-31"],
    ["the end of a year", "2027-01-01", "2026-12-31"],
    ["a leap day", "2028-03-01", "2028-02-29"],
  ])("counts the day before %s as overdue", (_name, todayKey, yesterday) => {
    const workspace = { ...emptyWorkspace, tasks: [task("t", { due: yesterday })] };

    expect(buildToday(workspace, todayKey, { dayOf }).overdue.map((t) => t.id)).toEqual(["t"]);
  });

  it.each([
    ["a finished overdue task", { due: "2026-09-01", doneAt: 5 }],
    ["a finished task due today", { due: TODAY, doneAt: 5 }],
  ])("never shows %s", (_name, changes) => {
    const today = build({ tasks: [task("t", changes)] });

    expect(today.overdue).toEqual([]);
    expect(today.dueToday).toEqual([]);
  });

  it("shows the next open task in each active project", () => {
    const today = build({
      projects: [project("p-web", "Website relaunch"), project("p-health", "Health")],
      tasks: [
        task("web-done", { projectId: "p-web", doneAt: 5, createdAt: 1 }),
        task("web-next", { projectId: "p-web", createdAt: 2 }),
        task("web-later", { projectId: "p-web", createdAt: 3 }),
        task("health-next", { projectId: "p-health", createdAt: 4 }),
      ],
    });

    expect(today.nextInProjects.map((next) => `${next.project.name}: ${next.task.id}`)).toEqual([
      "Website relaunch: web-next",
      "Health: health-next",
    ]);
  });

  it("leaves out a project with nothing open in it", () => {
    const today = build({
      projects: [project("p-web", "Website relaunch")],
      tasks: [task("web-done", { projectId: "p-web", doneAt: 5 })],
    });

    expect(today.nextInProjects).toEqual([]);
  });

  it("leaves out archived projects", () => {
    const today = build({
      projects: [project("p-old", "Old site", "archived")],
      tasks: [task("old-task", { projectId: "p-old" })],
    });

    expect(today.nextInProjects).toEqual([]);
  });

  it("doesn't repeat a task that is already overdue or due today", () => {
    const today = build({
      projects: [project("p-web", "Website relaunch")],
      tasks: [
        task("web-overdue", { projectId: "p-web", due: "2026-09-01", createdAt: 1 }),
        task("web-next", { projectId: "p-web", createdAt: 2 }),
      ],
    });

    expect(today.overdue.map((t) => t.id)).toEqual(["web-overdue"]);
    expect(today.nextInProjects.map((next) => next.task.id)).toEqual(["web-next"]);
  });

  it("says nothing more about a project whose only task is already listed", () => {
    const today = build({
      projects: [project("p-web", "Website relaunch")],
      tasks: [task("web-today", { projectId: "p-web", due: TODAY })],
    });

    expect(today.nextInProjects).toEqual([]);
  });

  it("counts open Inbox tasks only", () => {
    const today = build({
      projects: [project("p-web", "Website relaunch")],
      tasks: [
        task("inbox-open"),
        task("inbox-done", { doneAt: 5 }),
        task("in-project", { projectId: "p-web" }),
      ],
    });

    expect(today.inboxOpen).toBe(1);
  });

  it("shows what was finished today, most recent first", () => {
    const morning = new Date(2026, 8, 14, 9, 0).getTime();
    const evening = new Date(2026, 8, 14, 20, 0).getTime();
    const yesterday = new Date(2026, 8, 13, 20, 0).getTime();

    const today = build({
      tasks: [
        task("this morning", { doneAt: morning }),
        task("this evening", { doneAt: evening }),
        task("yesterday", { doneAt: yesterday }),
      ],
    });

    expect(today.doneToday.map((t) => t.id)).toEqual(["this evening", "this morning"]);
  });

  it("is not a quiet day when only the Inbox has something in it", () => {
    expect(isQuietDay(build({ tasks: [task("inbox-open")] }))).toBe(false);
  });

  it("is a quiet day when the only thing left is already finished", () => {
    const today = build({ tasks: [task("t", { doneAt: new Date(2026, 8, 14, 9).getTime() })] });

    expect(isQuietDay(today)).toBe(true);
    expect(today.doneToday).toHaveLength(1);
  });

  it("changes nothing in the workspace while sorting", () => {
    const tasks = [task("b", { due: "2026-09-13" }), task("a", { due: "2026-09-01" })];
    const workspace = { ...emptyWorkspace, tasks };

    buildToday(workspace, TODAY, { dayOf });

    expect(workspace.tasks.map((t) => t.id)).toEqual(["b", "a"]);
  });
});
