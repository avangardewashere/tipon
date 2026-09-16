import { StrictMode } from "react";
import { act, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import userEvent from "@testing-library/user-event";
import { storeReducer, useWorkspace, WorkspaceProvider } from "./store";
import { WorkspaceGate } from "@/components/shell/WorkspaceGate";
import { memoryStore } from "@/lib/storage/keyValueStore";
import { parseSaveFile } from "@/lib/storage/saveFile";
import { KEPT_PREFIX, SAVE_KEY, saveWorkspace } from "@/lib/storage/workspaceStorage";
import { emptyWorkspace } from "./types";
import { makeProject, makeWorkspace, NOW, renderWithWorkspace, storeHolding } from "@/test/workspace";

/** A stand-in screen: it sends commands and shows what the workspace says back. */
function Probe() {
  const { workspace, run } = useWorkspace();

  return (
    <div>
      <button type="button" onClick={() => run({ type: "project/add", name: "Website" })}>
        Add project
      </button>
      <ul>
        {workspace.projects.map((project) => (
          <li key={project.id}>{`${project.id} · ${project.name} · ${project.createdAt}`}</li>
        ))}
      </ul>
    </div>
  );
}

describe("WorkspaceProvider", () => {
  it("stamps a new id and the current time onto a command", async () => {
    const { user } = renderWithWorkspace(<Probe />);

    await user.click(screen.getByRole("button", { name: "Add project" }));

    expect(screen.getByRole("listitem")).toHaveTextContent(`id-1 · Website · ${NOW}`);
  });

  it("counts up, so two commands never share an id", async () => {
    const user = userEvent.setup();
    let created = 0;

    render(
      <WorkspaceProvider createId={() => `id-${(created += 1)}`} now={() => NOW}>
        <Probe />
      </WorkspaceProvider>,
    );

    const add = screen.getByRole("button", { name: "Add project" });
    await user.click(add);
    await user.click(add);

    // The second "Website" is refused by the reducer (the name is taken), but the id was
    // still spent: ids are never reused.
    expect(created).toBe(2);
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("starts from the workspace it is given", () => {
    renderWithWorkspace(<Probe />, {
      workspace: makeWorkspace({ projects: [makeProject({ id: "p-web", name: "Website relaunch" })] }),
    });

    expect(screen.getByRole("listitem")).toHaveTextContent("p-web · Website relaunch");
  });

  it("refuses to work outside a provider instead of pretending the workspace is empty", () => {
    const quiet = jest.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<Probe />)).toThrow("useWorkspace must be used inside a <WorkspaceProvider>");

    quiet.mockRestore();
  });
});

describe("WorkspaceProvider and storage", () => {
  const website = makeWorkspace({ projects: [makeProject({ id: "p-web", name: "Website relaunch" })] });

  it("reads the saved workspace when the app opens", () => {
    renderWithWorkspace(<Probe />, { store: storeHolding(website) });

    expect(screen.getByRole("listitem")).toHaveTextContent("p-web · Website relaunch");
  });

  it("saves after every change", async () => {
    const store = memoryStore();
    const { user } = renderWithWorkspace(<Probe />, { store });

    await user.click(screen.getByRole("button", { name: "Add project" }));

    const result = parseSaveFile(store.read(SAVE_KEY) ?? "");
    expect(result.ok === true && result.saveFile.workspace.projects[0]).toMatchObject({ id: "id-1", name: "Website" });
    expect(result.ok === true && result.saveFile.savedAt).toBe(NOW);
  });

  it("never writes anything before it has read what is already there", () => {
    const inner = storeHolding(website);
    const writes: string[] = [];
    const store = { ...inner, write: (key: string, value: string) => { writes.push(`${key}=${value}`); inner.write(key, value); } };

    renderWithWorkspace(<Probe />, { store });

    // Saving the empty starting workspace first would wipe the file we were about to read.
    expect(writes.every((write) => write.includes("Website relaunch"))).toBe(true);
  });

  it("starts fresh but keeps a copy when the saved data is unreadable", () => {
    const store = memoryStore({ [SAVE_KEY]: "{ half a file" });

    renderWithWorkspace(
      <>
        <Probe />
        <Notice />
      </>,
      { store },
    );

    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
    expect(screen.getByTestId("notice")).toHaveTextContent(`kept as “${KEPT_PREFIX}${NOW}”`);
    expect(store.read(`${KEPT_PREFIX}${NOW}`)).toBe("{ half a file");
  });

  it("reads the saved copy once, even though React runs effects twice in development", () => {
    const store = memoryStore({ [SAVE_KEY]: "{ half a file" });

    render(
      <StrictMode>
        <WorkspaceProvider store={store} now={() => NOW}>
          <Notice />
        </WorkspaceProvider>
      </StrictMode>,
    );

    // A second read would find the mess already tidied away and say everything was fine.
    expect(screen.getByTestId("notice")).toHaveTextContent("kept as");
    expect(store.keys().filter((key) => key.startsWith(KEPT_PREFIX))).toHaveLength(1);
  });

  it("refuses to save over data it could not copy aside", async () => {
    const inner = memoryStore({ [SAVE_KEY]: "{ half a file" });
    const store = {
      ...inner,
      write: () => {
        throw new Error("The quota has been exceeded.");
      },
    };
    const { user } = renderWithWorkspace(<Probe />, { store });

    await user.click(screen.getByRole("button", { name: "Add project" }));

    expect(store.read(SAVE_KEY)).toBe("{ half a file");
  });

  it("says so when the browser won't save at all", async () => {
    const store = {
      ...memoryStore(),
      write: () => {
        throw new Error("The quota has been exceeded.");
      },
    };
    const { user } = renderWithWorkspace(<Notice />, { store });

    // Nothing was saved before, so loading is fine; the first change is what fails.
    await user.click(screen.getByRole("button", { name: "Add project" }));

    expect(screen.getByTestId("notice")).toHaveTextContent("can't save on this device");
  });
});

describe("two tabs of Tipon", () => {
  const website = makeWorkspace({ projects: [makeProject({ id: "p-web", name: "Website relaunch" })] });

  /** A store that counts what it was asked to write, so a loop shows up as a number. */
  function countingStore(inner = memoryStore()) {
    const writes: string[] = [];
    return {
      store: { ...inner, write: (key: string, value: string) => { writes.push(key); inner.write(key, value); } },
      writes,
    };
  }

  it("doesn't write back what it just read", () => {
    const { store, writes } = countingStore(storeHolding(website));

    renderWithWorkspace(<Probe />, { store });

    // Two tabs both saving what they just loaded is a loop that never settles.
    expect(writes).toEqual([]);
  });

  it("doesn't write back what another tab saved either", () => {
    const { store, writes } = countingStore();
    renderWithWorkspace(<Probe />, { store });
    saveWorkspace(store, website, NOW);
    writes.length = 0;

    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: SAVE_KEY }));
    });

    expect(writes).toEqual([]);
    expect(screen.getByRole("listitem")).toHaveTextContent("Website relaunch");
  });

  it("still saves a change of its own after reading another tab's", async () => {
    const { store, writes } = countingStore();
    const { user } = renderWithWorkspace(<Probe />, { store });
    saveWorkspace(store, makeWorkspace({ projects: [makeProject({ id: "p-1", name: "Health" })] }), NOW);
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: SAVE_KEY }));
    });
    writes.length = 0;

    await user.click(screen.getByRole("button", { name: "Add project" }));

    expect(writes).toEqual([SAVE_KEY]);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("picks up what another tab saved", () => {
    const store = memoryStore();
    renderWithWorkspace(<Probe />, { store });
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();

    // The other tab saves, and the browser tells this one.
    saveWorkspace(store, website, NOW);
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: SAVE_KEY }));
    });

    expect(screen.getByRole("listitem")).toHaveTextContent("p-web · Website relaunch");
  });

  it("takes notice when the whole of storage is cleared", () => {
    const store = memoryStore();
    renderWithWorkspace(<Probe />, { store });

    saveWorkspace(store, website, NOW);
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: null }));
    });

    expect(screen.getByRole("listitem")).toHaveTextContent("Website relaunch");
  });

  it("ignores a change to something that isn't the workspace", () => {
    const store = memoryStore();
    renderWithWorkspace(<Probe />, { store });

    saveWorkspace(store, website, NOW);
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "tipon.dump.draft" }));
    });

    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });
});

