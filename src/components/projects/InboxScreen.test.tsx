import { screen, within } from "@testing-library/react";
import { InboxScreen } from "./InboxScreen";
import { makeProject, makeTask, makeWorkspace, renderWithWorkspace } from "@/test/workspace";

describe("Inbox screen", () => {
  it("says the Inbox is empty rather than showing nothing", () => {
    renderWithWorkspace(<InboxScreen />);

    expect(screen.getByText("Your Inbox is empty.")).toBeInTheDocument();
  });

  it("adds a task with no project", async () => {
    const { user } = renderWithWorkspace(<InboxScreen />);

    await user.type(screen.getByLabelText("Task"), "Call the bank");
    await user.click(screen.getByRole("button", { name: "Add task" }));

    expect(screen.getByRole("checkbox", { name: "Call the bank" })).toBeInTheDocument();
  });

  it("shows Inbox tasks only", () => {
    renderWithWorkspace(<InboxScreen />, {
      workspace: makeWorkspace({
        projects: [makeProject({ id: "p-web", name: "Website relaunch" })],
        tasks: [
          makeTask({ id: "t-1", title: "Call the bank" }),
          makeTask({ id: "t-2", title: "Pick a host", projectId: "p-web" }),
        ],
      }),
    });

    expect(screen.getByRole("checkbox", { name: "Call the bank" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Pick a host" })).not.toBeInTheDocument();
  });

  it("moves a task out of the Inbox into a project", async () => {
    const { user } = renderWithWorkspace(<InboxScreen />, {
      workspace: makeWorkspace({
        projects: [makeProject({ id: "p-web", name: "Website relaunch" })],
        tasks: [makeTask({ id: "t-1", title: "Call the bank" })],
      }),
    });

    await user.selectOptions(screen.getByLabelText("Move “Call the bank” to"), "p-web");

    expect(screen.queryByRole("checkbox", { name: "Call the bank" })).not.toBeInTheDocument();
    expect(screen.getByText("Your Inbox is empty.")).toBeInTheDocument();
  });

  it("does not offer an archived project as a destination", () => {
    renderWithWorkspace(<InboxScreen />, {
      workspace: makeWorkspace({
        projects: [
          makeProject({ id: "p-web", name: "Website relaunch" }),
          makeProject({ id: "p-old", name: "Old site", status: "archived" }),
        ],
        tasks: [makeTask({ id: "t-1", title: "Call the bank" })],
      }),
    });

    const move = screen.getByLabelText("Move “Call the bank” to");
    expect(within(move).getByRole("option", { name: "Website relaunch" })).toBeInTheDocument();
    expect(within(move).queryByRole("option", { name: "Old site" })).not.toBeInTheDocument();
    expect(within(move).getByRole("option", { name: "Inbox" })).toBeInTheDocument();
  });
});
