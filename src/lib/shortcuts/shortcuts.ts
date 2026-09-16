/**
 * One key, one place to be. Desktop only in spirit — a phone has the bottom bar — but
 * nothing here breaks on a tablet with a keyboard.
 */
export type Shortcut = Readonly<{ key: string; label: string; href: string }>;

export const SHORTCUTS: readonly Shortcut[] = [
  { key: "t", label: "Today", href: "/" },
  { key: "d", label: "Dump", href: "/dump" },
  { key: "p", label: "Projects", href: "/projects" },
  { key: "i", label: "Inbox", href: "/inbox" },
  { key: "b", label: "Backup", href: "/backup" },
];

/** What a key press means, or `null` when it means nothing to us. */
export function shortcutFor(event: KeyboardEvent): Shortcut | null {
  // A shortcut is a bare key press. Anything with a modifier belongs to the browser or
  // the operating system — Ctrl+D is a bookmark, and taking that over would be rude.
  if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return null;
  if (event.defaultPrevented || event.isComposing) return null;
  if (isTyping(event.target)) return null;

  return SHORTCUTS.find((shortcut) => shortcut.key === event.key.toLowerCase()) ?? null;
}

/**
 * True while the key press is part of writing something.
 *
 * Without this, typing "dump the bins" in the notepad would fire four shortcuts and throw
 * the page away mid-sentence. This is the single most important line in the file.
 */
export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  const tag = target.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;

  return target.isContentEditable;
}
