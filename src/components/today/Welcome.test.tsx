import { screen } from "@testing-library/react";
import { Welcome } from "./Welcome";
import { WELCOME_KEY } from "@/lib/dump/useSavedText";
import { memoryStore } from "@/lib/storage/keyValueStore";
import { exportText, SAVE_KEY } from "@/lib/storage/workspaceStorage";
import { makeProject, makeTask, makeWorkspace, NOW, renderWithWorkspace } from "@/test/workspace";

describe("Welcome", () => {
  it("greets someone with an empty workspace", () => {
    renderWithWorkspace(<Welcome />);

    expect(screen.getByRole("heading", { name: "Welcome to Tipon" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dump" })).toHaveAttribute("href", "/dump");
    expect(screen.getByRole("link", { name: "Export a backup" })).toHaveAttribute("href", "/backup");
  });

  it("goes away when you say you've read it, and stays away", () => {
    const store = memoryStore();
    const { user, unmount } = renderWithWorkspace(<Welcome />, { store });

    return user.click(screen.getByRole("button", { name: "Got it" })).then(() => {
      expect(screen.queryByRole("heading", { name: "Welcome to Tipon" })).not.toBeInTheDocument();
      expect(store.read(WELCOME_KEY)).toBe("done");

      unmount();
      renderWithWorkspace(<Welcome />, { store });
      expect(screen.queryByRole("heading", { name: "Welcome to Tipon" })).not.toBeInTheDocument();
    });
  });

  it.each([
    ["a project", makeWorkspace({ projects: [makeProject({ id: "p", name: "Website" })] })],
    ["a task", makeWorkspace({ tasks: [makeTask({ id: "t", title: "call the bank" })] })],
    [
      "a dump",
      makeWorkspace({ dumps: [{ id: "d", text: "call the bank", createdAt: 1, projectIds: [], taskIds: [] }] }),
    ],
  ])("stops showing itself once there is %s", (_name, workspace) => {
    renderWithWorkspace(<Welcome />, { store: memoryStore({ [SAVE_KEY]: exportText(workspace, NOW) }) });

    expect(screen.queryByRole("heading", { name: "Welcome to Tipon" })).not.toBeInTheDocument();
  });
});
