/** @jest-environment node */
import { memoryStore, type KeyValueStore } from "./keyValueStore";
import { serializeSaveFile, toSaveFile } from "./saveFile";
import {
  exportText,
  importText,
  KEPT_PREFIX,
  keptCopies,
  loadWorkspace,
  SAVE_KEY,
  saveWorkspace,
} from "./workspaceStorage";
import type { Workspace } from "@/lib/workspace/types";

const NOW = 1_000;

const workspace: Workspace = {
  dumps: [],
  projects: [{ id: "p-web", name: "Website relaunch", notes: "", status: "active", createdAt: 1, updatedAt: 1 }],
  tasks: [{ id: "t-1", projectId: "p-web", title: "Pick a host", due: null, doneAt: null, createdAt: 2, updatedAt: 2 }],
};

const saved = serializeSaveFile(toSaveFile(workspace, 500));

/** A store that refuses every write, the way a full disk or private mode does. */
function refusingStore(seed: Record<string, string> = {}): KeyValueStore {
  const inner = memoryStore(seed);
  return {
    ...inner,
    write: () => {
      throw new Error("The quota has been exceeded.");
    },
  };
}

describe("loadWorkspace", () => {
  it("says so when nothing has been saved yet", () => {
    expect(loadWorkspace(memoryStore(), NOW)).toEqual({ status: "empty" });
  });

  it("gives back what was saved, and when", () => {
    expect(loadWorkspace(memoryStore({ [SAVE_KEY]: saved }), NOW)).toEqual({
      status: "loaded",
      workspace,
      savedAt: 500,
    });
  });

  it("keeps a copy of anything it can't read, and never wipes it silently", () => {
    const store = memoryStore({ [SAVE_KEY]: "{ half a file" });

    const outcome = loadWorkspace(store, NOW);

    expect(outcome.status).toBe("kept-a-copy");
    expect(outcome).toMatchObject({ keptAs: `${KEPT_PREFIX}${NOW}` });
    expect(store.read(`${KEPT_PREFIX}${NOW}`)).toBe("{ half a file");
    expect(store.read(SAVE_KEY)).toBeNull();
  });

  it("keeps a copy of a file from a newer version too", () => {
    const newer = JSON.stringify({ app: "tipon", version: 2, savedAt: 1, workspace });
    const store = memoryStore({ [SAVE_KEY]: newer });

    const outcome = loadWorkspace(store, NOW);

    expect(outcome).toMatchObject({ status: "kept-a-copy", problem: { kind: "newer-version", version: 2 } });
    expect(store.read(`${KEPT_PREFIX}${NOW}`)).toBe(newer);
  });

  it("leaves the original alone when even the copy can't be written", () => {
    const store = refusingStore({ [SAVE_KEY]: "{ half a file" });

    const outcome = loadWorkspace(store, NOW);

    expect(outcome).toMatchObject({ status: "kept-a-copy", keptAs: null });
    expect(store.read(SAVE_KEY)).toBe("{ half a file");
  });

  it("never overwrites one kept copy with another from the same millisecond", () => {
    const store = memoryStore({ [SAVE_KEY]: "first mess" });
    loadWorkspace(store, NOW);
    store.write(SAVE_KEY, "second mess");

    loadWorkspace(store, NOW);

    expect(store.read(`${KEPT_PREFIX}${NOW}`)).toBe("first mess");
    expect(store.read(`${KEPT_PREFIX}${NOW}-2`)).toBe("second mess");
  });
});

describe("saveWorkspace", () => {
  it("saves and loads back the same workspace", () => {
    const store = memoryStore();

    expect(saveWorkspace(store, workspace, NOW)).toEqual({ ok: true });
    expect(loadWorkspace(store, NOW)).toEqual({ status: "loaded", workspace, savedAt: NOW });
  });

  it("reports a refusal instead of throwing, so the app can keep working", () => {
    const outcome = saveWorkspace(refusingStore(), workspace, NOW);

    expect(outcome).toEqual({ ok: false, reason: "The quota has been exceeded." });
  });
});

describe("importText", () => {
  it("replaces what's saved and keeps the old copy", () => {
    const older: Workspace = {
      dumps: [],
      projects: [{ id: "p-old", name: "Last year", notes: "", status: "active", createdAt: 1, updatedAt: 1 }],
      tasks: [],
    };
    const store = memoryStore({ [SAVE_KEY]: serializeSaveFile(toSaveFile(older, 10)) });

    const outcome = importText(store, exportText(workspace, 900), NOW);

    expect(outcome).toEqual({ ok: true, workspace, keptAs: `${KEPT_PREFIX}${NOW}` });
    expect(loadWorkspace(store, NOW)).toMatchObject({ status: "loaded", workspace });
    expect(store.read(`${KEPT_PREFIX}${NOW}`)).toContain('"Last year"');
  });

  it("has nothing to keep when the browser was empty", () => {
    const outcome = importText(memoryStore(), exportText(workspace, 900), NOW);

    expect(outcome).toEqual({ ok: true, workspace, keptAs: null });
  });

  it("has nothing to keep when the only thing saved is an empty notebook", () => {
    // Opening Tipon writes one of these before you've typed anything.
    const store = memoryStore({ [SAVE_KEY]: serializeSaveFile(toSaveFile({ projects: [], tasks: [], dumps: [] }, 10)) });

    const outcome = importText(store, exportText(workspace, 900), NOW);

    expect(outcome).toEqual({ ok: true, workspace, keptAs: null });
    expect(keptCopies(store)).toEqual([]);
  });

  it("still keeps a copy of a file it couldn't read", () => {
    const store = memoryStore({ [SAVE_KEY]: "{ not a backup" });

    const outcome = importText(store, exportText(workspace, 900), NOW);

    expect(outcome).toEqual({ ok: true, workspace, keptAs: `${KEPT_PREFIX}${NOW}` });
    expect(store.read(`${KEPT_PREFIX}${NOW}`)).toBe("{ not a backup");
  });

  it("changes nothing when the file is no good", () => {
    const store = memoryStore({ [SAVE_KEY]: saved });

    const outcome = importText(store, "{ not a backup", NOW);

    expect(outcome).toEqual({ ok: false, problem: { kind: "not-json" } });
    expect(store.read(SAVE_KEY)).toBe(saved);
    expect(keptCopies(store)).toEqual([]);
  });

  it("refuses rather than replace data it couldn't copy aside first", () => {
    const store = refusingStore({ [SAVE_KEY]: saved });

    const outcome = importText(store, exportText({ projects: [], tasks: [], dumps: [] }, 900), NOW);

    expect(outcome.ok).toBe(false);
    expect(store.read(SAVE_KEY)).toBe(saved);
  });
});

describe("keptCopies", () => {
  it("lists the copies newest first, and nothing else", () => {
    const store = memoryStore({
      [SAVE_KEY]: saved,
      [`${KEPT_PREFIX}1000`]: "a",
      [`${KEPT_PREFIX}3000`]: "b",
      [`${KEPT_PREFIX}2000`]: "c",
    });

    expect(keptCopies(store)).toEqual([`${KEPT_PREFIX}3000`, `${KEPT_PREFIX}2000`, `${KEPT_PREFIX}1000`]);
  });
});
