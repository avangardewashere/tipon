"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";

/** What the page needs to know about the worker: whether a newer one is waiting. */
export type ServiceWorkerState = Readonly<{ updateReady: boolean }>;

type Action = { type: "update-ready" };

function reducer(state: ServiceWorkerState, action: Action): ServiceWorkerState {
  switch (action.type) {
    case "update-ready":
      return state.updateReady ? state : { updateReady: true };
  }
}

/** The slice of `navigator.serviceWorker` used here. Tests pass their own. */
export type ContainerLike = Readonly<{
  register: (path: string) => Promise<RegistrationLike>;
  controller: unknown;
  addEventListener: (type: string, handler: () => void) => void;
}>;

export type WorkerLike = Readonly<{
  state: string;
  postMessage: (message: unknown) => void;
  addEventListener: (type: string, handler: () => void) => void;
}>;

export type RegistrationLike = Readonly<{
  waiting: WorkerLike | null;
  installing: WorkerLike | null;
  addEventListener: (type: string, handler: () => void) => void;
}>;

export type UseServiceWorkerOptions = Readonly<{
  /**
   * Off in development: a cached shell in front of a dev server is a confusing way to
   * spend an afternoon. Tests turn it on with their own container.
   */
  enabled?: boolean;
  container?: ContainerLike | null;
  path?: string;
  /** Called once the new worker has taken over. The app's own reload, injected. */
  reload?: () => void;
}>;

/**
 * Registers the service worker and watches for a newer one.
 *
 * Runs effects and returns state; it draws nothing. `applyUpdate` is the only thing that
 * ever tells a waiting worker to take over — never the worker itself, so the shell can't
 * change underneath a half-typed dump.
 */
export function useServiceWorker(
  options: UseServiceWorkerOptions = {},
): Readonly<{ updateReady: boolean; applyUpdate: () => void }> {
  const {
    enabled = process.env.NODE_ENV === "production",
    container = typeof navigator === "undefined" ? null : (navigator.serviceWorker as unknown as ContainerLike),
    path = "/sw.js",
    reload,
  } = options;

  const [state, dispatch] = useReducer(reducer, { updateReady: false });
  const waiting = useRef<WorkerLike | null>(null);
  // StrictMode mounts effects twice; registering twice is noise at best.
  const started = useRef(false);

  useEffect(() => {
    if (!enabled || !container || started.current) return;
    started.current = true;

    const noticeWaiting = (worker: WorkerLike | null) => {
      if (!worker) return;
      waiting.current = worker;
      dispatch({ type: "update-ready" });
    };

    // A worker that takes over is the moment the new shell is really in charge.
    container.addEventListener("controllerchange", () => reload?.());

    void container
      .register(path)
      .then((registration) => {
        // Already waiting from an earlier visit.
        if (registration.waiting) noticeWaiting(registration.waiting);

        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;

          installing.addEventListener("statechange", () => {
            // No controller means this is the first install, not an update: there is
            // nothing to replace and nothing to tell anyone about.
            if (installing.state === "installed" && container.controller) noticeWaiting(installing);
          });
        });
      })
      .catch(() => {
        // An unregisterable worker (no HTTPS, storage off) is not an error the person
        // can do anything about. The app works; it just won't open offline.
      });
  }, [enabled, container, path, reload]);

  const applyUpdate = useCallback(() => {
    waiting.current?.postMessage({ type: "skip-waiting" });
  }, []);

  return { updateReady: state.updateReady, applyUpdate };
}
