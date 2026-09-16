import { screen, within } from "@testing-library/react";
import { TodayScreen } from "./TodayScreen";
import { WELCOME_KEY } from "@/lib/dump/useSavedText";
import { memoryStore } from "@/lib/storage/keyValueStore";
import { exportText, SAVE_KEY } from "@/lib/storage/workspaceStorage";
import type { Workspace } from "@/lib/workspace/types";
import { makeProject, makeTask, makeWorkspace, renderWithWorkspace } from "@/test/workspace";

/** Monday 14 September 2026, 9am local. */
const NOW = new Date(2026, 8, 14, 9, 0).getTime();

/** A workspace already saved, with the welcome out of the way. */
function storeWith(workspace: Workspace) {
  return memoryStore({ [SAVE_KEY]: exportText(workspace, NOW), [WELCOME_KEY]: "done" });
}

function render(workspace: Workspace) {
  return renderWithWorkspace(<TodayScreen />, { now: NOW, store: storeWith(workspace) });
}

const busy = makeWorkspace({
  projects: [makeProject({ id: "p-web", name: "Website relaunch" }), makeProject({ id: "p-health", name: "Health" })],
  tasks: [
    makeTask({ id: "t-late", title: "renew the domain", projectId: "p-web", due: "2026-09-02" }),
    makeTask({ id: "t-today", title: "call the bank", due: "2026-09-14" }),
    makeTask({ id: "t-next", title: "write the about page", projectId: "p-web", createdAt: 5 }),
    makeTask({ id: "t-health", title: "book a check-up", projectId: "p-health", createdAt: 6 }),
    makeTask({ id: "t-later", title: "pick a plan", projectId: "p-web", due: "2026-10-01", createdAt: 7 }),
    makeTask({ id: "t-inbox", title: "tidy the desk" }),
    makeTask({ id: "t-done", title: "gym", doneAt: new Date(2026, 8, 14, 7).getTime() }),
  ],
});

describe("Today screen", () => {
  it("says which day it is", () => {
    render(makeWorkspace());

    expect(screen.getByRole("heading", { level: 1, name: "Today" })).toBeInTheDocument();
    expect(screen.getByText("2026-09-14")).toBeInTheDocument();
  });

  it("says so when there's nothing to do", () => {
    render(makeWorkspace());

    expect(screen.getByText(/Nothing needs you today/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Write down what's on your mind" })).toHaveAttribute("href", "/dump");
  });

  it("puts overdue work first, with the date it was due", () => {
    render(busy);

    const overdue = screen.getByRole("region", { name: "Overdue" });
    expect(within(overdue).getByText("renew the domain")).toBeInTheDocument();
    expect(within(overdue).getByText("Due 2026-09-02")).toBeInTheDocument();
  });

  it("shows what is due today", () => {
    render(busy);

    const dueToday = screen.getByRole("region", { name: "Due today" });
    expect(within(dueToday).getByText("call the bank")).toBeInTheDocument();
  });

  it("shows one next task per project, and not one that's already above", () => {
    render(busy);

    const next = screen.getByRole("region", { name: "Next in each project" });
    expect(within(next).getByText("write the about page")).toBeInTheDocument();
    expect(within(next).getByText("book a check-up")).toBeInTheDocument();
    // "renew the domain" is overdue, so it isn't repeated here.
    expect(within(next).queryByText("renew the domain")).not.toBeInTheDocument();
    expect(within(next).getAllByRole("listitem")).toHaveLength(2);
  });

  it("counts what is waiting in the Inbox, and links to it", () => {
    render(busy);

    // Both open Inbox tasks count, including "call the bank" — being due today doesn't
    // take it out of the Inbox, and the count is about where things live.
    expect(screen.getByRole("link", { name: "2 tasks waiting in the Inbox" })).toHaveAttribute("href", "/inbox");
  });

  it("says it in the singular when only one task is waiting", () => {
    render(makeWorkspace({ tasks: [makeTask({ id: "t", title: "tidy the desk" })] }));

    expect(screen.getByRole("link", { name: "1 task waiting in the Inbox" })).toBeInTheDocument();
  });

  it("links a task to the project it belongs to", () => {
    render(busy);

    const overdue = screen.getByRole("region", { name: "Overdue" });
    expect(within(overdue).getByRole("link", { name: "Website relaunch" })).toHaveAttribute("href", "/projects/p-web");
  });

  it("ticks a task off where you stand", async () => {
    const { user } = renderWithWorkspace(<TodayScreen />, { now: NOW, store: storeWith(busy) });

    await user.click(screen.getByRole("checkbox", { name: "call the bank" }));

    expect(screen.queryByRole("region", { name: "Due today" })).not.toBeInTheDocument();
    expect(screen.getByText("2 finished today")).toBeInTheDocument();
  });

  it("keeps today's finished work out of the way but not out of sight", () => {
    render(busy);

    expect(screen.getByText("1 finished today")).toBeInTheDocument();
    expect(screen.getByText("gym")).toHaveClass("line-through");
  });

  it("shows nothing about finished work when there is none", () => {
    render(makeWorkspace({ tasks: [makeTask({ id: "t", title: "call the bank" })] }));

    expect(screen.queryByText(/finished today/)).not.toBeInTheDocument();
  });

  it("never lists a finished task as due", () => {
    render(
      makeWorkspace({
        tasks: [makeTask({ id: "t", title: "call the bank", due: "2026-09-01", doneAt: NOW })],
      }),
    );

    expect(screen.queryByRole("region", { name: "Overdue" })).not.toBeInTheDocument();
    expect(screen.getByText(/Nothing needs you today/)).toBeInTheDocument();
  });

  it("leaves an archived project's tasks off the page", () => {
    render(
      makeWorkspace({
        projects: [makeProject({ id: "p-old", name: "Old site", status: "archived" })],
        tasks: [makeTask({ id: "t", title: "cancel the hosting", projectId: "p-old" })],
      }),
    );

    expect(screen.queryByText("cancel the hosting")).not.toBeInTheDocument();
  });
});
