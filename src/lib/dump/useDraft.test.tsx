import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DRAFT_KEY, useDraft } from "./useDraft";
import { memoryStore, type KeyValueStore } from "@/lib/storage/keyValueStore";

function Notepad({ store }: Readonly<{ store: KeyValueStore }>) {
  const { draft, setDraft, clearDraft } = useDraft(store);

  return (
    <div>
      <label htmlFor="draft">Draft</label>
      <textarea id="draft" value={draft} onChange={(event) => setDraft(event.target.value)} />
      <button type="button" onClick={clearDraft}>
        Clear
      </button>
    </div>
  );
}

describe("useDraft", () => {
  it("starts from what was left behind", () => {
    render(<Notepad store={memoryStore({ [DRAFT_KEY]: "half a thought" })} />);

    expect(screen.getByLabelText("Draft")).toHaveValue("half a thought");
  });

  it("starts empty when there's nothing saved", () => {
    render(<Notepad store={memoryStore()} />);

    expect(screen.getByLabelText("Draft")).toHaveValue("");
  });

  it("saves as you type", async () => {
    const user = userEvent.setup();
    const store = memoryStore();
    render(<Notepad store={store} />);

    await user.type(screen.getByLabelText("Draft"), "call the bank");

    expect(store.read(DRAFT_KEY)).toBe("call the bank");
  });

  it("stops keeping a draft once you've emptied the page yourself", async () => {
    const user = userEvent.setup();
    const store = memoryStore({ [DRAFT_KEY]: "old" });
    render(<Notepad store={store} />);

    await user.clear(screen.getByLabelText("Draft"));

    expect(store.read(DRAFT_KEY)).toBeNull();
  });

  it("clears on request", async () => {
    const user = userEvent.setup();
    const store = memoryStore({ [DRAFT_KEY]: "half a thought" });
    render(<Notepad store={store} />);

    await user.click(screen.getByRole("button", { name: "Clear" }));

    expect(screen.getByLabelText("Draft")).toHaveValue("");
    expect(store.read(DRAFT_KEY)).toBeNull();
  });

  it("keeps working when the browser refuses to save", async () => {
    const user = userEvent.setup();
    const store: KeyValueStore = {
      ...memoryStore(),
      write: () => {
        throw new Error("The quota has been exceeded.");
      },
    };
    render(<Notepad store={store} />);

    await user.type(screen.getByLabelText("Draft"), "call the bank");

    // Losing the draft is a shame; losing the words on screen would be worse.
    expect(screen.getByLabelText("Draft")).toHaveValue("call the bank");
  });
});
