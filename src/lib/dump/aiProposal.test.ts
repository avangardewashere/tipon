/** @jest-environment node */
import { MAX_PROJECTS, MAX_TASKS, toProposal, type Extraction, type KnownProject } from "./aiProposal";

const yours: KnownProject[] = [
  { id: "p-web", name: "Website relaunch", status: "active" },
  { id: "p-old", name: "Old site", status: "archived" },
];

function build(extraction: Extraction, projects: readonly KnownProject[] = []) {
  return toProposal(extraction, { projects });
}

const nothing: Extraction = { projects: [], tasks: [] };

describe("toProposal", () => {
  it("numbers projects and tasks itself, ignoring anything the reply calls them", () => {
    const proposal = build({
      projects: [{ name: "Website relaunch" }, { name: "Health" }],
      tasks: [
        { title: "pick a host", due: null, project: "Website relaunch" },
        { title: "gym", due: "2026-09-14", project: "Health" },
        { title: "call the bank", due: null, project: null },
      ],
    });

    expect(proposal.projects.map((project) => project.key)).toEqual(["p1", "p2"]);
    expect(proposal.tasks.map((task) => `${task.key} ${task.title} → ${task.projectKey ?? "Inbox"}`)).toEqual([
      "t1 pick a host → p1",
      "t2 gym → p2",
      "t3 call the bank → Inbox",
    ]);
  });

  it("joins one of your projects by name, keeping your spelling", () => {
    const proposal = build({ projects: [{ name: "website relaunch" }], tasks: [] }, yours);

    expect(proposal.projects[0]).toEqual({
      key: "p1",
      name: "Website relaunch",
      existingId: "p-web",
      wasArchived: false,
    });
  });

  it("notices one of yours that is archived", () => {
    const proposal = build({ projects: [{ name: "Old site" }], tasks: [] }, yours);

    expect(proposal.projects[0]).toMatchObject({ existingId: "p-old", wasArchived: true });
  });

  it("proposes a project the reply named only on a task", () => {
    const proposal = build({ projects: [], tasks: [{ title: "gym", due: null, project: "Health" }] });

    expect(proposal.projects).toEqual([{ key: "p1", name: "Health", existingId: null, wasArchived: false }]);
    expect(proposal.tasks[0].projectKey).toBe("p1");
  });

  it("proposes one project when a name is repeated, whatever the casing", () => {
    const proposal = build({
      projects: [{ name: "Health" }, { name: "HEALTH" }],
      tasks: [{ title: "gym", due: null, project: "health" }],
    });

    expect(proposal.projects).toHaveLength(1);
    expect(proposal.tasks[0].projectKey).toBe("p1");
  });

  it.each([
    ["an empty title", { title: "", due: null, project: null }],
    ["a title of spaces", { title: "   ", due: null, project: null }],
  ])("drops a task with %s", (_name, task) => {
    expect(build({ projects: [], tasks: [task] }).tasks).toEqual([]);
  });

  it("trims the words it keeps", () => {
    expect(build({ projects: [{ name: "  Health  " }], tasks: [{ title: "  gym  ", due: null, project: null }] })).toMatchObject({
      projects: [{ name: "Health" }],
      tasks: [{ title: "gym" }],
    });
  });

  it.each([
    ["a day that doesn't exist", "2026-02-30"],
    ["a date in words", "next friday"],
    ["a full timestamp", "2026-09-15T00:00:00Z"],
    ["an empty string", ""],
    ["a day key with the wrong shape", "2026-9-5"],
  ])("keeps a task but drops %s as its due date", (_name, due) => {
    const proposal = build({ projects: [], tasks: [{ title: "call the bank", due, project: null }] });

    expect(proposal.tasks[0]).toMatchObject({ title: "call the bank", due: null });
  });

  it("drops a project with no name at all", () => {
    expect(build({ projects: [{ name: "  " }], tasks: [] }).projects).toEqual([]);
  });

  it("sends a task to the Inbox when its project had no name", () => {
    const proposal = build({ projects: [], tasks: [{ title: "gym", due: null, project: "  " }] });

    expect(proposal.tasks[0].projectKey).toBeNull();
    expect(proposal.projects).toEqual([]);
  });

  it("stops at a sensible number of projects", () => {
    const many = { projects: Array.from({ length: 50 }, (_, i) => ({ name: `Project ${i}` })), tasks: [] };

    expect(build(many).projects).toHaveLength(MAX_PROJECTS);
  });

  it("stops at a sensible number of tasks", () => {
    const many = {
      projects: [],
      tasks: Array.from({ length: 500 }, (_, i) => ({ title: `task ${i}`, due: null, project: null })),
    };

    expect(build(many).tasks).toHaveLength(MAX_TASKS);
  });

  it("gives back nothing for a reply with nothing in it", () => {
    expect(build(nothing)).toEqual({ projects: [], tasks: [] });
  });
});
