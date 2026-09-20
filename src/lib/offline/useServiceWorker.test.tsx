import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import {
  useServiceWorker,
  type ContainerLike,
  type RegistrationLike,
  type WorkerLike,
  type UseServiceWorkerOptions,
} from "./useServiceWorker";

/** A worker whose `state` we can move, the way an install does. */
function fakeWorker(state = "installing") {
  const listeners = new Map<string, () => void>();
  const messages: unknown[] = [];
  const worker = {
    state,
    postMessage: (message: unknown) => messages.push(message),
    addEventListener: (type: string, handler: () => void) => listeners.set(type, handler),
  };
  return {
    worker: worker as WorkerLike,
    messages,
    becomes(next: string) {
      worker.state = next;
      listeners.get("statechange")?.();
    },
  };
}

function fakeContainer({ waiting = null, controller = {} as unknown }: { waiting?: WorkerLike | null; controller?: unknown } = {}) {
  const containerListeners = new Map<string, () => void>();
  const registrationListeners = new Map<string, () => void>();
  const registration = {
    waiting,
    installing: null as WorkerLike | null,
    addEventListener: (type: string, handler: () => void) => registrationListeners.set(type, handler),
  };
  const register = jest.fn(async () => registration as RegistrationLike);

  return {
    container: {
      register,
      controller,
      addEventListener: (type: string, handler: () => void) => containerListeners.set(type, handler),
    } as ContainerLike,
    register,
    /** An update arriving: a worker starts installing, then finishes. */
    updateFound(worker: WorkerLike) {
      registration.installing = worker;
      registrationListeners.get("updatefound")?.();
    },
    controllerChanged: () => containerListeners.get("controllerchange")?.(),
  };
}

function Probe(options: UseServiceWorkerOptions) {
  const { updateReady, applyUpdate } = useServiceWorker({ enabled: true, ...options });
  return (
    <div>
      <span>{updateReady ? "update ready" : "up to date"}</span>
      <button type="button" onClick={applyUpdate}>
        Reload to use it
      </button>
    </div>
  );
}

describe("useServiceWorker", () => {
  it("registers the worker", async () => {
    const fake = fakeContainer();

    render(<Probe container={fake.container} />);

    await waitFor(() => expect(fake.register).toHaveBeenCalledWith("/sw.js"));
  });

  it("registers once even when React mounts it twice", async () => {
    const fake = fakeContainer();

    render(
      <StrictMode>
        <Probe container={fake.container} />
      </StrictMode>,
    );

    await waitFor(() => expect(fake.register).toHaveBeenCalledTimes(1));
  });

  it("stays out of development", async () => {
    const fake = fakeContainer();

    render(<Probe container={fake.container} enabled={false} />);

    await act(async () => {});
    expect(fake.register).not.toHaveBeenCalled();
  });

  it("does nothing in a browser with no service workers", async () => {
    render(<Probe container={null} />);

    await act(async () => {});
    expect(screen.getByText("up to date")).toBeInTheDocument();
  });

  it("says nothing on a first install, when there's nothing to replace", async () => {
    // No controller: this is the very first worker, not an update.
    const fake = fakeContainer({ controller: null });
    render(<Probe container={fake.container} />);
    await waitFor(() => expect(fake.register).toHaveBeenCalled());
    const installing = fakeWorker();

    await act(async () => {
      fake.updateFound(installing.worker);
      installing.becomes("installed");
    });

    expect(screen.getByText("up to date")).toBeInTheDocument();
  });

  it("offers the update once a newer worker has installed", async () => {
    const fake = fakeContainer();
    render(<Probe container={fake.container} />);
    await waitFor(() => expect(fake.register).toHaveBeenCalled());
    const installing = fakeWorker();

    await act(async () => {
      fake.updateFound(installing.worker);
      installing.becomes("installed");
    });

    expect(screen.getByText("update ready")).toBeInTheDocument();
  });

  it("notices a worker that was already waiting from an earlier visit", async () => {
    const already = fakeWorker("installed");
    const fake = fakeContainer({ waiting: already.worker });

    render(<Probe container={fake.container} />);

    expect(await screen.findByText("update ready")).toBeInTheDocument();
  });

  it("only tells the worker to take over when the button is clicked", async () => {
    const already = fakeWorker("installed");
    const fake = fakeContainer({ waiting: already.worker });
    render(<Probe container={fake.container} />);
    await screen.findByText("update ready");

    expect(already.messages).toEqual([]);

    await userEvent.click(screen.getByRole("button", { name: "Reload to use it" }));

    expect(already.messages).toEqual([{ type: "skip-waiting" }]);
  });

  it("reloads once the new worker is in charge", async () => {
    const reload = jest.fn();
    const fake = fakeContainer();
    render(<Probe container={fake.container} reload={reload} />);
    await waitFor(() => expect(fake.register).toHaveBeenCalled());

    act(() => fake.controllerChanged());

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("survives a browser that refuses to register one", async () => {
    const fake = fakeContainer();
    (fake.container.register as jest.Mock).mockRejectedValue(new Error("insecure origin"));

    render(<Probe container={fake.container} />);

    await act(async () => {});
    // No crash, no notice: the app works, it just won't open offline.
    expect(screen.getByText("up to date")).toBeInTheDocument();
  });
});
