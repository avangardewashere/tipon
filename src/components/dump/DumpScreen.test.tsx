import { screen, within } from "@testing-library/react";
import { DumpScreen } from "./DumpScreen";
import { DRAFT_KEY } from "@/lib/dump/useDraft";
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

    await user.click(screen.getByRole("button", { name: "Sort it" }));

    expect(screen.getByRole("checkbox", { name: "Keep project “Website relaunch”" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Keep task “call the bank”" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Add 1 project and 3 tasks" })).toBeEnabled();

    // Nothing is in the workspace until the button is pressed.
    expect(savedWorkspace(store).projects).toEqual([]);
  });

  it("reads the date words", async () => {
    const { user } = render({ store: memoryStore({ [DRAFT_KEY]: EXAMPLE }) });

    await user.click(screen.getByRole("button", { name: "Sort it" }));

    expect(screen.getByLabelText("Due date for “call the bank”")).toHaveValue("2026-09-15");
    expect(screen.getByLabelText("Due date for “pick a hosting plan”")).toHaveValue("2026-09-18");
    expect(screen.getByLabelText("Due date for “write the about page”")).toHaveValue("");
  });

  it("adds what is ticked, and nothing else", async () => {
    const store = memoryStore({ [DRAFT_KEY]: EXAMPLE });
    const { user } = render({ store });

    await user.click(screen.getByRole("button", { name: "Sort it" }));
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

    await user.click(screen.getByRole("button", { name: "Sort it" }));
    await user.click(screen.getByRole("button", { name: "Add 1 project and 3 tasks" }));

    expect(screen.getByRole("status")).toHaveTextContent("Added 1 project and 3 tasks.");
    expect(screen.getByLabelText("Your dump")).toHaveValue("");
    expect(store.read(DRAFT_KEY)).toBeNull();
  });

  it("puts a task in the Inbox when its project is unticked", async () => {
    const store = memoryStore({ [DRAFT_KEY]: EXAMPLE });
    const { user } = render({ store });

    await user.click(screen.getByRole("button", { name: "Sort it" }));
    await user.click(screen.getByRole("checkbox", { name: "Keep project “Website relaunch”" }));
    await user.click(screen.getByRole("button", { name: "Add 3 tasks" }));

    const saved = savedWorkspace(store);
    expect(saved.projects).toEqual([]);
    expect(saved.tasks.every((task) => task.projectId === null)).toBe(true);
  });

  it("lets you fix a title and a date before adding", async () => {
    const store = memoryStore({ [DRAFT_KEY]: "call the bank tomorrow" });
    const { user } = render({ store });

    await user.click(screen.getByRole("button", { name: "Sort it" }));
    await user.clear(screen.getByLabelText("Task title for “call the bank”"));
    await user.type(screen.getByLabelText("Task title for “call the bank”"), "call the bank about the loan");
    await user.clear(screen.getByLabelText("Due date for “call the bank”"));
    await user.click(screen.getByRole("button", { name: "Add 1 task" }));

    expect(savedWorkspace(store).tasks[0]).toMatchObject({ title: "call the bank about the loan", due: null });
  });

  it("adds nothing when everything is unticked", async () => {
    const { user } = render({ store: memoryStore({ [DRAFT_KEY]: "call the bank" }) });

    await user.click(screen.getByRole("button", { name: "Sort it" }));
    await user.click(screen.getByRole("checkbox", { name: "Keep task “call the bank”" }));

    expect(screen.getByRole("button", { name: "Nothing ticked" })).toBeDisabled();
  });

  it("goes back to the page with the writing still on it", async () => {
    const { user } = render({ store: memoryStore({ [DRAFT_KEY]: EXAMPLE }) });

    await user.click(screen.getByRole("button", { name: "Sort it" }));
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

    await user.click(screen.getByRole("button", { name: "Sort it" }));
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

    await user.click(screen.getByRole("button", { name: "Sort it" }));
    await user.clear(screen.getByLabelText("Project name for “Health”"));
    await user.type(screen.getByLabelText("Project name for “Health”"), "Website relaunch");

    expect(screen.getByRole("alert")).toHaveTextContent("You already have a project with that name");
    expect(screen.getByRole("button", { name: "Add 1 project and 1 task" })).toBeDisabled();
  });

  it("keeps a history of what was dumped", async () => {
    const store = memoryStore({ [DRAFT_KEY]: EXAMPLE });
    const { user } = render({ store });

    await user.click(screen.getByRole("button", { name: "Sort it" }));
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
