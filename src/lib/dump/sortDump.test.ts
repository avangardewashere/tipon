/** @jest-environment node */
import { sortDump } from "./sortDump";
import type { Proposal } from "./proposal";
import type { Project } from "@/lib/workspace/types";

const TODAY = "2026-09-14";
const TEXT = "call the bank tomorrow\nWebsite relaunch:\n- pick a hosting plan fri";

const projects: Project[] = [
  { id: "p-web", name: "Website relaunch", notes: "", status: "active", createdAt: 0, updatedAt: 0 },
];

const fromClaude: Proposal = {
  projects: [{ key: "p1", name: "Website relaunch", existingId: "p-web", wasArchived: false }],
  tasks: [
    { key: "t1", title: "call the bank about the loan", due: "2026-09-15", projectKey: null },
    { key: "t2", title: "pick a hosting plan", due: "2026-09-18", projectKey: "p1" },
  ],
};

/** A `fetch` that answers with whatever a test hands it. */
function replyWith(status: number, body: unknown): jest.MockedFunction<typeof fetch> {
  return jest.fn(async () =>
    new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  ) as unknown as jest.MockedFunction<typeof fetch>;
}

function sort(options: Partial<Parameters<typeof sortDump>[0]> = {}) {
  return sortDump({ text: TEXT, today: TODAY, projects, accessCode: "open-sesame", ...options });
}

describe("sortDump", () => {
  it("never asks the server without an access code, and never spends a penny", async () => {
    const fetchImpl = replyWith(200, { proposal: fromClaude });

    const outcome = await sort({ accessCode: "", fetchImpl });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(outcome.source).toBe("rules");
    expect(outcome.problem).toBeNull();
    expect(outcome.proposal.tasks.map((task) => task.title)).toEqual(["call the bank", "pick a hosting plan"]);
  });

  it("treats a code of only spaces as no code", async () => {
    const fetchImpl = replyWith(200, { proposal: fromClaude });

    expect((await sort({ accessCode: "   ", fetchImpl })).source).toBe("rules");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("uses Claude's proposal when the server gives one", async () => {
    const fetchImpl = replyWith(200, { proposal: fromClaude });

    const outcome = await sort({ fetchImpl });

    expect(outcome).toEqual({ proposal: fromClaude, source: "claude", problem: null });
  });

  it("sends the dump, today, the code and your projects", async () => {
    const fetchImpl = replyWith(200, { proposal: fromClaude });

    await sort({ fetchImpl });

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/extract");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      text: TEXT,
      today: TODAY,
      accessCode: "open-sesame",
      // Only what the server needs: no notes, no timestamps.
      projects: [{ id: "p-web", name: "Website relaunch", status: "active" }],
    });
  });

  it.each([
    ["the code is wrong", 401, { error: "wrong-code" }, "access code isn't right"],
    ["the dump is too long", 413, { error: "too-long" }, "longer than 4000 characters"],
    ["the server has no key", 503, { error: "no-key" }, "isn't set up"],
    ["the server isn't set up", 503, { error: "not-configured" }, "isn't set up"],
    ["Claude's answer was no good", 502, { error: "bad-reply" }, "didn't make sense"],
    ["Claude couldn't be reached", 502, { error: "upstream" }, "couldn't be reached"],
    ["the server said something unexpected", 500, { error: "kaboom" }, "couldn't be reached"],
    ["the server said nothing useful", 500, "<html>gateway</html>", "couldn't be reached"],
  ])("falls back to the rules when %s", async (_name, status, body, message) => {
    const outcome = await sort({ fetchImpl: replyWith(status, body) });

    expect(outcome.source).toBe("rules");
    expect(outcome.problem).toContain(message);
    // The fallback is a real proposal, not an apology.
    expect(outcome.proposal.tasks).toHaveLength(2);
  });

  it("falls back when there is no network at all", async () => {
    const fetchImpl = jest.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;

    const outcome = await sort({ fetchImpl });

    expect(outcome.source).toBe("rules");
    expect(outcome.problem).toContain("couldn't be reached");
  });

  /**
   * The same thrown fetch means two different things. "You're offline" is a fact about
   * the room; "Claude couldn't be reached" is a fact about the server. Telling someone
   * the wrong one sends them off to debug something that isn't broken.
   */
  it("blames the missing network, not the server, when the app knows it's offline", async () => {
    const fetchImpl = jest.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;

    const outcome = await sort({ fetchImpl, offline: true });

    expect(outcome.source).toBe("rules");
    expect(outcome.problem).toContain("You're offline");
    expect(outcome.problem).not.toContain("couldn't be reached");
  });

  it("still blames the server when a reply comes back wrong while online", async () => {
    // Offline is about reaching the server at all, not about what it said.
    const outcome = await sort({ fetchImpl: replyWith(502, { error: "upstream" }), offline: true });

    expect(outcome.problem).toContain("couldn't be reached");
  });

  it.each([
    ["it isn't a proposal at all", { hello: "world" }],
    ["a task has no title", { proposal: { projects: [], tasks: [{ key: "t1", title: "", due: null, projectKey: null }] } }],
    ["a due date isn't a real day", { proposal: { projects: [], tasks: [{ key: "t1", title: "x", due: "2026-02-30", projectKey: null }] } }],
    ["a task points at a project that isn't there", { proposal: { projects: [], tasks: [{ key: "t1", title: "x", due: null, projectKey: "p9" }] } }],
    ["the body is not JSON", "<html>hello</html>"],
  ])("falls back when a 200 comes back but %s", async (_name, body) => {
    const outcome = await sort({ fetchImpl: replyWith(200, body) });

    expect(outcome.source).toBe("rules");
    expect(outcome.problem).toContain("didn't make sense");
  });

});
