import { sortDump } from "./sortDump";

/**
 * This file runs in jsdom, which — like an older browser — has no global `fetch`.
 * Reaching for one must not throw before the rules get their chance.
 */
describe("sortDump where there is no fetch", () => {
  it("is the rules, not a crash", async () => {
    expect(globalThis.fetch).toBeUndefined();

    const outcome = await sortDump({
      text: "call the bank tomorrow",
      today: "2026-09-14",
      projects: [],
      accessCode: "open-sesame",
    });

    expect(outcome.source).toBe("rules");
    expect(outcome.problem).toContain("couldn't be reached");
    expect(outcome.proposal.tasks[0]).toMatchObject({ title: "call the bank", due: "2026-09-15" });
  });
});
