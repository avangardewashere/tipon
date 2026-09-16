"use client";

import { useCallback, useEffect, useReducer } from "react";
import type { KeyValueStore } from "@/lib/storage/keyValueStore";

/** Where a half-written dump waits for you. Separate from the workspace: it isn't data yet. */
export const DRAFT_KEY = "tipon.dump.draft";

/** The access code for Claude. Kept per browser, like everything else Tipon knows. */
export const ACCESS_CODE_KEY = "tipon.accessCode";

/** Set once the welcome on Today has been read and dismissed. */
export const WELCOME_KEY = "tipon.welcomeDone";

type SavedTextState = Readonly<{ text: string; loaded: boolean }>;
type SavedTextAction = { type: "loaded"; text: string } | { type: "set"; text: string };

function savedTextReducer(state: SavedTextState, action: SavedTextAction): SavedTextState {
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
 * A piece of text kept in storage as you type — a half-written dump, an access code — so
 * closing the tab costs nothing. Read in an effect, like the workspace, so the server and
 * the browser agree on the first render.
 */
export function useSavedText(
  store: KeyValueStore,
  key: string,
): Readonly<{
  text: string;
  loaded: boolean;
  setText: (text: string) => void;
  clearText: () => void;
}> {
  const [state, dispatch] = useReducer(savedTextReducer, { text: "", loaded: false });

  useEffect(() => {
    dispatch({ type: "loaded", text: store.read(key) ?? "" });
  }, [store, key]);

  const setText = useCallback(
    (text: string) => {
      dispatch({ type: "set", text });
      write(store, key, text);
    },
    [store, key],
  );

  const clearText = useCallback(() => {
    dispatch({ type: "set", text: "" });
    try {
      store.remove(key);
    } catch {
      // Text that can't be cleared is a nuisance, not a disaster.
    }
  }, [store, key]);

  return { text: state.text, loaded: state.loaded, setText, clearText };
}

function write(store: KeyValueStore, key: string, text: string): void {
  try {
    if (text === "") {
      store.remove(key);
    } else {
      store.write(key, text);
    }
  } catch {
    // The workspace's own save will have said the same thing already; one warning is plenty.
  }
}
