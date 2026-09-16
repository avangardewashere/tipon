/**
 * The Today screen, drawn in a browser in Manila (UTC+8).
 *
 * `today.ts` is told which day it is and how to read a completion time; this file checks
 * the screen hands it the right answers. At half past midnight on the 21st, the shortcut
 * everyone reaches for — `toISOString()` — still says the 20th.
 *
 * @jest-environment ./src/test/manilaBrowserEnvironment.cjs
 */
import { screen } from "@testing-library/react";
import { TodayScreen } from "./TodayScreen";
import { WELCOME_KEY } from "@/lib/dump/useSavedText";
import { memoryStore } from "@/lib/storage/keyValueStore";
import { exportText, SAVE_KEY } from "@/lib/storage/workspaceStorage";
import type { Task } from "@/lib/workspace/types";
import { makeTask, makeWorkspace, renderWithWorkspace } from "@/test/workspace";

/** 00:30 on the 21st in Manila, which is still the 20th in UTC. */
const JUST_AFTER_MIDNIGHT = new Date("2026-09-20T16:30:00Z").getTime();
/** 23:59 on the 20th in Manila. */
const LATE_LAST_NIGHT = new Date("2026-09-20T15:59:00Z").getTime();

function render(tasks: readonly Task[], now: number) {
  const workspace = makeWorkspace({ tasks });
  return renderWithWorkspace(<TodayScreen />, {
    now,
    store: memoryStore({ [SAVE_KEY]: exportText(workspace, now), [WELCOME_KEY]: "done" }),
  });
}

describe("Today in a browser at UTC+8", () => {
  it("says the day you can see on your own wall", () => {
    render([], JUST_AFTER_MIDNIGHT);

    expect(screen.getByText("2026-09-21")).toBeInTheDocument();
    expect(screen.queryByText("2026-09-20")).not.toBeInTheDocument();
  });

  it("calls yesterday's task overdue as soon as midnight passes", () => {
    render([makeTask({ id: "t", title: "call the bank", due: "2026-09-20" })], JUST_AFTER_MIDNIGHT);

    expect(screen.getByRole("region", { name: "Overdue" })).toHaveTextContent("call the bank");
  });

  it("counts a task finished just after midnight as today's work", () => {
    render([makeTask({ id: "t", title: "gym", doneAt: JUST_AFTER_MIDNIGHT })], JUST_AFTER_MIDNIGHT);

    expect(screen.getByText("1 finished today")).toBeInTheDocument();
  });

  it("leaves last night's finished work on last night", () => {
    render([makeTask({ id: "t", title: "gym", doneAt: LATE_LAST_NIGHT })], JUST_AFTER_MIDNIGHT);

    expect(screen.queryByText(/finished today/)).not.toBeInTheDocument();
  });
});
