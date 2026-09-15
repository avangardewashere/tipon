"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { stamp, type WorkspaceCommand } from "./commands";
import { workspaceReducer, type WorkspaceAction } from "./reducer";
import { emptyWorkspace, type Workspace } from "./types";
import { browserStore, memoryStore, type KeyValueStore } from "@/lib/storage/keyValueStore";
import { describeProblem } from "@/lib/storage/saveFile";
import { loadWorkspace, saveWorkspace, type LoadOutcome } from "@/lib/storage/workspaceStorage";

/** "loading" until the browser's saved copy has been read. The server never gets past it. */
export type WorkspaceStatus = "loading" | "ready";

export type WorkspaceStore = Readonly<{
  workspace: Workspace;
  status: WorkspaceStatus;
  /** Something the person needs to know: a copy we kept, or saving being off. `null` when all is well. */
  notice: string | null;
  dismissNotice: () => void;
  /** Sends one command. Ids and the clock are stamped on here, never inside a component. */
  run: (command: WorkspaceCommand) => void;
  /**
   * Sends actions that were worked out together — a brain dump's whole commit, where a
   * task needs the id of the project made one action earlier. Use `run` for anything else.
   */
  runAll: (actions: readonly WorkspaceAction[]) => void;
  /** The id maker, for the same reason: pure code that builds actions needs one. */
  createId: () => string;
  /** Swaps in a whole workspace, which only an import does. */
  replaceWorkspace: (workspace: Workspace) => void;
  /** The store the screens save to, handed to the Backup screen for export and import. */
  store: KeyValueStore;
  /** The same clock the provider stamps commands with, so a backup's time matches. */
  now: () => number;
}>;

const WorkspaceContext = createContext<WorkspaceStore | null>(null);

export type WorkspaceProviderProps = Readonly<{
  children: ReactNode;
  /** Where to save. Tests pass a `Map`-backed store; the app uses `localStorage`. */
  store?: KeyValueStore;
  /** Swapped in tests for ids like `id-1`, so a rendered list is predictable. */
  createId?: () => string;
  /** Swapped in tests for a clock that stands still. */
  now?: () => number;
}>;

/**
 * Owns the whole workspace. Everything below it draws state and sends commands;
 * no component keeps its own copy of a project or a task.
 *
 * Loading happens in an effect, not during the first render, because the server has no
 * `localStorage`: server and browser both render the same "loading" first, then the
 * browser fills it in. That's the whole hydration rule in one sentence.
 */
export function WorkspaceProvider({
  children,
  store: given,
  createId = randomId,
  now = Date.now,
}: WorkspaceProviderProps) {
  // Settled once. A new store halfway through would mean two different saved copies.
  const [store] = useState(() => given ?? browserStore() ?? memoryStore());
  const [state, dispatch] = useReducer(storeReducer, startingState);
  const loadedFrom = useRef<KeyValueStore | null>(null);

  useEffect(() => {
    // Once per store, and no more. React runs effects twice in development, and reading
    // twice would undo the first read's work: the second pass would find the unreadable
    // file already copied aside, decide everything is fine, and quietly drop the message
    // saying what happened.
    if (loadedFrom.current === store) return;
    loadedFrom.current = store;

    dispatch({ type: "store/loaded", outcome: loadWorkspace(store, now()) });
  }, [store, now]);

  useEffect(() => {
    // `canSave` is false until the load effect above has run, so nothing is ever written
    // over a file we haven't read yet. It stays false for good if the saved copy turned out
    // to be unreadable and we couldn't copy it aside: saving over data we couldn't keep is
    // the one thing we won't do.
    if (!state.canSave) return;

    const outcome = saveWorkspace(store, state.workspace, now());
    if (!outcome.ok) {
      dispatch({
        type: "store/notice",
        notice: `Tipon can't save on this device (${outcome.reason}). Your work is here until you close the tab.`,
      });
    }
  }, [state.workspace, state.canSave, store, now]);

  const run = useCallback(
    (command: WorkspaceCommand) => {
      dispatch(stamp(command, createId(), now()));
    },
    [createId, now],
  );

  const runAll = useCallback((actions: readonly WorkspaceAction[]) => {
    // React applies these in order and renders once, so the reducer sees the project
    // before the task that points at it.
    for (const action of actions) dispatch(action);
  }, []);

  const replaceWorkspace = useCallback((workspace: Workspace) => {
    dispatch({ type: "store/replace", workspace });
  }, []);

  const dismissNotice = useCallback(() => dispatch({ type: "store/notice", notice: null }), []);

  const value = useMemo<WorkspaceStore>(
    () => ({
      workspace: state.workspace,
      status: state.status,
      notice: state.notice,
      dismissNotice,
      run,
      runAll,
      createId,
      replaceWorkspace,
      store,
      now,
    }),
    [state, dismissNotice, run, runAll, createId, replaceWorkspace, store, now],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

/** Reads the store. Throws rather than returning an empty workspace, which would hide the bug. */
export function useWorkspace(): WorkspaceStore {
  const store = useContext(WorkspaceContext);
  if (store === null) {
    throw new Error("useWorkspace must be used inside a <WorkspaceProvider>");
  }
  return store;
}

type StoreState = Readonly<{
  workspace: Workspace;
  status: WorkspaceStatus;
  notice: string | null;
  canSave: boolean;
}>;

const startingState: StoreState = {
  workspace: emptyWorkspace,
  status: "loading",
  notice: null,
  canSave: false,
};

/**
 * Block 1's reducer, wrapped in the three things only this file needs: what loading found,
 * swapping in an imported workspace, and the message on screen. None of them belong in
 * `WorkspaceAction`, because that list is the v1 API and "replace everything" is not an API call.
 *
 * It's a reducer rather than four `useState`s so the effects only ever *dispatch*: one
 * update, one render, and the whole of "what happened when we loaded" stays in one pure
 * function that a test can call on its own.
 */
type StoreAction =
  | WorkspaceAction
  | { type: "store/loaded"; outcome: LoadOutcome }
  | { type: "store/replace"; workspace: Workspace }
  | { type: "store/notice"; notice: string | null };

export function storeReducer(state: StoreState, action: StoreAction): StoreState {
  switch (action.type) {
    case "store/loaded":
      return { ...state, ...afterLoading(action.outcome) };

    case "store/replace":
      return { ...state, workspace: action.workspace };

    case "store/notice":
      return state.notice === action.notice ? state : { ...state, notice: action.notice };

    default: {
      const workspace = workspaceReducer(state.workspace, action);
      return workspace === state.workspace ? state : { ...state, workspace };
    }
  }
}

function afterLoading(outcome: LoadOutcome): Omit<StoreState, "status"> & { status: WorkspaceStatus } {
  switch (outcome.status) {
    case "empty":
      return { workspace: emptyWorkspace, status: "ready", notice: null, canSave: true };

    case "loaded":
      return { workspace: outcome.workspace, status: "ready", notice: null, canSave: true };

    case "kept-a-copy":
      return {
        workspace: emptyWorkspace,
        status: "ready",
        canSave: outcome.keptAs !== null,
        notice:
          outcome.keptAs === null
            ? `${describeProblem(outcome.problem)} It has been left exactly as it is, and Tipon won't save over it. Export a backup before you close this tab.`
            : `${describeProblem(outcome.problem)} Your old data was kept as “${outcome.keptAs}”, and Tipon has started fresh.`,
      };
  }
}

function randomId(): string {
  return crypto.randomUUID();
}
