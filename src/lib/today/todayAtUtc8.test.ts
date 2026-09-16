/**
 * Today, as seen from Manila (UTC+8). The grouping is only as good as the day it's given,
 * and this is the zone where a careless `toISOString()` hands it the wrong one.
 *
 * @jest-environment ./src/test/manilaEnvironment.cjs
 */
import { buildToday } from "./today";
import { dayKeyFromDate, todayKey } from "@/lib/dates/calendar";
import { emptyWorkspace, type Task, type Workspace } from "@/lib/workspace/types";

const dayOf = (at: number) => dayKeyFromDate(new Date(at));

/** Half past midnight on the 21st in Manila — still the 20th in UTC. */
const JUST_AFTER_MIDNIGHT = new Date("2026-09-20T16:30:00Z").getTime();
/** A minute before that midnight: the 20th, late in the evening. */
const LATE_LAST_NIGHT = new Date("2026-09-20T15:59:00Z").getTime();

function task(id: string, changes: Partial<Task> = {}): Task {
  return { id, projectId: null, title: id, due: null, doneAt: null, createdAt: 0, updatedAt: 0, ...changes };
}

function workspaceWith(tasks: readonly Task[]): Workspace {
  return { ...emptyWorkspace, tasks };
}

describe("Today at UTC+8", () => {
  it("moves a task from 'due today' to 'overdue' as the day turns", () => {
    const workspace = workspaceWith([task("call the bank", { due: "2026-09-20" })]);

    const lastNight = buildToday(workspace, todayKey(LATE_LAST_NIGHT), { dayOf });
    expect(lastNight.dueToday.map((t) => t.id)).toEqual(["call the bank"]);
    expect(lastNight.overdue).toEqual([]);

    const justAfterMidnight = buildToday(workspace, todayKey(JUST_AFTER_MIDNIGHT), { dayOf });
    expect(justAfterMidnight.dueToday).toEqual([]);
    expect(justAfterMidnight.overdue.map((t) => t.id)).toEqual(["call the bank"]);
  });

  it("would have kept yesterday's task on today's list if we used UTC", () => {
    // The bug this file exists to prevent: at 00:30 in Manila, toISOString() still says
    // the 20th, so a task due the 20th would look like it's due today.
    const utcDay = new Date(JUST_AFTER_MIDNIGHT).toISOString().slice(0, 10);
    const workspace = workspaceWith([task("call the bank", { due: "2026-09-20" })]);

    expect(utcDay).toBe("2026-09-20");
    expect(buildToday(workspace, utcDay, { dayOf }).dueToday.map((t) => t.id)).toEqual(["call the bank"]);
    expect(buildToday(workspace, todayKey(JUST_AFTER_MIDNIGHT), { dayOf }).dueToday).toEqual([]);
  });

  it("counts a task finished just before midnight as yesterday's work", () => {
    const workspace = workspaceWith([task("gym", { doneAt: LATE_LAST_NIGHT })]);

    expect(buildToday(workspace, todayKey(JUST_AFTER_MIDNIGHT), { dayOf }).doneToday).toEqual([]);
    expect(buildToday(workspace, todayKey(LATE_LAST_NIGHT), { dayOf }).doneToday.map((t) => t.id)).toEqual(["gym"]);
  });

  it("counts a task finished just after midnight as today's", () => {
    const workspace = workspaceWith([task("gym", { doneAt: JUST_AFTER_MIDNIGHT })]);

    expect(buildToday(workspace, todayKey(JUST_AFTER_MIDNIGHT), { dayOf }).doneToday.map((t) => t.id)).toEqual(["gym"]);
  });
});
