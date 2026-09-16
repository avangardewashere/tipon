import { z } from "zod";
import { isDayKey } from "@/lib/dates/dayKey";
import { describeExtractError, extractErrorSchema, type ExtractRequest } from "./extractApi";
import type { Proposal } from "./proposal";
import { parseDump } from "./quickParser";
import type { DayKey } from "@/lib/dates/dayKey";
import type { Project } from "@/lib/workspace/types";

/**
 * How a dump becomes a proposal, whichever way it got there.
 *
 * `source` is shown on the review sheet, and `problem` is the sentence explaining a
 * fallback. A dump always produces a proposal: the rules are the floor, Claude is the
 * upgrade, and nothing about the review sheet changes either way.
 */
export type SortOutcome = Readonly<{
  proposal: Proposal;
  source: "claude" | "rules";
  problem: string | null;
}>;

export type SortOptions = Readonly<{
  text: string;
  today: DayKey;
  projects: readonly Project[];
  /** Empty means "don't ask Claude at all" — no access code, no request, no cost. */
  accessCode: string;
  /** Swapped in tests. */
  fetchImpl?: typeof fetch;
}>;

/** The proposal shape as it arrives over the wire. Checked again on this side. */
const wireProposalSchema = z.object({
  proposal: z.object({
    projects: z.array(
      z.object({
        key: z.string().min(1),
        name: z.string().min(1),
        existingId: z.string().min(1).nullable(),
        wasArchived: z.boolean(),
      }),
    ),
    tasks: z.array(
      z.object({
        key: z.string().min(1),
        title: z.string().min(1),
        due: z.string().refine(isDayKey).nullable(),
        projectKey: z.string().min(1).nullable(),
      }),
    ),
  }),
});

export async function sortDump({ text, today, projects, accessCode, fetchImpl }: SortOptions): Promise<SortOutcome> {
  const withRules = (problem: string | null): SortOutcome => ({
    proposal: parseDump(text, { today, projects }),
    source: "rules",
    problem,
  });

  if (accessCode.trim() === "") return withRules(null);

  // Looked up here, not as a default argument: a default is evaluated on every call, and
  // somewhere without `fetch` (jsdom, an old browser) that would throw before the rules
  // ever got their chance.
  const send = fetchImpl ?? globalThis.fetch;
  if (typeof send !== "function") return withRules(describeExtractError("upstream"));

  const request: ExtractRequest = {
    text,
    today,
    accessCode,
    projects: projects.map((project) => ({ id: project.id, name: project.name, status: project.status })),
  };

  let response: Response;
  try {
    response = await send("/api/extract", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    });
  } catch {
    // Offline, or the server isn't there. The rules don't need a network.
    return withRules(describeExtractError("upstream"));
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const error = extractErrorSchema.safeParse(body);
    return withRules(describeExtractError(error.success ? error.data.error : "upstream"));
  }

  // A 200 still has to hold a proposal of the right shape. Proxies and stale service
  // workers return all sorts of things with a 200 on them.
  const parsed = wireProposalSchema.safeParse(body);
  if (!parsed.success) return withRules(describeExtractError("bad-reply"));

  const proposal = parsed.data.proposal;
  if (!everyTaskPointsSomewhereReal(proposal)) return withRules(describeExtractError("bad-reply"));

  return { proposal, source: "claude", problem: null };
}

/** A task pointing at a project key that isn't in the proposal would vanish on commit. */
function everyTaskPointsSomewhereReal(proposal: Proposal): boolean {
  const keys = new Set(proposal.projects.map((project) => project.key));
  return proposal.tasks.every((task) => task.projectKey === null || keys.has(task.projectKey));
}
