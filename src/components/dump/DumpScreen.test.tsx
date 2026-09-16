import { screen, within } from "@testing-library/react";
import { DumpScreen } from "./DumpScreen";
import { ACCESS_CODE_KEY, DRAFT_KEY } from "@/lib/dump/useSavedText";
import { memoryStore } from "@/lib/storage/keyValueStore";
import { parseSaveFile } from "@/lib/storage/saveFile";
import { exportText, SAVE_KEY } from "@/lib/storage/workspaceStorage";
import type { Workspace } from "@/lib/workspace/types";
import { makeProject, makeWorkspace, renderWithWorkspace } from "@/test/workspace";

/** Monday 14 September 2026, 9am local. Every date below can be counted from it. */
const NOW = new Date(2026, 8, 14, 9, 0).getTime();

const EXAMPLE = `call the bank tomorrow
Website relaunch:
- pick a hosting plan fri
- write the about page`;

function render(options: Parameters<typeof renderWithWorkspace>[1] = {}) {
  return renderWithWorkspace(<DumpScreen />, { now: NOW, ...options });
}

/** Sorting is a round trip now, even when it stays on this device, so wait for the sheet. */
async function sortIt(user: ReturnType<typeof renderWithWorkspace>["user"]) {
  await user.click(screen.getByRole("button", { name: "Sort it" }));
  await screen.findByRole("heading", { name: "Sort it out" });
}

/** What the workspace looks like after the screen has saved it. */
function savedWorkspace(store: ReturnType<typeof memoryStore>): Workspace {
  const result = parseSaveFile(store.read(SAVE_KEY) ?? "");
  if (!result.ok) throw new Error("nothing valid was saved");
  return result.saveFile.workspace;
}

