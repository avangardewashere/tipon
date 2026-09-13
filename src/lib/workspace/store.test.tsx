import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useWorkspace, WorkspaceProvider } from "./store";
import { makeProject, makeWorkspace, NOW, renderWithWorkspace } from "@/test/workspace";

/** A stand-in screen: it sends commands and shows what the workspace says back. */
function Probe() {
  const { workspace, run } = useWorkspace();

  return (
    <div>
      <button type="button" onClick={() => run({ type: "project/add", name: "Website" })}>
        Add project
      </button>
      <ul>
        {workspace.projects.map((project) => (
          <li key={project.id}>{`${project.id} · ${project.name} · ${project.createdAt}`}</li>
        ))}
      </ul>
    </div>
  );
}

describe("WorkspaceProvider", () => {
  it("stamps a new id and the current time onto a command", async () => {
    const { user } = renderWithWorkspace(<Probe />);

    await user.click(screen.getByRole("button", { name: "Add project" }));

    expect(screen.getByRole("listitem")).toHaveTextContent(`id-1 · Website · ${NOW}`);
  });

  it("counts up, so two commands never share an id", async () => {
    const user = userEvent.setup();
    let created = 0;

    render(
      <WorkspaceProvider createId={() => `id-${(created += 1)}`} now={() => NOW}>
        <Probe />
      </WorkspaceProvider>,
    );

    const add = screen.getByRole("button", { name: "Add project" });
    await user.click(add);
    await user.click(add);

    // The second "Website" is refused by the reducer (the name is taken), but the id was
    // still spent: ids are never reused.
    expect(created).toBe(2);
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("starts from the workspace it is given", () => {
    renderWithWorkspace(<Probe />, {
      workspace: makeWorkspace({ projects: [makeProject({ id: "p-web", name: "Website relaunch" })] }),
    });

    expect(screen.getByRole("listitem")).toHaveTextContent("p-web · Website relaunch");
  });

  it("refuses to work outside a provider instead of pretending the workspace is empty", () => {
    const quiet = jest.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<Probe />)).toThrow("useWorkspace must be used inside a <WorkspaceProvider>");

    quiet.mockRestore();
  });
});
