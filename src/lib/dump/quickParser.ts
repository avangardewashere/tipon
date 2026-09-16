import { readDueDate } from "./dateWords";
import { emptyProposal, type Proposal, type ProposedProject, type ProposedTask } from "./proposal";
import type { DayKey } from "@/lib/dates/dayKey";
import type { Project } from "@/lib/workspace/types";

/**
 * Turns a dump into a proposal using rules only — no AI, no network, no cost.
 *
 * The rules, in full:
 * - A line ending in `:` or starting with `#` starts a project. Following lines go in it.
 * - Every other line is a task. Bullets and numbering at the front are dropped.
 * - A date word at the end of a task line becomes its due date (see `dateWords.ts`).
 * - A project name you already have is reused, ignoring upper/lower case.
 *
 * Everything else — "ugh, the website thing is stuck on hosting" — comes out as a plain
 * task with no date, which is exactly what rules can honestly do. Block 5 shows the difference.
 */
export type ParseOptions = Readonly<{
  today: DayKey;
  /** Your projects, so the dump joins them instead of proposing a name that's taken. */
  projects: readonly Project[];
}>;

const BULLET = /^\s*(?:[-*•‣–—]|\d+[.)])\s+/;
const HEADING_HASH = /^#+\s*/;

export function parseDump(text: string, { today, projects }: ParseOptions): Proposal {
  const proposedProjects: ProposedProject[] = [];
  const tasks: ProposedTask[] = [];
  const byName = new Map<string, ProposedProject>();
  let current: ProposedProject | null = null;

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line === "") continue;

    const heading = readHeading(line);
    if (heading !== null) {
      // A marker on its own ("#", ":") names nothing, so it starts nothing — and it
      // certainly isn't a task called "#".
      if (heading === "") continue;

      current = byName.get(comparable(heading)) ?? null;
      if (current === null) {
        current = proposeProject(heading, proposedProjects.length + 1, projects);
        proposedProjects.push(current);
        byName.set(comparable(heading), current);
      }
      continue;
    }

    const { title, due } = readDueDate(line.replace(BULLET, ""), today);
    if (title === "") continue;

    tasks.push({ key: `t${tasks.length + 1}`, title, due, projectKey: current?.key ?? null });
  }

  if (proposedProjects.length === 0 && tasks.length === 0) return emptyProposal;

  return { projects: proposedProjects, tasks };
}

/**
 * The project name this line starts, `""` for a heading marker with no name, or `null`
 * when the line isn't a heading at all and should be read as a task.
 */
function readHeading(line: string): string | null {
  if (line.startsWith("#")) {
    return line.replace(HEADING_HASH, "").replace(/:$/, "").trim();
  }

  if (!line.endsWith(":")) return null;

  // A bullet can still be a heading: "- Website relaunch:" reads like one to a person.
  return line.slice(0, -1).replace(BULLET, "").trim();
}

function proposeProject(name: string, position: number, projects: readonly Project[]): ProposedProject {
  const existing = projects.find((project) => comparable(project.name) === comparable(name)) ?? null;

  return {
    key: `p${position}`,
    // The name you already use wins, so a dump doesn't quietly re-case your project.
    name: existing?.name ?? name,
    existingId: existing?.id ?? null,
    wasArchived: existing?.status === "archived",
  };
}

function comparable(name: string): string {
  return name.trim().toLowerCase();
}
