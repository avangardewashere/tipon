"use client";

import { useCallback, useEffect, useReducer } from "react";
import type { KeyValueStore } from "@/lib/storage/keyValueStore";

/** Where a half-written dump waits for you. Separate from the workspace: it isn't data yet. */
export const DRAFT_KEY = "tipon.dump.draft";

type DraftState = Readonly<{ text: string; loaded: boolean }>;
type DraftAction = { type: "loaded"; text: string } | { type: "set"; text: string };

function draftReducer(state: DraftState, action: DraftAction): DraftState {
  switch (action.type) {
    // Whatever you have started typing wins over what was on disk: the load lands late,
    // and nobody's keystrokes should be swallowed by it.
    case "loaded":
      return state.loaded ? state : { text: state.text === "" ? action.text : state.text, loaded: true };

    case "set":
      return { ...state, text: action.text };
  }
}

/**
 * A piece of writing kept in storage as you type, so closing the tab mid-thought costs
 * nothing. Read in an effect, like the workspace, so the server and the browser agree on
 * the first render.
 */
export function useDraft(store: KeyValueStore): Readonly<{
  draft: string;
  loaded: boolean;
  setDraft: (text: string) => void;
  clearDraft: () => void;
}> {
  const [state, dispatch] = useReducer(draftReducer, { text: "", loaded: false });

  useEffect(() => {
    dispatch({ type: "loaded", text: store.read(DRAFT_KEY) ?? "" });
  }, [store]);

  const setDraft = useCallback(
    (text: string) => {
      dispatch({ type: "set", text });
      write(store, text);
    },
    [store],
  );

  const clearDraft = useCallback(() => {
    dispatch({ type: "set", text: "" });
    try {
      store.remove(DRAFT_KEY);
    } catch {
      // A draft that can't be cleared is a nuisance, not a disaster.
    }
  }, [store]);

  return { draft: state.text, loaded: state.loaded, setDraft, clearDraft };
}

function write(store: KeyValueStore, text: string): void {
  try {
    if (text === "") {
      store.remove(DRAFT_KEY);
    } else {
      store.write(DRAFT_KEY, text);
    }
  } catch {
    // The workspace's own save will have said the same thing already; one warning is plenty.
  }
}
