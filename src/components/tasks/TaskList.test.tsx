import { screen } from "@testing-library/react";
import { TaskList } from "./TaskList";
import { useWorkspace } from "@/lib/workspace/store";
import { tasksIn } from "@/lib/workspace/selectors";
import { makeProject, makeTask, makeWorkspace, renderWithWorkspace } from "@/test/workspace";

const task = makeTask({ id: "t-1", title: "Pick a host", projectId: "p-web", due: "2026-09-18" });
const workspace = makeWorkspace({
  projects: [makeProject({ id: "p-web", name: "Website relaunch" })],
  tasks: [task],
});

/** Reads the live workspace, the way a real screen does, so edits show up. */
function TasksOfWebsite() {
  const { workspace: live } = useWorkspace();

  return <TaskList tasks={tasksIn(live, "p-web")} emptyMessage="Nothing here." />;
}

function renderList({ empty = false } = {}) {
  return renderWithWorkspace(<TasksOfWebsite />, {
    workspace: empty ? makeWorkspace({ projects: workspace.projects }) : workspace,
  });
}

describe("TaskList", () => {
  it("shows the empty message when there is nothing to draw", () => {
    renderList({ empty: true });

    expect(screen.getByText("Nothing here.")).toBeInTheDocument();
  });

  it("shows the due date", () => {
    renderList();

    expect(screen.getByText("Due 2026-09-18")).toBeInTheDocument();
  });

  it("edits a task's title and due date together", async () => {
    const { user } = renderList();

    await user.click(screen.getByRole("button", { name: "Edit “Pick a host”" }));
    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "Pick a hosting plan");
    await user.clear(screen.getByLabelText("Due date"));
    await user.type(screen.getByLabelText("Due date"), "2026-09-25");
    await user.click(screen.getByRole("button", { name: "Save task" }));

    expect(screen.getByRole("checkbox", { name: "Pick a hosting plan" })).toBeInTheDocument();
    expect(screen.getByText("Due 2026-09-25")).toBeInTheDocument();
  });

  it("takes a due date off a task", async () => {
    const { user } = renderList();

    await user.click(screen.getByRole("button", { name: "Edit “Pick a host”" }));
    await user.clear(screen.getByLabelText("Due date"));
    await user.click(screen.getByRole("button", { name: "Save task" }));

    expect(screen.queryByText(/^Due /)).not.toBeInTheDocument();
  });

  it("leaves the task alone when the edit is cancelled", async () => {
    const { user } = renderList();

    await user.click(screen.getByRole("button", { name: "Edit “Pick a host”" }));
    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "Something else");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("checkbox", { name: "Pick a host" })).toBeInTheDocument();
  });

  it("keeps the form open when the title has been emptied", async () => {
    const { user } = renderList();

    await user.click(screen.getByRole("button", { name: "Edit “Pick a host”" }));
    await user.clear(screen.getByLabelText("Title"));
    await user.click(screen.getByRole("button", { name: "Save task" }));

    // Closing would look like the empty title was saved. The reducer would have refused it.
    expect(screen.getByLabelText("Title")).toBeInTheDocument();
  });

  it("deletes a task", async () => {
    const { user } = renderList();

    await user.click(screen.getByRole("button", { name: "Delete “Pick a host”" }));

    expect(screen.getByText("Nothing here.")).toBeInTheDocument();
  });

  it("crosses out a finished task", async () => {
    const { user } = renderList();

    await user.click(screen.getByRole("checkbox", { name: "Pick a host" }));

    expect(screen.getByText("Pick a host")).toHaveClass("line-through");
  });
});
