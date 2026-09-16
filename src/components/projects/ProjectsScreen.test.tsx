import { screen, within } from "@testing-library/react";
import { ProjectsScreen } from "./ProjectsScreen";
import { makeProject, makeTask, makeWorkspace, renderWithWorkspace } from "@/test/workspace";

async function addProject(user: ReturnType<typeof renderWithWorkspace>["user"], name: string) {
  await user.type(screen.getByLabelText("Project name"), name);
  await user.click(screen.getByRole("button", { name: "Add project" }));
}

describe("Projects screen", () => {
  it("says there is nothing yet, rather than showing an empty page", () => {
    renderWithWorkspace(<ProjectsScreen />);

    expect(screen.getByText("No projects yet. Add your first one above.")).toBeInTheDocument();
  });

  it("adds a project and links to it", async () => {
    const { user } = renderWithWorkspace(<ProjectsScreen />);

    await addProject(user, "Website relaunch");

    expect(screen.getByRole("link", { name: "Website relaunch" })).toHaveAttribute("href", "/projects/id-1");
    expect(screen.getByLabelText("Project name")).toHaveValue("");
  });

  it("explains a name that is already taken, and adds nothing", async () => {
    const { user } = renderWithWorkspace(<ProjectsScreen />, {
      workspace: makeWorkspace({ projects: [makeProject({ id: "p-web", name: "Website relaunch" })] }),
    });

    await addProject(user, "website RELAUNCH");

    expect(screen.getByRole("alert")).toHaveTextContent("You already have a project with that name.");
    expect(screen.getAllByRole("link", { name: /relaunch/i })).toHaveLength(1);
  });

  it("explains an empty name", async () => {
    const { user } = renderWithWorkspace(<ProjectsScreen />);

    await user.type(screen.getByLabelText("Project name"), "   ");
    await user.click(screen.getByRole("button", { name: "Add project" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Give the project a name.");
  });

  it("clears the complaint as soon as you start typing again", async () => {
    const { user } = renderWithWorkspace(<ProjectsScreen />);

    await user.click(screen.getByRole("button", { name: "Add project" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Project name"), "W");

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("counts the open tasks on each card and in the Inbox", () => {
    renderWithWorkspace(<ProjectsScreen />, {
      workspace: makeWorkspace({
        projects: [makeProject({ id: "p-web", name: "Website relaunch" })],
        tasks: [
          makeTask({ id: "t-1", title: "Pick a host", projectId: "p-web" }),
          makeTask({ id: "t-2", title: "Write the about page", projectId: "p-web", doneAt: 5 }),
          makeTask({ id: "t-3", title: "Call the bank" }),
        ],
      }),
    });

    const card = screen.getByRole("article");
    expect(within(card).getByText("1 open task")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Inbox/ })).toHaveTextContent("1 open task");
  });

  it("moves a project to the archive and back", async () => {
    const { user } = renderWithWorkspace(<ProjectsScreen />, {
      workspace: makeWorkspace({ projects: [makeProject({ id: "p-web", name: "Website relaunch" })] }),
    });

    await user.click(screen.getByRole("button", { name: "Archive Website relaunch" }));

    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    const archived = screen.getByRole("region", { name: "Archived" });
    expect(within(archived).getByRole("link", { name: "Website relaunch" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Unarchive Website relaunch" }));

    expect(screen.getByRole("article")).toHaveTextContent("Website relaunch");
    expect(screen.queryByRole("region", { name: "Archived" })).not.toBeInTheDocument();
  });

  it("keeps the archive section out of sight while nothing is archived", () => {
    renderWithWorkspace(<ProjectsScreen />, {
      workspace: makeWorkspace({ projects: [makeProject({ id: "p-web", name: "Website relaunch" })] }),
    });

    expect(screen.queryByRole("heading", { name: "Archived" })).not.toBeInTheDocument();
  });
});