describe("Dump screen", () => {
  it("keeps what you type, so a half-written dump survives a refresh", async () => {
    const store = memoryStore();
    const { user, unmount } = render({ store });

    await user.type(screen.getByLabelText("Your dump"), "call the bank");
    expect(store.read(DRAFT_KEY)).toBe("call the bank");

    // A refresh is a fresh render over the same storage.
    unmount();
    render({ store });

    expect(screen.getByLabelText("Your dump")).toHaveValue("call the bank");
  });

  it("clears the page when you ask it to", async () => {
    const store = memoryStore({ [DRAFT_KEY]: "half a thought" });
    const { user } = render({ store });

    await user.click(screen.getByRole("button", { name: "Clear the page" }));

    expect(screen.getByLabelText("Your dump")).toHaveValue("");
    expect(store.read(DRAFT_KEY)).toBeNull();
  });

  it("won't sort an empty page", () => {
    render();

    expect(screen.getByRole("button", { name: "Sort it" })).toBeDisabled();
  });

  it("shows what it found without adding anything yet", async () => {
    const store = memoryStore({ [DRAFT_KEY]: EXAMPLE });
    const { user } = render({ store });

    await sortIt(user);

    expect(screen.getByRole("checkbox", { name: "Keep project “Website relaunch”" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Keep task “call the bank”" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Add 1 project and 3 tasks" })).toBeEnabled();

    // Nothing is in the workspace until the button is pressed.
    expect(savedWorkspace(store).projects).toEqual([]);
  });

  it("reads the date words", async () => {
    const { user } = render({ store: memoryStore({ [DRAFT_KEY]: EXAMPLE }) });

    await sortIt(user);

    expect(screen.getByLabelText("Due date for “call the bank”")).toHaveValue("2026-09-15");
    expect(screen.getByLabelText("Due date for “pick a hosting plan”")).toHaveValue("2026-09-18");
    expect(screen.getByLabelText("Due date for “write the about page”")).toHaveValue("");
  });

  it("adds what is ticked, and nothing else", async () => {
    const store = memoryStore({ [DRAFT_KEY]: EXAMPLE });
    const { user } = render({ store });

    await sortIt(user);
    await user.click(screen.getByRole("checkbox", { name: "Keep task “write the about page”" }));
    await user.click(screen.getByRole("button", { name: "Add 1 project and 2 tasks" }));

    const saved = savedWorkspace(store);
    expect(saved.projects.map((project) => project.name)).toEqual(["Website relaunch"]);
    expect(saved.tasks.map((task) => task.title)).toEqual(["call the bank", "pick a hosting plan"]);
    expect(saved.tasks[1].projectId).toBe(saved.projects[0].id);
  });

  it("empties the page and says what it added", async () => {
    const store = memoryStore({ [DRAFT_KEY]: EXAMPLE });
    const { user } = render({ store });

    await sortIt(user);
    await user.click(screen.getByRole("button", { name: "Add 1 project and 3 tasks" }));

    expect(screen.getByRole("status")).toHaveTextContent("Added 1 project and 3 tasks.");
    expect(screen.getByLabelText("Your dump")).toHaveValue("");
    expect(store.read(DRAFT_KEY)).toBeNull();
  });

  it("puts a task in the Inbox when its project is unticked", async () => {
    const store = memoryStore({ [DRAFT_KEY]: EXAMPLE });
    const { user } = render({ store });

    await sortIt(user);
    await user.click(screen.getByRole("checkbox", { name: "Keep project “Website relaunch”" }));
    await user.click(screen.getByRole("button", { name: "Add 3 tasks" }));

    const saved = savedWorkspace(store);
    expect(saved.projects).toEqual([]);
    expect(saved.tasks.every((task) => task.projectId === null)).toBe(true);
  });

  it("lets you fix a title and a date before adding", async () => {
    const store = memoryStore({ [DRAFT_KEY]: "call the bank tomorrow" });
    const { user } = render({ store });

    await sortIt(user);
    await user.clear(screen.getByLabelText("Task title for “call the bank”"));
    await user.type(screen.getByLabelText("Task title for “call the bank”"), "call the bank about the loan");
    await user.clear(screen.getByLabelText("Due date for “call the bank”"));
    await user.click(screen.getByRole("button", { name: "Add 1 task" }));

    expect(savedWorkspace(store).tasks[0]).toMatchObject({ title: "call the bank about the loan", due: null });
  });

  it("adds nothing when everything is unticked", async () => {
    const { user } = render({ store: memoryStore({ [DRAFT_KEY]: "call the bank" }) });

    await sortIt(user);
    await user.click(screen.getByRole("checkbox", { name: "Keep task “call the bank”" }));

    expect(screen.getByRole("button", { name: "Nothing ticked" })).toBeDisabled();
  });

  it("goes back to the page with the writing still on it", async () => {
    const { user } = render({ store: memoryStore({ [DRAFT_KEY]: EXAMPLE }) });

    await sortIt(user);
    await user.click(screen.getByRole("button", { name: "Back to writing" }));

    expect(screen.getByLabelText("Your dump")).toHaveValue(EXAMPLE);
  });

  it("joins a project you already have instead of making a second one", async () => {
    const store = memoryStore({
      [SAVE_KEY]: exportText(
        makeWorkspace({ projects: [makeProject({ id: "p-web", name: "Website relaunch" })] }),
        NOW,
      ),
      [DRAFT_KEY]: "website relaunch:\n- pick a host",
    });
    const { user } = render({ store });

    await sortIt(user);
    expect(screen.getByText("yours")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add 1 project and 1 task" }));

    const saved = savedWorkspace(store);
    expect(saved.projects).toHaveLength(1);
    expect(saved.tasks[0].projectId).toBe("p-web");
  });

  it("refuses a name you have already used, rather than losing the tasks under it", async () => {
    const store = memoryStore({
      [SAVE_KEY]: exportText(makeWorkspace({ projects: [makeProject({ id: "p-web", name: "Website relaunch" })] }), NOW),
      [DRAFT_KEY]: "Health:\n- gym",
    });
    const { user } = render({ store });

    await sortIt(user);
    await user.clear(screen.getByLabelText("Project name for “Health”"));
    await user.type(screen.getByLabelText("Project name for “Health”"), "Website relaunch");

    expect(screen.getByRole("alert")).toHaveTextContent("You already have a project with that name");
    expect(screen.getByRole("button", { name: "Add 1 project and 1 task" })).toBeDisabled();
  });

  it("keeps a history of what was dumped", async () => {
    const store = memoryStore({ [DRAFT_KEY]: EXAMPLE });
    const { user } = render({ store });

    await sortIt(user);
    await user.click(screen.getByRole("button", { name: "Add 1 project and 3 tasks" }));

    const history = screen.getByRole("region", { name: "Earlier dumps" });
    // A function matcher, because the default one collapses the newlines we kept on purpose.
    expect(within(history).getByText((_text, element) => element?.textContent === EXAMPLE)).toBeInTheDocument();
    expect(within(history).getByText(/2026-09-14 · added 1 project and 3 tasks/)).toBeInTheDocument();
    expect(savedWorkspace(store).dumps).toHaveLength(1);
  });

  it("says nothing about history before there is any", () => {
    render();

    expect(screen.queryByRole("region", { name: "Earlier dumps" })).not.toBeInTheDocument();
  });
});

describe("Dump screen with Claude", () => {
  const claudeProposal = {
    projects: [{ key: "p1", name: "Website relaunch", existingId: null, wasArchived: false }],
    tasks: [
      { key: "t1", title: "call the bank about the loan", due: "2026-09-15", projectKey: null },
      { key: "t2", title: "pick a hosting plan", due: "2026-09-18", projectKey: "p1" },
    ],
  };

  /**
   * jsdom has neither `fetch` nor `Response`, so each test installs a `fetch` that answers
   * with the two things the caller actually reads: whether it went well, and the body.
   */
  function serverAnswers(status: number, body: unknown) {
    const fetchImpl = jest.fn(async () => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    })) as unknown as jest.MockedFunction<typeof fetch>;

    Object.defineProperty(globalThis, "fetch", { value: fetchImpl, configurable: true, writable: true });
    return fetchImpl;
  }

  afterEach(() => {
    Reflect.deleteProperty(globalThis, "fetch");
  });

  function withCode(draft = "call the bank tomorrow") {
    return memoryStore({ [DRAFT_KEY]: draft, [ACCESS_CODE_KEY]: "open-sesame" });
  }

  it("says who did the sorting", async () => {
    serverAnswers(200, { proposal: claudeProposal });
    const { user } = render({ store: withCode() });

    await sortIt(user);

    expect(screen.getByText("Sorted by Claude.")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Keep task “call the bank about the loan”" })).toBeInTheDocument();
  });

  it("adds what Claude proposed, once you say so", async () => {
    serverAnswers(200, { proposal: claudeProposal });
    const store = withCode();
    const { user } = render({ store });

    await sortIt(user);
    await user.click(screen.getByRole("button", { name: "Add 1 project and 2 tasks" }));

    expect(savedWorkspace(store).tasks.map((task) => task.title)).toEqual([
      "call the bank about the loan",
      "pick a hosting plan",
    ]);
  });

  it("falls back to the rules and says why", async () => {
    serverAnswers(401, { error: "wrong-code" });
    const { user } = render({ store: withCode() });

    await sortIt(user);

    expect(screen.getByText("Sorted with rules, on this device.")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("That access code isn't right");
    // Still a usable proposal, from the rules.
    expect(screen.getByRole("checkbox", { name: "Keep task “call the bank”" })).toBeInTheDocument();
  });

  it("never calls the server without an access code", async () => {
    const fetchImpl = serverAnswers(200, { proposal: claudeProposal });
    const { user } = render({ store: memoryStore({ [DRAFT_KEY]: "call the bank tomorrow" }) });

    await sortIt(user);

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(screen.getByText("Sorted with rules, on this device.")).toBeInTheDocument();
  });

  it("keeps the access code in this browser and says what sorting will do", async () => {
    const store = memoryStore();
    const { user } = render({ store });

    expect(screen.getByText("Sorting: rules only")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Access code"), "open-sesame");

    expect(store.read(ACCESS_CODE_KEY)).toBe("open-sesame");
    expect(screen.getByText("Sorting: Claude, with rules as a fallback")).toBeInTheDocument();
  });
});
