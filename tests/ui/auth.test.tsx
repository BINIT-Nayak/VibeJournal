import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "@/features/auth/components/LoginPage/LoginForm";
import { PasswordInput } from "@/features/auth/components/shared/PasswordInput";
describe("sign-in form", () => {
  it("explains invalid fields before attempting sign-in", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText("Email address"), "invalid");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Enter a valid email.")).toBeVisible();
    expect(screen.getByText("Password must be at least 8 characters.")).toBeVisible();
  });
  it("disables submission while waiting and lets the user retry incorrect credentials", async () => {
    let respond!: (response: Response) => void;
    vi.stubGlobal(
      "fetch",
      () =>
        new Promise<Response>((resolve) => {
          respond = resolve;
        })
    );
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText("Email address"), "someone@example.invalid");
    await user.type(screen.getByLabelText("Password", { exact: true }), "WrongPassword123!");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("button", { name: /Signing you in/ })).toBeDisabled();
    expect(screen.getByLabelText("Email address")).toBeDisabled();
    respond(new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401 }));
    expect(await screen.findByRole("alert")).toHaveTextContent("email and password don't match");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
    expect(screen.getByLabelText("Email address")).toHaveValue("someone@example.invalid");
  });
  it("offers a readable error after a connection failure", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new TypeError("Failed to fetch")));
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText("Email address"), "someone@example.invalid");
    await user.type(screen.getByLabelText("Password", { exact: true }), "Password123!");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Check your connection");
  });
  it("lets keyboard users reveal and hide their password without losing it", async () => {
    const user = userEvent.setup();
    render(
      <>
        <label htmlFor="password">Password</label>
        <PasswordInput id="password" />
      </>
    );
    const field = screen.getByLabelText("Password", { exact: true });
    await user.type(field, "PrivatePassword123!");
    await user.tab();
    await user.keyboard("{Enter}");
    expect(field).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await user.keyboard("{Enter}");
    expect(field).toHaveAttribute("type", "password");
    expect(field).toHaveValue("PrivatePassword123!");
  });
});
