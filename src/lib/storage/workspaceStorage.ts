import type { KeyValueStore } from "./keyValueStore";
import {
  parseSaveFile,
  serializeSaveFile,
  toSaveFile,
  type SaveProblem,
} from "./saveFile";
import type { Workspace } from "@/lib/workspace/types";

/** Where the workspace lives. The version is in the file, not in the key. */
export const SAVE_KEY = "tipon.workspace";

/** Anything we couldn't read, and anything an import replaced, is copied to a key like this. */
export const KEPT_PREFIX = "tipon.kept.";

export type LoadOutcome =
  | { status: "empty" }
  | { status: "loaded"; workspace: Workspace; savedAt: number }
  /**
   * We found something we couldn't read. It was copied aside, never thrown away.
   * `keptAs` is `null` when even the copy failed — then the original is left exactly
   * where it is, and saving is off for the session so nothing can overwrite it.
   */
  | { status: "kept-a-copy"; problem: SaveProblem; keptAs: string | null };

export type SaveOutcome = { ok: true } | { ok: false; reason: string };

export type ImportOutcome =
  | { ok: true; workspace: Workspace; keptAs: string | null }
  | { ok: false; problem: SaveProblem };

export function loadWorkspace(store: KeyValueStore, now: number): LoadOutcome {
  const text = store.read(SAVE_KEY);
  if (text === null) return { status: "empty" };

  const result = parseSaveFile(text);
  if (!result.ok) {
    // Nothing is wiped silently: the unreadable text is moved out of the way and kept.
    try {
      const keptAs = keepACopy(store, text, now);
      store.remove(SAVE_KEY);
      return { status: "kept-a-copy", problem: result.problem, keptAs };
    } catch {
      return { status: "kept-a-copy", problem: result.problem, keptAs: null };
    }
  }

  return { status: "loaded", workspace: result.saveFile.workspace, savedAt: result.saveFile.savedAt };
}

export function saveWorkspace(store: KeyValueStore, workspace: Workspace, now: number): SaveOutcome {
  try {
    store.write(SAVE_KEY, serializeSaveFile(toSaveFile(workspace, now)));
    return { ok: true };
  } catch (error) {
    // A full disk, or a browser with site data switched off. The app keeps working from
    // memory; it just has to say that this session won't survive a refresh.
    return { ok: false, reason: reason(error) };
  }
}

/** The text an export downloads. */
export function exportText(workspace: Workspace, now: number): string {
  return serializeSaveFile(toSaveFile(workspace, now));
}

export const EXPORT_FILE_NAME = "tipon-backup.json";

/**
 * Reads a backup someone picked. The workspace it replaces is copied aside first, so an
 * import can always be undone from the kept copy.
 */
export function importText(store: KeyValueStore, text: string, now: number): ImportOutcome {
  const result = parseSaveFile(text);
  if (!result.ok) return { ok: false, problem: result.problem };

  const current = store.read(SAVE_KEY);
  let keptAs: string | null = null;
  if (current !== null && !holdsNothing(current)) {
    try {
      keptAs = keepACopy(store, current, now);
    } catch (error) {
      // Refuse the import rather than replace data we couldn't copy first.
      return {
        ok: false,
        problem: { kind: "not-a-save-file", detail: `your current data couldn't be copied aside first (${reason(error)})` },
      };
    }
  }

  const outcome = saveWorkspace(store, result.saveFile.workspace, now);
  if (!outcome.ok) {
    // Couldn't write: say nothing happened rather than claim a half-done import.
    return { ok: false, problem: { kind: "not-a-save-file", detail: `it couldn't be saved (${outcome.reason})` } };
  }

  return { ok: true, workspace: result.saveFile.workspace, keptAs };
}

/** The keys of every copy we kept, newest first. */
export function keptCopies(store: KeyValueStore): readonly string[] {
  return store
    .keys()
    .filter((key) => key.startsWith(KEPT_PREFIX))
    .sort()
    .reverse();
}

/**
 * Opening Tipon in a new browser writes an empty save file before you've typed anything.
 * Keeping a copy of that would be a lie — "what was here before" was nothing — and it
 * would leave a junk copy on the Backup screen. Anything we can't read still gets kept:
 * only a file we understand, and that holds nothing, is safe to drop.
 */
function holdsNothing(text: string): boolean {
  const result = parseSaveFile(text);
  if (!result.ok) return false;

  const { projects, tasks, dumps } = result.saveFile.workspace;
  return projects.length === 0 && tasks.length === 0 && dumps.length === 0;
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : "unknown";
}

function keepACopy(store: KeyValueStore, text: string, now: number): string {
  let key = `${KEPT_PREFIX}${now}`;
  // Two copies in the same millisecond would overwrite each other.
  let attempt = 1;
  while (store.read(key) !== null) {
    attempt += 1;
    key = `${KEPT_PREFIX}${now}-${attempt}`;
  }

  store.write(key, text);
  return key;
}
