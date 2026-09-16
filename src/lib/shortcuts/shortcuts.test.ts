import { isTyping, shortcutFor, SHORTCUTS } from "./shortcuts";

/** Builds a key press the way the browser would, aimed at `target`. */
function press(key: string, options: Partial<KeyboardEventInit> & { target?: HTMLElement } = {}): KeyboardEvent {
  const { target, ...init } = options;
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });

  if (target !== undefined) {
    document.body.append(target);
    target.dispatchEvent(event);
  }

  return event;
}

describe("shortcutFor", () => {
  it.each(SHORTCUTS.map((shortcut) => [shortcut.key, shortcut.href]))("sends %s to %s", (key, href) => {
    expect(shortcutFor(press(key))?.href).toBe(href);
  });

  it("takes a capital letter as the same key", () => {
    expect(shortcutFor(press("T"))?.href).toBe("/");
  });

  it("ignores a key that means nothing to us", () => {
    expect(shortcutFor(press("q"))).toBeNull();
    expect(shortcutFor(press("Enter"))).toBeNull();
  });

  it.each([
    ["ctrl", { ctrlKey: true }],
    ["the command key", { metaKey: true }],
    ["alt", { altKey: true }],
    ["shift", { shiftKey: true }],
  ])("leaves %s combinations to the browser", (_name, modifier) => {
    // Ctrl+D is "bookmark this page". Taking that over would be rude.
    expect(shortcutFor(press("d", modifier))).toBeNull();
  });

  it("ignores a key press something else has already handled", () => {
    const event = press("d");
    event.preventDefault();

    expect(shortcutFor(event)).toBeNull();
  });

  it.each([
    ["a text box", document.createElement("input")],
    ["a notepad", document.createElement("textarea")],
    ["a dropdown", document.createElement("select")],
  ])("stays out of the way while you are typing in %s", (_name, element) => {
    const event = press("d", { target: element });

    expect(shortcutFor(event)).toBeNull();
  });

  it("stays out of the way in anything editable", () => {
    const editable = document.createElement("div");
    editable.contentEditable = "true";
    // jsdom doesn't work out isContentEditable from the attribute on its own.
    Object.defineProperty(editable, "isContentEditable", { value: true });

    expect(shortcutFor(press("d", { target: editable }))).toBeNull();
  });

  it("still works when the key press lands on the page itself", () => {
    expect(shortcutFor(press("d", { target: document.createElement("main") }))?.href).toBe("/dump");
  });

  it("has no two shortcuts on the same key", () => {
    expect(new Set(SHORTCUTS.map((shortcut) => shortcut.key)).size).toBe(SHORTCUTS.length);
  });
});

describe("isTyping", () => {
  it("says no to nothing at all", () => {
    expect(isTyping(null)).toBe(false);
  });
});
