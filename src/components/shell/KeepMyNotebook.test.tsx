import { act, render, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { KeepMyNotebook } from "./KeepMyNotebook";
import { DURABLE_ASKED_KEY } from "@/lib/storage/durability";
import { memoryStore, type KeyValueStore } from "@/lib/storage/keyValueStore";
import { WorkspaceProvider } from "@/lib/workspace/store";

type Navigatorish = { storage?: { persisted?: () => Promise<boolean>; persist?: () => Promise<boolean> } };

/** jsdom has no Storage API at all, so every test installs the one it wants. */
function givenBrowserStorage(storage: Navigatorish["storage"]) {
  Object.defineProperty(globalThis.navigator, "storage", { value: storage, configurable: true });
}

function renderIn(store: KeyValueStore, { strict = false } = {}) {
  const tree = (
    <WorkspaceProvider store={store}>
      <KeepMyNotebook />
    </WorkspaceProvider>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}

afterEach(() => {
  Reflect.deleteProperty(globalThis.navigator, "storage");
});

describe("<KeepMyNotebook>", () => {
  it("asks the browser to keep our storage, and remembers the answer", async () => {
    const persist = jest.fn().mockResolvedValue(true);
    givenBrowserStorage({ persisted: async () => false, persist });
    const store = memoryStore();

    renderIn(store);

    await waitFor(() => expect(store.read(DURABLE_ASKED_KEY)).toBe("granted"));
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("remembers a refusal too, so it doesn't nag on every visit", async () => {
    givenBrowserStorage({ persisted: async () => false, persist: async () => false });
    const store = memoryStore();

    renderIn(store);

    await waitFor(() => expect(store.read(DURABLE_ASKED_KEY)).toBe("refused"));
  });

  it("never asks a browser twice", async () => {
    const persist = jest.fn().mockResolvedValue(true);
    givenBrowserStorage({ persisted: async () => false, persist });
    const store = memoryStore({ [DURABLE_ASKED_KEY]: "refused" });

    renderIn(store);

    await waitFor(() => expect(store.read(DURABLE_ASKED_KEY)).toBe("refused"));
    expect(persist).not.toHaveBeenCalled();
  });

  /** StrictMode runs effects twice in development; a double prompt is a real bug. */
  it("asks once even when React mounts it twice", async () => {
    const persist = jest.fn().mockResolvedValue(true);
    givenBrowserStorage({ persisted: async () => false, persist });
    const store = memoryStore();

    renderIn(store, { strict: true });

    await waitFor(() => expect(store.read(DURABLE_ASKED_KEY)).toBe("granted"));
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("writes nothing when the browser has no Storage API", async () => {
    const store = memoryStore();

    renderIn(store);

    // `waitFor` would pass on the first check, before the effect's promise had run at
    // all — a test that can't fail. Let the whole chain settle, then look.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    // Nothing to remember: a browser that gains the API later should still be asked.
    expect(store.read(DURABLE_ASKED_KEY)).toBeNull();
  });

  it("draws nothing", () => {
    givenBrowserStorage({ persist: async () => true });

    const { container } = renderIn(memoryStore());

    expect(container).toBeEmptyDOMElement();
  });
});
