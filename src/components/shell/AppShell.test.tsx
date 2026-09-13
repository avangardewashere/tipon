import { render, screen, within } from "@testing-library/react";
import { AppShell } from "./AppShell";

const pathname = jest.fn<string, []>();
jest.mock("next/navigation", () => ({ usePathname: () => pathname() }));

describe("AppShell", () => {
  it("offers the three places to be", () => {
    pathname.mockReturnValue("/");

    render(<AppShell>page</AppShell>);

    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "Today" })).toHaveAttribute("href", "/");
    expect(within(nav).getByRole("link", { name: "Dump" })).toHaveAttribute("href", "/dump");
    expect(within(nav).getByRole("link", { name: "Projects" })).toHaveAttribute("href", "/projects");
  });

  it("draws the page it is given", () => {
    pathname.mockReturnValue("/");

    render(
      <AppShell>
        <h1>Today</h1>
      </AppShell>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Today" })).toBeInTheDocument();
  });

  it.each([
    ["/", "Today"],
    ["/dump", "Dump"],
    ["/projects", "Projects"],
    ["/projects/p-web", "Projects"],
  ])("marks the current tab on %s", (path, label) => {
    pathname.mockReturnValue(path);

    render(<AppShell>page</AppShell>);

    expect(screen.getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByRole("link").filter((link) => link.hasAttribute("aria-current"))).toHaveLength(1);
  });

  it("does not mark Today on every page, because every path starts with a slash", () => {
    pathname.mockReturnValue("/inbox");

    render(<AppShell>page</AppShell>);

    expect(screen.getByRole("link", { name: "Today" })).not.toHaveAttribute("aria-current");
  });
});
