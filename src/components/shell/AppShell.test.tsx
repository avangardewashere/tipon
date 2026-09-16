import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppShell } from "./AppShell";

const pathname = jest.fn<string, []>();
const push = jest.fn();
jest.mock("next/navigation", () => ({ usePathname: () => pathname(), useRouter: () => ({ push }) }));

describe("AppShell", () => {
  beforeEach(() => push.mockClear());

  it("offers the three places to be", () => {
    pathname.mockReturnValue("/");

    render(<AppShell>page</AppShell>);

    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "Today" })).toHaveAttribute("href", "/");
    expect(within(nav).getByRole("link", { name: "Dump" })).toHaveAttribute("href", "/dump");
    expect(within(nav).getByRole("link", { name: "Projects" })).toHaveAttribute("href", "/projects");
  });

  it("links to Backup from the footer, where it doesn't crowd the three tabs", () => {
    pathname.mockReturnValue("/projects");

    render(<AppShell>page</AppShell>);

    const footer = screen.getByRole("contentinfo");
    expect(within(footer).getByRole("link", { name: "Backup & restore" })).toHaveAttribute("href", "/backup");
    expect(within(screen.getByRole("navigation", { name: "Main" })).getAllByRole("link")).toHaveLength(3);
  });

  it("goes to a page when its key is pressed", async () => {
    pathname.mockReturnValue("/");
    const user = userEvent.setup();
    render(<AppShell>page</AppShell>);

    await user.keyboard("d");

    expect(push).toHaveBeenCalledWith("/dump");
  });

  it("keeps quiet while you are writing in the page", async () => {
    pathname.mockReturnValue("/dump");
    const user = userEvent.setup();
    render(
      <AppShell>
        <label htmlFor="notepad">Your dump</label>
        <textarea id="notepad" />
      </AppShell>,
    );

    await user.click(screen.getByLabelText("Your dump"));
    await user.keyboard("dump the bins today");

    expect(push).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Your dump")).toHaveValue("dump the bins today");
  });

  it("shows the keys it listens for", () => {
    pathname.mockReturnValue("/");

    render(<AppShell>page</AppShell>);

    const footer = screen.getByRole("contentinfo");
    expect(within(footer).getByText("T")).toBeInTheDocument();
    expect(footer).toHaveTextContent("Keys:");
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
