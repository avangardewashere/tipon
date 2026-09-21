/**
 * Asking the browser to keep our data.
 *
 * Tipon lives in one browser's storage, and browsers evict storage they think is stale —
 * Safari after about a week of not opening a site. `navigator.storage.persist()` asks for
 * an exemption. It is a request, not a promise: a browser may grant it, refuse it, or not
 * know the method at all, and the app has to work the same either way.
 */

/** Remembered so a browser is asked once, not on every visit. */
export const DURABLE_ASKED_KEY = "tipon.durableAsked";

export type DurableOutcome =
  /** Already persistent — nothing to ask for. */
  | "already"
  | "granted"
  | "refused"
  /** This browser has no Storage API, which is fine; keep a backup instead. */
  | "unsupported"
  /** The call threw. Private mode and locked-down settings both do this. */
  | "failed";

/** The slice of `navigator.storage` we use. Tests pass their own. */
export type StorageManagerLike = Readonly<{
  persisted?: () => Promise<boolean>;
  persist?: () => Promise<boolean>;
}>;

export async function askForDurableStorage(
  storage: StorageManagerLike | null | undefined,
): Promise<DurableOutcome> {
  if (typeof storage?.persist !== "function") return "unsupported";

  try {
    // Asking again when it's already granted can re-prompt in some browsers.
    if (typeof storage.persisted === "function" && (await storage.persisted())) return "already";

    return (await storage.persist()) ? "granted" : "refused";
  } catch {
    return "failed";
  }
}
