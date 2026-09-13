import { render, screen } from "@testing-library/react";
import TodayPage from "@/app/page";

describe("Today page", () => {
  it("is a signpost until Block 6 fills it in", () => {
    render(<TodayPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Today" })).toBeInTheDocument();
    expect(screen.getByText(/Block 6/)).toBeInTheDocument();
  });
});