describe("the first render", () => {
  it("matches on the server and in the browser, whatever is saved", () => {
    const store = storeHolding(makeWorkspace({ projects: [makeProject({ id: "p-web", name: "Website relaunch" })] }));

    // The server has no localStorage, so it can only draw the waiting line …
    const onTheServer = renderToStaticMarkup(
      <WorkspaceProvider store={memoryStore()} now={() => NOW}>
        <WorkspaceGate>
          <Probe />
        </WorkspaceGate>
      </WorkspaceProvider>,
    );

    // … and so does the browser's first render, even with a full workspace waiting for it.
    // Matching first renders is what keeps React from throwing a hydration error.
    const inTheBrowser = renderToStaticMarkup(
      <WorkspaceProvider store={store} now={() => NOW}>
        <WorkspaceGate>
          <Probe />
        </WorkspaceGate>
      </WorkspaceProvider>,
    );

    expect(onTheServer).toBe(inTheBrowser);
    expect(onTheServer).toContain("Opening your notebook");
    expect(onTheServer).not.toContain("Website relaunch");
  });
});

/** Shows whatever the provider wants the person to know, plus a way to cause a save. */
function Notice() {
  const { notice, run } = useWorkspace();

  return (
    <div>
      <p data-testid="notice">{notice ?? "all well"}</p>
      <button type="button" onClick={() => run({ type: "project/add", name: "Website" })}>
        Add project
      </button>
    </div>
  );
}

