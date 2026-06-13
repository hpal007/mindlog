// jsdom (default env). Smoke test for the crisis banner.
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CrisisResourceBanner } from "@/components/CrisisResourceBanner";
import { HELPLINES } from "@/lib/constants";

describe("CrisisResourceBanner", () => {
  it("announces as an alert and renders helplines as tel: links", () => {
    render(
      <CrisisResourceBanner
        payload={{ risk: "acute", message: "You matter.", helplines: [...HELPLINES] }}
      />,
    );

    // role=alert so assistive tech announces the crisis immediately.
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/You matter\./)).toBeInTheDocument();

    // At least one tappable tel: link to a real helpline.
    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThan(0);
    expect(links.some((a) => a.getAttribute("href")?.startsWith("tel:"))).toBe(true);
  });

  it("falls back to the default helplines + grounding message with no payload", () => {
    render(<CrisisResourceBanner />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    const links = screen.getAllByRole("link");
    expect(links.some((a) => a.getAttribute("href")?.startsWith("tel:"))).toBe(true);
  });
});
