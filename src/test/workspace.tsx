import { render, type RenderResult } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement, ReactNode } from "react";
import { WorkspaceProvider } from "@/lib/workspace/store";
import { emptyWorkspace, type Project, type Task, type Workspace } from "@/lib/workspace/types";

/** A clock that stands still, so every `updatedAt` in a test is this number. */
export const NOW = 1_000;

export function makeProject(project: Partial<Project> & Pick<Project, "id" | "name">): Project {
  return { notes: "", status: "active", createdAt: 0, updatedAt: 0, ...project };
}

export function makeTask(task: Partial<Task> & Pick<Task, "id" | "title">): Task {
  return { projectId: null, due: null, doneAt: null, createdAt: 0, updatedAt: 0, ...task };
}

export function makeWorkspace(workspace: Partial<Workspace> = {}): Workspace {
  return { ...emptyWorkspace, ...workspace };
}

export type RenderWithWorkspaceOptions = Readonly<{
  workspace?: Workspace;
  now?: number;
}>;

/**
 * Renders a screen inside a provider whose ids are `id-1`, `id-2`, … and whose clock
 * never moves. Same input, same output, every run.
 */
export function renderWithWorkspace(
  ui: ReactElement,
  { workspace = emptyWorkspace, now = NOW }: RenderWithWorkspaceOptions = {},
): RenderResult & { user: ReturnType<typeof userEvent.setup> } {
  let created = 0;
  const createId = () => `id-${(created += 1)}`;
  const clock = () => now;

  const result = render(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <WorkspaceProvider initialWorkspace={workspace} createId={createId} now={clock}>
        {children}
      </WorkspaceProvider>
    ),
  });

  return { ...result, user: userEvent.setup() };
}
