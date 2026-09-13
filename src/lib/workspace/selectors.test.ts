import { activeProjects, archivedProjects, findProject, openTaskCount, tasksIn } from "./selectors";
import { makeProject, makeTask, makeWorkspace } from "@/test/workspace";

const web = makeProject({ id: "p-web", name: "Website relaunch" });
const old = makeProject({ id: "p-old", name: "Old site", status: "archived" });

const workspace = makeWorkspace({
  projects: [web, old],
  tasks: [
    makeTask({ id: "t-inbox", title: "Call the bank", createdAt: 10 }),
    makeTask({ id: "t-done", title: "Pick a host", projectId: "p-web", createdAt: 20, doneAt: 500 }),
    makeTask({ id: "t-open", title: "Write the about page", projectId: "p-web", createdAt: 30 }),
    makeTask({ id: "t-later", title: "Check the forms", projectId: "p-web", createdAt: 40 }),
    makeTask({ id: "t-done-2", title: "Buy the domain", projectId: "p-web", createdAt: 5, doneAt: 900 }),
  ],
});

describe("selectors", () => {
  it("splits projects by status", () => {
    expect(activeProjects(workspace)).toEqual([web]);
    expect(archivedProjects(workspace)).toEqual([old]);
  });

  it("finds a project, or says there isn't one", () => {
    expect(findProject(workspace, "p-web")).toBe(web);
    expect(findProject(workspace, "nope")).toBeNull();
  });

  it("lists open tasks first in the order they were added", () => {
    const ids = tasksIn(workspace, "p-web").map((task) => task.id);

    expect(ids).toEqual(["t-open", "t-later", "t-done-2", "t-done"]);
  });

  it("treats a null project as the Inbox", () => {
    expect(tasksIn(workspace, null).map((task) => task.id)).toEqual(["t-inbox"]);
  });

  it("never changes the workspace while sorting", () => {
    const before = [...workspace.tasks];

    tasksIn(workspace, "p-web");

    expect(workspace.tasks).toEqual(before);
  });

  it("counts only open tasks", () => {
    expect(openTaskCount(workspace, "p-web")).toBe(2);
    expect(openTaskCount(workspace, null)).toBe(1);
    expect(openTaskCount(workspace, "p-old")).toBe(0);
  });
});
