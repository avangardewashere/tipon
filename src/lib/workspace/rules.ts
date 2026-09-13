import type { Project } from "./types";

export type ProjectNameProblem = "empty" | "taken";

/**
 * Checks a project name before it's saved. Returns `null` when the name is fine.
 *
 * Names are compared trimmed and ignoring upper/lower case, against every project,
 * archived ones included, so bringing a project back from the archive can never clash.
 * When renaming, pass the project's own id so it doesn't clash with itself.
 *
 * The reducer uses this to refuse bad names; Block 2's forms will use it to explain why.
 */
export function findProjectNameProblem(
  projects: readonly Project[],
  name: string,
  ownId?: string,
): ProjectNameProblem | null {
  const wanted = comparable(name);
  if (wanted === "") return "empty";

  const taken = projects.some((project) => project.id !== ownId && comparable(project.name) === wanted);
  return taken ? "taken" : null;
}

function comparable(name: string): string {
  return name.trim().toLowerCase();
}
