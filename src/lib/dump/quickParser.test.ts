/** @jest-environment node */
import { parseDump } from "./quickParser";
import type { Project } from "@/lib/workspace/types";

const TODAY = "2026-09-14"; // a Monday

function project(id: string, name: string, status: Project["status"] = "active"): Project {
  return { id, name, notes: "", status, createdAt: 0, updatedAt: 0 };
}

function parse(text: string, projects: readonly Project[] = []) {
  return parseDump(text, { today: TODAY, projects });
}

/** A short way to write what we expect: "project name > task title @ due". */
function shape(text: string, projects: readonly Project[] = []): string[] {
  const proposal = parse(text, projects);
  const nameOf = new Map(proposal.projects.map((p) => [p.key, p.name]));

  return [
    ...proposal.projects.map((p) => `project ${p.name}${p.existingId === null ? "" : " (yours)"}`),
    ...proposal.tasks.map(
      (t) => `${t.projectKey === null ? "Inbox" : nameOf.get(t.projectKey)} > ${t.title}${t.due === null ? "" : ` @ ${t.due}`}`,
    ),
  ];
}

describe("parseDump", () => {
  it("reads the example from the plan", () => {
    expect(
      shape(`call the bank tomorrow
Website relaunch:
- pick a hosting plan fri
- write the about page`),
    ).toEqual([
      "project Website relaunch",
      "Inbox > call the bank @ 2026-09-15",
      "Website relaunch > pick a hosting plan @ 2026-09-18",
      "Website relaunch > write the about page",
    ]);
  });

  it.each([
    ["nothing at all", ""],
    ["only blank lines", "\n\n   \n\t\n"],
    ["a heading with no name", "#\n:\n"],
  ])("proposes nothing for %s", (_name, text) => {
    expect(parse(text)).toEqual({ projects: [], tasks: [] });
  });

  it.each([
    ["a line ending in a colon", "Website relaunch:"],
    ["a hash heading", "# Website relaunch"],
    ["several hashes", "### Website relaunch"],
    ["a hash heading that also ends in a colon", "## Website relaunch:"],
    ["a bulleted heading", "- Website relaunch:"],
    ["a heading with space around it", "   Website relaunch:   "],
  ])("starts a project from %s", (_name, text) => {
    expect(shape(text)).toEqual(["project Website relaunch"]);
  });

  it.each([
    ["a plain line", "write the about page", "write the about page"],
    ["a dash bullet", "- write the about page", "write the about page"],
    ["a star bullet", "* write the about page", "write the about page"],
    ["a round bullet", "• write the about page", "write the about page"],
    ["a numbered line", "1. write the about page", "write the about page"],
    ["a numbered line with a bracket", "2) write the about page", "write the about page"],
    ["an em dash", "— write the about page", "write the about page"],
    ["rambling, which stays exactly as typed", "ugh the website thing is stuck on hosting", "ugh the website thing is stuck on hosting"],
    ["a line with a colon in the middle", "email jo: ask about hosting", "email jo: ask about hosting"],
  ])("makes an Inbox task from %s", (_name, text, title) => {
    expect(shape(text)).toEqual([`Inbox > ${title}`]);
  });

  it("puts tasks under the heading above them", () => {
    expect(
      shape(`loose task
Website:
in website
Health:
in health`),
    ).toEqual([
      "project Website",
      "project Health",
      "Inbox > loose task",
      "Website > in website",
      "Health > in health",
    ]);
  });

  it("proposes one project when a heading is repeated, whatever the casing", () => {
    expect(
      shape(`Website:
one
WEBSITE:
two`),
    ).toEqual(["project Website", "Website > one", "Website > two"]);
  });

  it("joins a project you already have instead of proposing a new one", () => {
    const proposal = parse("website RELAUNCH:\n- pick a host", [project("p-web", "Website relaunch")]);

    expect(proposal.projects).toEqual([
      { key: "p1", name: "Website relaunch", existingId: "p-web", wasArchived: false },
    ]);
    expect(proposal.tasks[0]).toMatchObject({ title: "pick a host", projectKey: "p1" });
  });

  it("keeps the name you already use, not the one you just typed", () => {
    expect(shape("website relaunch:", [project("p-web", "Website relaunch")])).toEqual([
      "project Website relaunch (yours)",
    ]);
  });

  it("notices when the project it matched is in the archive", () => {
    const proposal = parse("Old site:\n- cancel the hosting", [project("p-old", "Old site", "archived")]);

    expect(proposal.projects[0]).toMatchObject({ existingId: "p-old", wasArchived: true });
  });

  it("gives every proposed thing its own key", () => {
    const proposal = parse("Website:\none\ntwo\nHealth:\nthree");

    expect(proposal.projects.map((p) => p.key)).toEqual(["p1", "p2"]);
    expect(proposal.tasks.map((t) => t.key)).toEqual(["t1", "t2", "t3"]);
  });

  it("handles a messy real dump", () => {
    expect(
      shape(`ugh so much to do

call the bank tomorrow
# Website relaunch
- pick a hosting plan fri
- write the about page
   - ask jo about the logo sep 20

Health:
1. book a check-up 9/10
2. gym mon
`),
    ).toEqual([
      "project Website relaunch",
      "project Health",
      "Inbox > ugh so much to do",
      "Inbox > call the bank @ 2026-09-15",
      "Website relaunch > pick a hosting plan @ 2026-09-18",
      "Website relaunch > write the about page",
      "Website relaunch > ask jo about the logo @ 2026-09-20",
      "Health > book a check-up 9/10",
      "Health > gym @ 2026-09-14",
    ]);
  });

  it("reads Windows line endings too", () => {
    expect(shape("Website:\r\n- pick a host\r\n")).toEqual(["project Website", "Website > pick a host"]);
  });

  it("reads a date word at the end of rambling too, which the review sheet is for", () => {
    // "ugh so much on today" ends in a date word, so it becomes a task due today. A rule
    // can't tell that apart from "call the bank on friday" — you untick or edit it instead.
    expect(shape("ugh so much on today")).toEqual(["Inbox > ugh so much @ 2026-09-14"]);
  });

  it("keeps a task whose whole line was a date word", () => {
    // "tomorrow" alone leaves no title, so there's nothing worth adding.
    expect(parse("tomorrow").tasks).toEqual([]);
  });
});
