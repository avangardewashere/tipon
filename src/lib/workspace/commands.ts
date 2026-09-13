import type { DayKey } from "@/lib/dates/dayKey";
import type { ProjectChanges, TaskChanges, WorkspaceAction } from "./reducer";

/**
 * What a screen asks for. A command is an action with the two things a component
 * has no business inventing left out: the `id` of a brand-new record, and `now`.
 *
 * Components send commands; {@link stamp} turns one into the action the reducer takes.
 * Keeping it this way means the reducer stays pure (Block 1, idea 2) while buttons
 * still get real ids and a real clock.
 */
export type WorkspaceCommand =
  | { type: "project/add"; name: string }
  | { type: "project/edit"; id: string; changes: ProjectChanges }
  | { type: "project/archive"; id: string }
  | { type: "project/unarchive"; id: string }
  | { type: "task/add"; title: string; projectId: string | null; due: DayKey | null }
  | { type: "task/edit"; id: string; changes: TaskChanges }
  | { type: "task/complete"; id: string }
  | { type: "task/reopen"; id: string }
  | { type: "task/move"; id: string; projectId: string | null }
  | { type: "task/delete"; id: string };

/**
 * Adds `newId` to the two commands that create a record, and `now` to every command
 * that changes one. `task/delete` needs neither, so it is passed straight through.
 */
export function stamp(command: WorkspaceCommand, newId: string, now: number): WorkspaceAction {
  switch (command.type) {
    case "project/add":
    case "task/add":
      return { ...command, id: newId, now };

    case "task/delete":
      return command;

    default:
      return { ...command, now };
  }
}
