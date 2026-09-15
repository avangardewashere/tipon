import { screen } from "@testing-library/react";
import { WorkspaceGate } from "./WorkspaceGate";
import { memoryStore } from "@/lib/storage/keyValueStore";
import { SAVE_KEY } from "@/lib/storage/workspaceStorage";
import { makeProject, makeWorkspace, renderWithWorkspace, storeHolding } from "@/test/workspace";

describe("WorkspaceGate", () => {
  it("shows the screen once the saved copy has been read", () => {
    renderWithWorkspace(<WorkspaceGate>Projects</WorkspaceGate>, {
      store: storeHolding(makeWorkspace({ projects: [makeProject({ id: "p-web", name: "Website relaunch" })] })),
    });

    expect(screen.getByText("Projects")).toBeInTheDocument();
    expect(screen.queryByText(/Opening your notebook/)).not.toBeInTheDocument();
  });

  it("shows the screen even when there is nothing saved", () => {
    renderWithWorkspace(<WorkspaceGate>Projects</WorkspaceGate>);

    expect(screen.getByText("Projects")).toBeInTheDocument();
  });

  it("explains a copy it had to keep, and the message can be dismissed", async () => {
    const { user } = renderWithWorkspace(<WorkspaceGate>Projects</WorkspaceGate>, {
      store: memoryStore({ [SAVE_KEY]: "{ half a file" }),
    });

    expect(screen.getByRole("alert")).toHaveTextContent("isn't JSON at all");
    expect(screen.getByRole("alert")).toHaveTextContent("kept as");
    // The screen is still usable while the message is up.
    expect(screen.getByText("Projects")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("says nothing at all when the saved copy is fine", () => {
    renderWithWorkspace(<WorkspaceGate>Projects</WorkspaceGate>, { workspace: makeWorkspace() });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
