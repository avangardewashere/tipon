import { screen } from "@testing-library/react";
import { BackupScreen } from "./BackupScreen";
import { downloadText } from "@/lib/storage/download";
import { memoryStore } from "@/lib/storage/keyValueStore";
import { parseSaveFile } from "@/lib/storage/saveFile";
import { exportText, KEPT_PREFIX, SAVE_KEY } from "@/lib/storage/workspaceStorage";
import { makeProject, makeTask, makeWorkspace, NOW, renderWithWorkspace, storeHolding } from "@/test/workspace";

jest.mock("@/lib/storage/download", () => ({ downloadText: jest.fn() }));
const download = jest.mocked(downloadText);

const website = makeWorkspace({
  projects: [makeProject({ id: "p-web", name: "Website relaunch" })],
  tasks: [makeTask({ id: "t-1", title: "Pick a host", projectId: "p-web" })],
});

const backupFile = (text: string) => new File([text], "tipon-backup.json", { type: "application/json" });

beforeEach(() => download.mockClear());

describe("Backup screen", () => {
  it("says what is in this browser", () => {
    renderWithWorkspace(<BackupScreen />, { workspace: website });

    expect(screen.getByText("1 project and 1 task in this browser right now.")).toBeInTheDocument();
  });

  it("exports a file that can be read straight back in", async () => {
    const { user } = renderWithWorkspace(<BackupScreen />, { workspace: website });

    await user.click(screen.getByRole("button", { name: "Export a backup" }));

    expect(download).toHaveBeenCalledTimes(1);
    const [fileName, text] = download.mock.calls[0];
    expect(fileName).toBe("tipon-backup.json");
    const result = parseSaveFile(text);
    expect(result.ok === true && result.saveFile.workspace).toEqual(website);
  });

  it("asks before replacing anything", async () => {
    const { user } = renderWithWorkspace(<BackupScreen />, { workspace: makeWorkspace() });

    await user.upload(screen.getByLabelText("Backup file"), backupFile(exportText(website, 900)));

    expect(await screen.findByText(/That file holds 1 project and 1 task/)).toBeInTheDocument();
    // Still nothing imported until the question is answered.
    expect(screen.getByText("0 projects and 0 tasks in this browser right now.")).toBeInTheDocument();
  });

  it("replaces everything once you say yes, and keeps what was there", async () => {
    const store = storeHolding(makeWorkspace({ projects: [makeProject({ id: "p-old", name: "Old site" })] }));
    const { user } = renderWithWorkspace(<BackupScreen />, { store });

    await user.upload(screen.getByLabelText("Backup file"), backupFile(exportText(website, 900)));
    await user.click(await screen.findByRole("button", { name: "Replace everything" }));

    expect(screen.getByText("1 project and 1 task in this browser right now.")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(`kept as “${KEPT_PREFIX}${NOW}”`);
    expect(store.read(`${KEPT_PREFIX}${NOW}`)).toContain("Old site");
    expect(store.read(SAVE_KEY)).toContain("Website relaunch");
  });

  it("changes nothing when you cancel", async () => {
    const { user } = renderWithWorkspace(<BackupScreen />, { workspace: makeWorkspace() });

    await user.upload(screen.getByLabelText("Backup file"), backupFile(exportText(website, 900)));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("button", { name: "Replace everything" })).not.toBeInTheDocument();
    expect(screen.getByText("0 projects and 0 tasks in this browser right now.")).toBeInTheDocument();
  });

  it.each([
    ["a file that isn't JSON", "{ half a file", "isn't JSON at all"],
    ["a file from a newer Tipon", JSON.stringify({ app: "tipon", version: 9, savedAt: 1, workspace: { projects: [], tasks: [] } }), "newer version"],
    ["somebody else's JSON", JSON.stringify({ hello: "world" }), "isn't a Tipon backup"],
  ])("refuses %s and says why", async (_name, text, message) => {
    const { user, store } = renderWithWorkspace(<BackupScreen />, { workspace: website });

    await user.upload(screen.getByLabelText("Backup file"), backupFile(text));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByRole("alert")).toHaveTextContent("Nothing has changed.");
    expect(store.read(SAVE_KEY)).toContain("Website relaunch");
  });

  it("lists the copies it has kept", () => {
    renderWithWorkspace(<BackupScreen />, {
      store: memoryStore({ [`${KEPT_PREFIX}2000`]: "{}", [`${KEPT_PREFIX}1000`]: "{}" }),
    });

    const kept = screen.getByRole("region", { name: "Copies we kept" });
    expect(kept).toHaveTextContent(`${KEPT_PREFIX}2000`);
    expect(kept).toHaveTextContent(`${KEPT_PREFIX}1000`);
  });

  it("says nothing about kept copies when there are none", () => {
    renderWithWorkspace(<BackupScreen />, { workspace: website });

    expect(screen.queryByRole("region", { name: "Copies we kept" })).not.toBeInTheDocument();
  });
});
