/** @jest-environment node */
import { askForDurableStorage } from "./durability";

describe("askForDurableStorage", () => {
  it("says so when the browser has no Storage API", async () => {
    await expect(askForDurableStorage(undefined)).resolves.toBe("unsupported");
    await expect(askForDurableStorage(null)).resolves.toBe("unsupported");
    await expect(askForDurableStorage({})).resolves.toBe("unsupported");
  });

  it("asks, and reports a yes", async () => {
    const persist = jest.fn().mockResolvedValue(true);

    await expect(askForDurableStorage({ persisted: async () => false, persist })).resolves.toBe("granted");
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("reports a no without pretending otherwise", async () => {
    await expect(askForDurableStorage({ persisted: async () => false, persist: async () => false })).resolves.toBe(
      "refused",
    );
  });

  it("doesn't ask again when storage is already persistent", async () => {
    const persist = jest.fn().mockResolvedValue(true);

    await expect(askForDurableStorage({ persisted: async () => true, persist })).resolves.toBe("already");
    expect(persist).not.toHaveBeenCalled();
  });

  it("asks anyway when the browser can't say whether it's already persistent", async () => {
    const persist = jest.fn().mockResolvedValue(true);

    await expect(askForDurableStorage({ persist })).resolves.toBe("granted");
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("survives a browser that throws instead of answering", async () => {
    const boom = async () => {
      throw new Error("denied by policy");
    };

    await expect(askForDurableStorage({ persist: boom })).resolves.toBe("failed");
    await expect(askForDurableStorage({ persisted: boom, persist: async () => true })).resolves.toBe("failed");
  });
});