describe("storeReducer", () => {
  const loading = { workspace: emptyWorkspace, status: "loading" as const, notice: null, canSave: false };
  const website = makeWorkspace({ projects: [makeProject({ id: "p-web", name: "Website relaunch" })] });

  it("is ready and saving after an empty load", () => {
    expect(storeReducer(loading, { type: "store/loaded", outcome: { status: "empty" } })).toEqual({
      workspace: emptyWorkspace,
      status: "ready",
      notice: null,
      canSave: true,
    });
  });

  it("is ready with the loaded workspace", () => {
    const next = storeReducer(loading, {
      type: "store/loaded",
      outcome: { status: "loaded", workspace: website, savedAt: 500 },
    });

    expect(next).toMatchObject({ workspace: website, status: "ready", canSave: true, notice: null });
  });

  it("keeps saving on after a kept copy, because the mess is safely out of the way", () => {
    const next = storeReducer(loading, {
      type: "store/loaded",
      outcome: { status: "kept-a-copy", problem: { kind: "not-json" }, keptAs: "tipon.kept.1000" },
    });

    expect(next.canSave).toBe(true);
    expect(next.notice).toContain("tipon.kept.1000");
  });

  it("switches saving off when the mess could not be copied aside", () => {
    const next = storeReducer(loading, {
      type: "store/loaded",
      outcome: { status: "kept-a-copy", problem: { kind: "not-json" }, keptAs: null },
    });

    expect(next.canSave).toBe(false);
    expect(next.notice).toContain("won't save over it");
  });

  it("passes everything else to Block 1's reducer, and keeps the same object when nothing changed", () => {
    const ready = { ...loading, status: "ready" as const, workspace: website, canSave: true };

    const added = storeReducer(ready, { type: "project/add", id: "p-2", name: "Health", now: NOW });
    expect(added.workspace.projects).toHaveLength(2);

    // A refused action (the name is taken) must not make a new state object either.
    expect(storeReducer(ready, { type: "project/add", id: "p-3", name: "website relaunch", now: NOW })).toBe(ready);
  });
});
