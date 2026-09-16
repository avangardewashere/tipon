import type { DayKey } from "@/lib/dates/dayKey";

/**
 * What a dump is *proposing* to add. Nothing here exists yet: it's a suggestion, drawn on
 * the review sheet, edited or unticked, and only then turned into actions.
 *
 * This shape is the contract for Block 5 as well. Claude will return exactly this, so the
 * review sheet and the commit step won't change at all when the AI arrives — only the
 * thing that produces a proposal does.
 */
export type ProposedProject = Readonly<{
  /** Only meaningful inside one proposal: it's how a task says which project it's in. */
  key: string;
  name: string;
  /** The project this matches, when you already have one with that name. */
  existingId: string | null;
  /** A matched project that is in the archive. Keeping it means bringing it back. */
  wasArchived: boolean;
}>;

export type ProposedTask = Readonly<{
  key: string;
  title: string;
  due: DayKey | null;
  /** `null` means the Inbox. */
  projectKey: string | null;
}>;

export type Proposal = Readonly<{
  projects: readonly ProposedProject[];
  tasks: readonly ProposedTask[];
}>;

export const emptyProposal: Proposal = { projects: [], tasks: [] };

export function isEmptyProposal(proposal: Proposal): boolean {
  return proposal.projects.length === 0 && proposal.tasks.length === 0;
}
