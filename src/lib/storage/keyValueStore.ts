/**
 * The only thing the rest of the app knows about storage: strings in, strings out.
 *
 * The app passes a store backed by `localStorage`; tests pass one backed by a `Map`.
 * Neither side knows the difference, so nothing in a test ever touches a real browser.
 */
export type KeyValueStore = Readonly<{
  read(key: string): string | null;
  /** Throws when the browser refuses, which is usually a full disk or private mode. */
  write(key: string, value: string): void;
  remove(key: string): void;
  /** Every key we have written, so a screen can list the copies we kept. */
  keys(): readonly string[];
}>;

/** A store that lives in a `Map`. Used by every test, and on a server render. */
export function memoryStore(seed: Readonly<Record<string, string>> = {}): KeyValueStore {
  const values = new Map<string, string>(Object.entries(seed));

  return {
    read: (key) => values.get(key) ?? null,
    write: (key, value) => {
      values.set(key, value);
    },
    remove: (key) => {
      values.delete(key);
    },
    keys: () => [...values.keys()],
  };
}

/**
 * A store backed by `localStorage`, or `null` when there isn't one: during a server
 * render, or in a browser where site data is switched off. The caller decides what to
 * do about it rather than crashing here.
 */
export function browserStore(): KeyValueStore | null {
  if (typeof window === "undefined") return null;

  let storage: Storage;
  try {
    // Reading the property itself throws in some privacy modes, so even this is guarded.
    storage = window.localStorage;
    const probe = "tipon.probe";
    storage.setItem(probe, "1");
    storage.removeItem(probe);
  } catch {
    return null;
  }

  return {
    read: (key) => storage.getItem(key),
    write: (key, value) => storage.setItem(key, value),
    remove: (key) => storage.removeItem(key),
    keys: () => Object.keys(storage),
  };
}
