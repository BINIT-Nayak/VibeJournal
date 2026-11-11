"use client";

import { useEffect, useState } from "react";
import { AuthScreen } from "./AuthScreen/AuthScreen";

async function authRequest(path: string, payload: Record<string, string>) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Authentication failed.");
  return data;
}

export function AuthenticationPage({ googleEnabled = false }: { googleEnabled?: boolean }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetToken, setResetToken] = useState("");

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.has("error") || query.has("auth_error"))
      setError("Sign-in failed. Please try again.");
  }, []);

  async function authenticate(path: string, payload: Record<string, string>) {
    setBusy(true);
    setError("");
    try {
      const result = await authRequest(path, payload);
      if (!result.user?.id) throw new Error("Please sign in again.");
      window.location.assign("/dashboard");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  async function reset(email: string) {
    setBusy(true);
    setError("");
    setResetToken("");
    try {
      const result = await authRequest("/api/auth/password-reset/request", { email });
      setResetToken(result.resetToken || "");
      if (!result.resetToken)
        setError("If recovery is available for this account, check your email for next steps.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not request reset.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm(token: string, password: string) {
    setBusy(true);
    setError("");
    try {
      await authRequest("/api/auth/password-reset/confirm", { token, password });
      setResetToken("");
      setError("Password reset. You can log in now.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not reset password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthScreen
      error={error}
      isBusy={busy}
      resetToken={resetToken}
      onLogin={(email, password) => authenticate("/api/auth/login", { email, password })}
      onPasswordReset={reset}
      onPasswordResetConfirm={confirm}
      onGoogleLogin={
        googleEnabled
          ? () => {
              window.location.href = "/api/auth/google";
            }
          : undefined
      }
    />
  );
}
