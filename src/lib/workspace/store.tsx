"use client";

import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from "react";
import { stamp, type WorkspaceCommand } from "./commands";
import { workspaceReducer } from "./reducer";
import { emptyWorkspace, type Workspace } from "./types";

export type WorkspaceStore = Readonly<{
  workspace: Workspace;
  /** Sends one command. Ids and the clock are stamped on here, never inside a component. */
  run: (command: WorkspaceCommand) => void;
}>;

const WorkspaceContext = createContext<WorkspaceStore | null>(null);

export type WorkspaceProviderProps = Readonly<{
  children: ReactNode;
  /** Where the workspace starts. Block 3 will load this from storage. */
  initialWorkspace?: Workspace;
  /** Swapped in tests for ids like `id-1`, so a rendered list is predictable. */
  createId?: () => string;
  /** Swapped in tests for a clock that stands still. */
  now?: () => number;
}>;

/**
 * Owns the whole workspace. Everything below it draws state and sends commands;
 * no component keeps its own copy of a project or a task.
 *
 * In Block 2 the state lives in memory only, so a refresh empties it. Block 3 saves it.
 */
export function WorkspaceProvider({
  children,
  initialWorkspace = emptyWorkspace,
  createId = randomId,
  now = Date.now,
}: WorkspaceProviderProps) {
  const [workspace, dispatch] = useReducer(workspaceReducer, initialWorkspace);

  const run = useCallback(
    (command: WorkspaceCommand) => {
      dispatch(stamp(command, createId(), now()));
    },
    [createId, now],
  );

  const store = useMemo<WorkspaceStore>(() => ({ workspace, run }), [workspace, run]);

  return <WorkspaceContext.Provider value={store}>{children}</WorkspaceContext.Provider>;
}

/** Reads the store. Throws rather than returning an empty workspace, which would hide the bug. */
export function useWorkspace(): WorkspaceStore {
  const store = useContext(WorkspaceContext);
  if (store === null) {
    throw new Error("useWorkspace must be used inside a <WorkspaceProvider>");
  }
  return store;
}

function randomId(): string {
  return crypto.randomUUID();
}
