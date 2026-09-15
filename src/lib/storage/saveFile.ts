import { z } from "zod";
import { isDayKey } from "@/lib/dates/dayKey";
import type { Workspace } from "@/lib/workspace/types";

/**
 * The shape of everything we save, and the only thing that ever gets validated.
 *
 * Data we didn't just create — a file from last month, a backup someone edited, a reply
 * from Claude in Block 5 — is checked field by field before the app believes it.
 */
export const SAVE_FILE_VERSION = 1;

const dayKey = z.string().refine(isDayKey, { message: "not a real calendar day" });
const timestamp = z.number().int().nonnegative();

const projectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  notes: z.string(),
  status: z.enum(["active", "archived"]),
  createdAt: timestamp,
  updatedAt: timestamp,
});

const taskSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1).nullable(),
  title: z.string().min(1),
  due: dayKey.nullable(),
  doneAt: timestamp.nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

const workspaceSchema = z
  .object({
    projects: z.array(projectSchema),
    tasks: z.array(taskSchema),
  })
  // Two rules a single field can't express. A duplicate id or a task pointing at a
  // project that isn't there would break screens in ways that are hard to explain later.
  .refine((workspace) => isUnique(workspace.projects.map((project) => project.id)), {
    message: "two projects share an id",
  })
  .refine((workspace) => isUnique(workspace.tasks.map((task) => task.id)), {
    message: "two tasks share an id",
  })
  .refine(
    (workspace) => {
      const ids = new Set(workspace.projects.map((project) => project.id));
      return workspace.tasks.every((task) => task.projectId === null || ids.has(task.projectId));
    },
    { message: "a task belongs to a project that isn't in the file" },
  );

export const saveFileSchema = z.object({
  app: z.literal("tipon"),
  version: z.literal(SAVE_FILE_VERSION),
  savedAt: timestamp,
  workspace: workspaceSchema,
});

/**
 * Spelled out rather than inferred from the schema, so the save file carries the app's own
 * `Workspace` type: readonly everywhere, exactly like the state the reducer works on.
 */
export type SaveFile = Readonly<{
  app: "tipon";
  version: typeof SAVE_FILE_VERSION;
  savedAt: number;
  workspace: Workspace;
}>;

/** Why a file couldn't be read. Each one gets its own sentence on screen. */
export type SaveProblem =
  | { kind: "not-json" }
  | { kind: "newer-version"; version: number }
  | { kind: "not-a-save-file"; detail: string };

export type ParseResult = { ok: true; saveFile: SaveFile } | { ok: false; problem: SaveProblem };

export function toSaveFile(workspace: Workspace, savedAt: number): SaveFile {
  return { app: "tipon", version: SAVE_FILE_VERSION, savedAt, workspace };
}

/** What gets written to storage, and what an export downloads. Indented so it's readable. */
export function serializeSaveFile(saveFile: SaveFile): string {
  return JSON.stringify(saveFile, null, 2);
}

/**
 * Turns text into a save file, or says why it can't.
 *
 * Versions: v1 is the first, so there's nothing to migrate yet. When v2 arrives, an
 * older file is upgraded here — this is the one place that knows about old shapes —
 * and a *newer* file is refused, because this build can't know what v2 added.
 */
export function parseSaveFile(text: string): ParseResult {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, problem: { kind: "not-json" } };
  }

  const version = readVersion(value);
  if (version !== null && version > SAVE_FILE_VERSION) {
    return { ok: false, problem: { kind: "newer-version", version } };
  }

  const result = saveFileSchema.safeParse(value);
  if (!result.success) {
    return { ok: false, problem: { kind: "not-a-save-file", detail: firstProblem(result.error) } };
  }

  return { ok: true, saveFile: result.data };
}

export function describeProblem(problem: SaveProblem): string {
  switch (problem.kind) {
    case "not-json":
      return "That file isn't JSON at all.";
    case "newer-version":
      return `That file was saved by a newer version of Tipon (v${problem.version}). Update Tipon and try again.`;
    case "not-a-save-file":
      return `That file isn't a Tipon backup: ${problem.detail}.`;
  }
}

function readVersion(value: unknown): number | null {
  if (typeof value !== "object" || value === null) return null;
  const version = (value as { version?: unknown }).version;
  return typeof version === "number" ? version : null;
}

/** One sentence, the first thing Zod complained about, with the path it was found at. */
function firstProblem(error: z.ZodError): string {
  const issue = error.issues[0];
  if (issue === undefined) return "it doesn't have the right shape";

  const path = issue.path.join(".");
  return path === "" ? issue.message : `${path} ${issue.message}`;
}

function isUnique(ids: readonly string[]): boolean {
  return new Set(ids).size === ids.length;
}
