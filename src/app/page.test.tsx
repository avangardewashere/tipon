import { screen } from "@testing-library/react";
import TodayPage from "@/app/page";
import { renderWithWorkspace } from "@/test/workspace";

describe("Today page", () => {
  it("is where the app opens", () => {
    renderWithWorkspace(<TodayPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Today" })).toBeInTheDocument();
  });
});
