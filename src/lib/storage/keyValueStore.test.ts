import { browserStore, memoryStore } from "./keyValueStore";

describe("memoryStore", () => {
  it("reads back what it wrote, and forgets what it removed", () => {
    const store = memoryStore();

    expect(store.read("a")).toBeNull();
    store.write("a", "1");
    expect(store.read("a")).toBe("1");

    store.remove("a");
    expect(store.read("a")).toBeNull();
  });

  it("can start with something already saved", () => {
    expect(memoryStore({ a: "1" }).read("a")).toBe("1");
  });

  it("lists its keys", () => {
    const store = memoryStore({ a: "1" });
    store.write("b", "2");

    expect([...store.keys()].sort()).toEqual(["a", "b"]);
  });
});

describe("browserStore", () => {
  beforeEach(() => window.localStorage.clear());

  it("uses localStorage when there is one", () => {
    const store = browserStore();

    store?.write("tipon.test", "hello");

    expect(window.localStorage.getItem("tipon.test")).toBe("hello");
    expect(store?.read("tipon.test")).toBe("hello");
    expect(store?.keys()).toContain("tipon.test");
  });

  it("leaves no probe key behind", () => {
    browserStore();

    expect(window.localStorage.getItem("tipon.probe")).toBeNull();
  });

  it("says there is no store when the browser refuses, instead of throwing", () => {
    const refuse = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("The quota has been exceeded.");
    });

    expect(browserStore()).toBeNull();

    refuse.mockRestore();
  });

  it("passes a write refusal on to the caller, which decides what to say", () => {
    const store = browserStore();
    const refuse = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("The quota has been exceeded.");
    });

    expect(() => store?.write("tipon.test", "hello")).toThrow("quota");

    refuse.mockRestore();
  });
});
