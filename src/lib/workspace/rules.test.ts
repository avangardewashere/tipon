/**
 * @jest-environment node
 */
import { findProjectNameProblem } from "./rules";
import type { Project, ProjectStatus } from "./types";

function project(id: string, name: string, status: ProjectStatus = "active"): Project {
  return { id, name, notes: "", status, createdAt: 0, updatedAt: 0 };
}

const projects = [project("p-web", "Website"), project("p-old", "Old blog", "archived")];

describe("findProjectNameProblem", () => {
  it("has no problem with a new name", () => {
    expect(findProjectNameProblem(projects, "Garden")).toBeNull();
  });

  it.each(["", "   ", "\n\t"])("calls the blank name %j empty", (name) => {
    expect(findProjectNameProblem(projects, name)).toBe("empty");
  });

  it.each(["Website", "website", "  WEBSITE  "])("calls %j taken, ignoring case and spaces", (name) => {
    expect(findProjectNameProblem(projects, name)).toBe("taken");
  });

  it("counts archived projects as taken", () => {
    expect(findProjectNameProblem(projects, "old blog")).toBe("taken");
  });

  it("lets a project keep its own name when renaming, even in a different case", () => {
    expect(findProjectNameProblem(projects, "WEBSITE", "p-web")).toBeNull();
  });

  it("still refuses another project's name when renaming", () => {
    expect(findProjectNameProblem(projects, "Old blog", "p-web")).toBe("taken");
  });
});
