import type { Proposal } from "./proposal";
import type { WorkspaceAction } from "@/lib/workspace/reducer";

/**
 * The third step of **propose → review → commit**.
 *
 * Nothing here decides anything: it takes the proposal, the keys you left ticked, and the
 * ids and clock from the provider, and returns the exact list of actions to dispatch. Pure,
 * so a test can read the actions instead of guessing from the workspace afterwards.
 */
export type Kept = Readonly<{
  projectKeys: ReadonlySet<string>;
  taskKeys: ReadonlySet<string>;
}>;

export type CommitOptions = Readonly<{
  /** The dump as typed, kept with the record of what it added. */
  text: string;
  createId: () => string;
  now: number;
}>;

export function toActions(proposal: Proposal, kept: Kept, { text, createId, now }: CommitOptions): WorkspaceAction[] {
  const actions: WorkspaceAction[] = [];
  const idOfKey = new Map<string, string>();
  const newProjectIds: string[] = [];
  const newTaskIds: string[] = [];

  for (const project of proposal.projects) {
    if (!kept.projectKeys.has(project.key)) continue;

    if (project.existingId === null) {
      const id = createId();
      actions.push({ type: "project/add", id, name: project.name, now });
      idOfKey.set(project.key, id);
      newProjectIds.push(id);
      continue;
    }

    // Keeping a project you'd archived means you're using it again, and an archived
    // project takes no new tasks — so bring it back first.
    if (project.wasArchived) {
      actions.push({ type: "project/unarchive", id: project.existingId, now });
    }
    idOfKey.set(project.key, project.existingId);
  }

  for (const task of proposal.tasks) {
    if (!kept.taskKeys.has(task.key)) continue;

    const id = createId();
    // A task whose project you unticked still gets added — to the Inbox, where you can
    // see it. Dropping it because of a decision about something else would be a surprise.
    const projectId = task.projectKey === null ? null : (idOfKey.get(task.projectKey) ?? null);

    actions.push({ type: "task/add", id, title: task.title, projectId, due: task.due, now });
    newTaskIds.push(id);
  }

  // A dump that added nothing isn't worth a line in the history.
  if (actions.length > 0) {
    actions.push({
      type: "dump/record",
      id: createId(),
      text,
      projectIds: newProjectIds,
      taskIds: newTaskIds,
      now,
    });
  }

  return actions;
}

/** Everything ticked, which is what the review sheet opens with. */
export function keepEverything(proposal: Proposal): Kept {
  return {
    projectKeys: new Set(proposal.projects.map((project) => project.key)),
    taskKeys: new Set(proposal.tasks.map((task) => task.key)),
  };
}
