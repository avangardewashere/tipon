import { screen } from "@testing-library/react";
import { ProjectScreen } from "./ProjectScreen";
import { makeProject, makeTask, makeWorkspace, renderWithWorkspace } from "@/test/workspace";

const website = makeProject({ id: "p-web", name: "Website relaunch", notes: "Launch in March." });

function workspaceWithWebsite(extra: Parameters<typeof makeWorkspace>[0] = {}) {
  return makeWorkspace({ projects: [website], ...extra });
}

describe("Project screen", () => {
  it("says so when the id isn't a project we know", () => {
    renderWithWorkspace(<ProjectScreen projectId="nope" />);

    expect(screen.getByRole("heading", { level: 1, name: "Project not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to projects" })).toHaveAttribute("href", "/projects");
  });

  it("shows the project's name and notes", () => {
    renderWithWorkspace(<ProjectScreen projectId="p-web" />, { workspace: workspaceWithWebsite() });

    expect(screen.getByRole("heading", { level: 1, name: "Website relaunch" })).toBeInTheDocument();
    expect(screen.getByLabelText("Notes")).toHaveValue("Launch in March.");
  });

  it("keeps what you type in the notes", async () => {
    const { user } = renderWithWorkspace(<ProjectScreen projectId="p-web" />, { workspace: workspaceWithWebsite() });

    await user.clear(screen.getByLabelText("Notes"));
    await user.type(screen.getByLabelText("Notes"), "Hosting decided.");

    expect(screen.getByLabelText("Notes")).toHaveValue("Hosting decided.");
  });

  it("adds a task with a due date", async () => {
    const { user } = renderWithWorkspace(<ProjectScreen projectId="p-web" />, { workspace: workspaceWithWebsite() });

    await user.type(screen.getByLabelText("Task"), "Pick a hosting plan");
    await user.type(screen.getByLabelText("Due date"), "2026-09-18");
    await user.click(screen.getByRole("button", { name: "Add task" }));

    expect(screen.getByRole("checkbox", { name: "Pick a hosting plan" })).not.toBeChecked();
    expect(screen.getByText("Due 2026-09-18")).toBeInTheDocument();
    expect(screen.getByLabelText("Task")).toHaveValue("");
  });

  it("adds nothing when the title is blank", async () => {
    const { user } = renderWithWorkspace(<ProjectScreen projectId="p-web" />, { workspace: workspaceWithWebsite() });

    await user.type(screen.getByLabelText("Task"), "   ");
    await user.click(screen.getByRole("button", { name: "Add task" }));

    expect(screen.getByText("No tasks here yet.")).toBeInTheDocument();
  });

  it("ticks a task off and puts it back", async () => {
    const { user } = renderWithWorkspace(<ProjectScreen projectId="p-web" />, {
      workspace: workspaceWithWebsite({
        tasks: [makeTask({ id: "t-1", title: "Pick a host", projectId: "p-web" })],
      }),
    });

    await user.click(screen.getByRole("checkbox", { name: "Pick a host" }));
    expect(screen.getByRole("checkbox", { name: "Pick a host" })).toBeChecked();

    await user.click(screen.getByRole("checkbox", { name: "Pick a host" }));
    expect(screen.getByRole("checkbox", { name: "Pick a host" })).not.toBeChecked();
  });

  it("shows only this project's tasks", () => {
    renderWithWorkspace(<ProjectScreen projectId="p-web" />, {
      workspace: workspaceWithWebsite({
        tasks: [
          makeTask({ id: "t-1", title: "Pick a host", projectId: "p-web" }),
          makeTask({ id: "t-2", title: "Call the bank" }),
        ],
      }),
    });

    expect(screen.getByRole("checkbox", { name: "Pick a host" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Call the bank" })).not.toBeInTheDocument();
  });

  it("renames the project, and refuses a name another project already has", async () => {
    const { user } = renderWithWorkspace(<ProjectScreen projectId="p-web" />, {
      workspace: makeWorkspace({ projects: [website, makeProject({ id: "p-old", name: "Old site" })] }),
    });

    await user.click(screen.getByRole("button", { name: "Rename project" }));
    await user.clear(screen.getByLabelText("New name"));
    await user.type(screen.getByLabelText("New name"), "old site");
    await user.click(screen.getByRole("button", { name: "Save name" }));

    expect(screen.getByRole("alert")).toHaveTextContent("You already have a project with that name.");
    expect(screen.getByRole("heading", { level: 1, name: "Website relaunch" })).toBeInTheDocument();

    await user.clear(screen.getByLabelText("New name"));
    await user.type(screen.getByLabelText("New name"), "Website v2");
    await user.click(screen.getByRole("button", { name: "Save name" }));

    expect(screen.getByRole("heading", { level: 1, name: "Website v2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rename project" })).toBeInTheDocument();
  });

  it("lets a project keep its own name while renaming", async () => {
    const { user } = renderWithWorkspace(<ProjectScreen projectId="p-web" />, { workspace: workspaceWithWebsite() });

    await user.click(screen.getByRole("button", { name: "Rename project" }));
    await user.type(screen.getByLabelText("New name"), " ");
    await user.click(screen.getByRole("button", { name: "Save name" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Website relaunch" })).toBeInTheDocument();
  });

  it("archives from the project page and stops taking new tasks", async () => {
    const { user } = renderWithWorkspace(<ProjectScreen projectId="p-web" />, { workspace: workspaceWithWebsite() });

    await user.click(screen.getByRole("button", { name: "Archive project" }));

    expect(screen.getByText("Archived")).toBeInTheDocument();
    expect(screen.getByLabelText("Task")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add task" })).toBeDisabled();
    expect(screen.getByText("Archived projects take no new tasks. Unarchive to add one.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Unarchive project" }));

    expect(screen.getByLabelText("Task")).toBeEnabled();
  });

  it("still shows an archived project's tasks", () => {
    renderWithWorkspace(<ProjectScreen projectId="p-old" />, {
      workspace: makeWorkspace({
        projects: [makeProject({ id: "p-old", name: "Old site", status: "archived" })],
        tasks: [makeTask({ id: "t-1", title: "Cancel the hosting", projectId: "p-old" })],
      }),
    });

    expect(screen.getByRole("checkbox", { name: "Cancel the hosting" })).toBeInTheDocument();
  });
});
