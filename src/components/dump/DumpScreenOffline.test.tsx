import { screen } from "@testing-library/react";
import { useOffline } from "next/offline";
import { DumpScreen } from "./DumpScreen";
import { ACCESS_CODE_KEY, DRAFT_KEY } from "@/lib/dump/useSavedText";
import { memoryStore } from "@/lib/storage/keyValueStore";
import { exportText, SAVE_KEY } from "@/lib/storage/workspaceStorage";
import { makeWorkspace, renderWithWorkspace } from "@/test/workspace";

jest.mock("next/offline", () => ({ useOffline: jest.fn() }));
const mockedUseOffline = useOffline as jest.MockedFunction<typeof useOffline>;

const NOW = new Date(2026, 8, 14, 9, 0).getTime();

function render({ offline, accessCode }: { offline: boolean; accessCode: string }) {
  mockedUseOffline.mockReturnValue(offline);
  const store = memoryStore({
    [SAVE_KEY]: exportText(makeWorkspace(), NOW),
    [DRAFT_KEY]: "call the bank tomorrow",
    ...(accessCode === "" ? {} : { [ACCESS_CODE_KEY]: accessCode }),
  });
  return renderWithWorkspace(<DumpScreen />, { now: NOW, store });
}

const hint = () => screen.queryByText(/No signal, so Tipon will sort this with its own rules/);

describe("the Dump screen with no network", () => {
  it("warns that Claude is out of reach before you press the button", async () => {
    render({ offline: true, accessCode: "hunter2" });

    expect(await screen.findByText(/No signal, so Tipon will sort this with its own rules/)).toBeInTheDocument();
  });

  it("says nothing when there's a network", async () => {
    render({ offline: false, accessCode: "hunter2" });

    await screen.findByLabelText("Your dump");
    expect(hint()).not.toBeInTheDocument();
  });

  /**
   * Without an access code the rules are what "Sort it" has always meant. Announcing a
   * missing feature nobody was using would be noise, not honesty.
   */
  it("says nothing without an access code, because nothing is missing", async () => {
    render({ offline: true, accessCode: "" });

    await screen.findByLabelText("Your dump");
    expect(hint()).not.toBeInTheDocument();
  });

  /**
   * The screen has to hand what it knows to `sortDump`, or the review sheet apologises
   * for the wrong thing. Nothing caught this wiring coming loose until this test.
   */
  it("carries what it knows into the sheet's explanation", async () => {
    const fetching = jest.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    // jsdom has no `fetch`, and without one `sortDump` never reaches the catch that
    // tells offline apart from unreachable.
    Object.defineProperty(globalThis, "fetch", { value: fetching, configurable: true, writable: true });
    const { user } = render({ offline: true, accessCode: "hunter2" });
    await screen.findByLabelText("Your dump");

    await user.click(screen.getByRole("button", { name: "Sort it" }));
    await screen.findByRole("heading", { name: "Sort it out" });

    expect(screen.getByRole("alert")).toHaveTextContent("You're offline");
    Reflect.deleteProperty(globalThis, "fetch");
  });

  it("still sorts, and still lets you add what it found", async () => {
    const { user } = render({ offline: true, accessCode: "hunter2" });
    await screen.findByLabelText("Your dump");

    await user.click(screen.getByRole("button", { name: "Sort it" }));

    // The whole point: no signal costs you Claude, not the notebook.
    expect(await screen.findByRole("heading", { name: "Sort it out" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Add / })).toBeEnabled();
  });
});
