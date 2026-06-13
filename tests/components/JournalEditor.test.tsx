// jsdom (default env). Smoke + interaction test for the journal editor.
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JournalEditor } from "@/components/JournalEditor";

describe("JournalEditor", () => {
  it("renders a labelled textarea and a disabled submit until a mood + text exist", () => {
    render(<JournalEditor busy={false} onSubmit={vi.fn()} />);

    // Accessible, labelled multi-line input.
    const textbox = screen.getByRole("textbox", { name: /what is on your mind/i });
    expect(textbox).toBeInTheDocument();

    // Submit starts disabled (no mood / no body yet).
    expect(screen.getByRole("button", { name: /reflect with me/i })).toBeDisabled();
  });

  it("does not submit when only text is provided (mood still required)", async () => {
    const onSubmit = vi.fn();
    render(<JournalEditor busy={false} onSubmit={onSubmit} />);

    await userEvent.type(
      screen.getByRole("textbox", { name: /what is on your mind/i }),
      "Tough day with mocks.",
    );
    // Submit remains disabled without a mood selection.
    expect(screen.getByRole("button", { name: /reflect with me/i })).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows a busy label while submitting", () => {
    render(<JournalEditor busy onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: /reflecting/i })).toBeInTheDocument();
  });
});
