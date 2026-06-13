// jsdom (default env). Smoke + interaction test for the exercise player.
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExercisePlayer } from "@/components/ExercisePlayer";
import type { RecommendedExercise } from "@/lib/schemas";

const exercise: RecommendedExercise = {
  id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
  slug: "five-senses-grounding",
  title: "Five Senses Grounding",
  technique: "5-4-3-2-1 grounding",
  category: "grounding",
  addresses_triggers: ["overwhelm"],
  steps: [
    { order: 1, text: "Name five things you can see." },
    { order: 2, text: "Name four things you can touch." },
  ],
  source: "ai_generated",
};

describe("ExercisePlayer", () => {
  it("renders the first step and the step counter", () => {
    render(<ExercisePlayer exercise={exercise} />);
    expect(screen.getByText(/Five Senses Grounding/i)).toBeInTheDocument();
    expect(screen.getByText(/Name five things you can see\./i)).toBeInTheDocument();
    expect(screen.getByText(/Step 1 of 2/i)).toBeInTheDocument();
  });

  it("advances to the next step on Next", async () => {
    render(<ExercisePlayer exercise={exercise} />);
    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText(/Name four things you can touch\./i)).toBeInTheDocument();
    expect(screen.getByText(/Step 2 of 2/i)).toBeInTheDocument();
  });

  it("calls onClose when finishing the last step", async () => {
    const onClose = vi.fn();
    const single: RecommendedExercise = { ...exercise, steps: [{ order: 1, text: "Only step." }] };
    render(<ExercisePlayer exercise={single} onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: /finish/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
