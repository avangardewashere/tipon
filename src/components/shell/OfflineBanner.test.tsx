import { render, screen } from "@testing-library/react";
import { useOffline } from "next/offline";
import { OfflineBanner } from "./OfflineBanner";

jest.mock("next/offline", () => ({ useOffline: jest.fn() }));
const mockedUseOffline = useOffline as jest.MockedFunction<typeof useOffline>;

describe("<OfflineBanner>", () => {
  it("says nothing at all when there's a network", () => {
    mockedUseOffline.mockReturnValue(false);

    const { container } = render(<OfflineBanner />);

    expect(container).toBeEmptyDOMElement();
  });

  it("reassures rather than alarms when there isn't", () => {
    mockedUseOffline.mockReturnValue(true);

    render(<OfflineBanner />);

    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent("No signal");
    // The point of the sentence: nothing is broken, one feature is missing.
    expect(banner).toHaveTextContent("still works");
    expect(banner).toHaveTextContent("Claude needs a connection");
  });
});
