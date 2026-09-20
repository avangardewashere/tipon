/** @jest-environment node */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import manifest, { SPLASH_BACKGROUND, THEME_COLOUR } from "./manifest";

const result = manifest();

describe("the web app manifest", () => {
  it("installs as an app, not a browser tab", () => {
    expect(result.display).toBe("standalone");
    expect(result.start_url).toBe("/");
  });

  it("is named the same thing on the home screen as everywhere else", () => {
    expect(result.name).toBe("Tipon");
    expect(result.short_name).toBe("Tipon");
    // Android truncates a long short_name under the icon; twelve characters is safe.
    expect(result.short_name!.length).toBeLessThanOrEqual(12);
  });

  it("offers both sizes Android asks for", () => {
    const anyPurpose = (result.icons ?? []).filter((icon) => icon.purpose === "any");

    expect(anyPurpose.map((icon) => icon.sizes)).toEqual(["192x192", "512x512"]);
    expect(anyPurpose.every((icon) => icon.type === "image/png")).toBe(true);
  });

  it("has a maskable icon, or Android crops the notebook's corners off", () => {
    const maskable = (result.icons ?? []).filter((icon) => icon.purpose === "maskable");

    expect(maskable).toHaveLength(1);
    expect(maskable[0]).toMatchObject({ sizes: "512x512", type: "image/png" });
  });

  it("points every icon at a file that exists", () => {
    for (const icon of result.icons ?? []) {
      const file = join(process.cwd(), "public", String(icon.src));
      expect(() => readFileSync(file)).not.toThrow();
    }
  });

  /**
   * The splash screen is drawn by the operating system from these colours, so nothing in
   * the app can reveal a mismatch. Read the stylesheet instead: change the palette and
   * this fails rather than launching Tipon on last season's paper.
   */
  it("uses the same paper as the stylesheet", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    const paper = /--paper:\s*(#[0-9a-f]{3,8})\s*;/i.exec(css)?.[1];

    expect(paper).toBeDefined();
    expect(SPLASH_BACKGROUND).toBe(paper);
    expect(THEME_COLOUR).toBe(paper);
    expect(result.background_color).toBe(paper);
    expect(result.theme_color).toBe(paper);
  });
});
