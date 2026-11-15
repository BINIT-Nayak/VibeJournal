import { useState } from "react";
import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MoodSelector } from "@/features/journal/components/MoodSelector/MoodSelector";
function CheckIn() {
  const [mood, setMood] = useState(5);
  return <MoodSelector value={mood} onChange={setMood} />;
}
it("announces a numeric mood and supports keyboard selection", async () => {
  const user = userEvent.setup();
  render(<CheckIn />);
  await user.tab();
  expect(screen.getByRole("radio", { name: /5 out of 10/ })).toHaveFocus();
  await user.keyboard("{ArrowRight}");
  expect(screen.getByRole("radio", { name: /6 out of 10/ })).toBeChecked();
  expect(screen.getByText("Selected: 6/10 — Okay")).toBeVisible();
});
it("connects the validation explanation to the control", () => {
  render(<MoodSelector onChange={() => {}} error="Choose a mood score." />);
  expect(screen.getByRole("group", { name: /Mood score/ })).toHaveAccessibleDescription(
    /Choose a mood score/
  );
  expect(screen.getByRole("alert")).toHaveTextContent("Choose a mood score.");
});
