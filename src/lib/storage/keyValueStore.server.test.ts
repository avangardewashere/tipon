/** @jest-environment node */
import { browserStore } from "./keyValueStore";

describe("browserStore on the server", () => {
  it("is null, because a server render has no localStorage", () => {
    expect(typeof window).toBe("undefined");
    expect(browserStore()).toBeNull();
  });
});
