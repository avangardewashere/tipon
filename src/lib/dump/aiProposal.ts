import { z } from "zod";
import { isDayKey } from "@/lib/dates/dayKey";
import type { Proposal, ProposedProject, ProposedTask } from "./proposal";
import type { Project } from "@/lib/workspace/types";

/**
 * What Claude is asked to return, and the only shape the server will accept back.
 *
 * Deliberately smaller than a `Proposal`: no ids, no keys. The model never sees an id
 * and can't name one, so there is no way for a reply — however wrong, however hostile —
 * to point a task at something it shouldn't. The server does all the joining itself.
 */
export const extractionSchema = z.object({
  projects: z.array(z.object({ name: z.string() })),
  tasks: z.array(
    z.object({
      title: z.string(),
      /** `YYYY-MM-DD`, or null when the dump didn't say. */
      due: z.string().nullable(),
      /** The name of one of the projects above, or null for the Inbox. */
      project: z.string().nullable(),
    }),
  ),
});

export type Extraction = z.infer<typeof extractionSchema>;

/**
 * A reply is capped before it's shown. A model that returns two thousand tasks is either
 * broken or being driven by something in the dump; either way, nobody wants that review sheet.
 */
export const MAX_PROJECTS = 20;
export const MAX_TASKS = 100;

/** All the server is told about a project of yours: enough to join one by name. */
export type KnownProject = Pick<Project, "id" | "name" | "status">;

export type ToProposalOptions = Readonly<{
  /** Your projects, for joining by name — the same rule the quick parser uses. */
  projects: readonly KnownProject[];
}>;

/**
 * Turns a reply into a proposal, throwing nothing away quietly and inventing nothing.
 *
 * Every field is treated as untrusted: titles are trimmed and dropped when empty, a due
 * date that isn't a real calendar day becomes no date rather than a wrong one, and a task
 * naming a project nobody has heard of lands in the Inbox.
 */
export function toProposal(extraction: Extraction, { projects }: ToProposalOptions): Proposal {
  const proposed: ProposedProject[] = [];
  const byName = new Map<string, ProposedProject>();

  const add = (name: string): ProposedProject | null => {
    const trimmed = name.trim();
    if (trimmed === "") return null;

    const existingKey = byName.get(comparable(trimmed));
    if (existingKey !== undefined) return existingKey;
    if (proposed.length >= MAX_PROJECTS) return null;

    const yours = projects.find((project) => comparable(project.name) === comparable(trimmed)) ?? null;
    const project: ProposedProject = {
      key: `p${proposed.length + 1}`,
      // Your spelling wins, exactly as in the quick parser.
      name: yours?.name ?? trimmed,
      existingId: yours?.id ?? null,
      wasArchived: yours?.status === "archived",
    };

    proposed.push(project);
    byName.set(comparable(project.name), project);
    return project;
  };

  for (const project of extraction.projects) add(project.name);

  const tasks: ProposedTask[] = [];
  for (const task of extraction.tasks) {
    if (tasks.length >= MAX_TASKS) break;

    const title = task.title.trim();
    if (title === "") continue;

    // A project the model named but didn't list still counts when it's one of yours.
    const project = task.project === null ? null : add(task.project);

    tasks.push({
      key: `t${tasks.length + 1}`,
      title,
      due: task.due !== null && isDayKey(task.due) ? task.due : null,
      projectKey: project?.key ?? null,
    });
  }

  return { projects: proposed, tasks };
}

function comparable(name: string): string {
  return name.trim().toLowerCase();
}
