"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, LoaderCircle } from "lucide-react";
import { useCredentialsForm } from "../../hooks/use-credentials-form";
import type { CredentialsInput } from "../../schemas";
import { AuthLayout } from "../shared/AuthLayout";
import { PasswordInput } from "../shared/PasswordInput";
import styles from "../shared/AuthLayout.module.css";

export function LoginForm({ googleEnabled = false }: { googleEnabled?: boolean }) {
  const [succeeded, setSucceeded] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const submitting = useRef(false);
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useCredentialsForm();
  const busy = isSubmitting || succeeded || googlePending;

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.has("error") || query.has("auth_error")) {
      setError("root.server", { message: "We couldn't complete that sign-in. Please try again." });
    }
  }, [setError]);

  async function submit(values: CredentialsInput) {
    if (submitting.current) return;
    submitting.current = true;
    clearErrors("root");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = await response.json().catch(() => null);
      if (response.status === 401) {
        throw new Error("That email and password don't match. Please check them and try again.");
      }
      if (!response.ok) {
        throw new Error(
          typeof result?.error === "string"
            ? result.error
            : "Sign-in is temporarily unavailable. Please try again."
        );
      }
      if (typeof result?.user?.id !== "string")
        throw new Error("We couldn't verify your session. Please try signing in again.");
      setSucceeded(true);
      // Read the fresh Auth.js cookie on the protected server route.
      window.location.assign("/dashboard");
    } catch (error) {
      setError("root.server", {
        message:
          error instanceof TypeError
            ? "We couldn't connect. Check your connection and try again."
            : error instanceof Error
              ? error.message
              : "Something went wrong. Please try again.",
      });
      submitting.current = false;
    }
  }

  return (
    <AuthLayout mode="login">
      <form onSubmit={handleSubmit(submit)} noValidate aria-busy={busy}>
        <fieldset disabled={busy} className={styles.fields}>
          <legend className={styles.srOnly}>Sign in to your journal</legend>
          <div className={styles.field}>
            <label htmlFor="login-email">Email address</label>
            <input
              id="login-email"
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="you@example.com"
              maxLength={254}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "login-email-error" : undefined}
              {...register("email")}
            />
            {errors.email && (
              <p id="login-email-error" className={styles.fieldError} role="alert">
                {errors.email.message}
              </p>
            )}
          </div>
          <div className={styles.field}>
            <label htmlFor="login-password">Password</label>
            <PasswordInput
              id="login-password"
              autoComplete="current-password"
              placeholder="Enter your password"
              maxLength={128}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? "login-password-error" : undefined}
              {...register("password")}
            />
            {errors.password && (
              <p id="login-password-error" className={styles.fieldError} role="alert">
                {errors.password.message}
              </p>
            )}
          </div>
        </fieldset>
        <div className={styles.recoveryLink}>
          <Link href="/forgot-password">Forgot password?</Link>
        </div>
        {errors.root?.server && (
          <div className={styles.serverError} role="alert">
            {errors.root.server.message}
          </div>
        )}
        <button className={styles.submit} disabled={busy} type="submit">
          {succeeded ? (
            <Check size={18} aria-hidden="true" />
          ) : isSubmitting ? (
            <LoaderCircle className={styles.spinner} size={18} aria-hidden="true" />
          ) : null}
          {succeeded ? "Welcome back" : isSubmitting ? "Signing you in…" : "Sign in"}
          {!busy && <ArrowRight size={18} aria-hidden="true" />}
        </button>
        <p className={styles.status} role="status" aria-live="polite">
          {succeeded
            ? "Signed in. Opening your dashboard…"
            : isSubmitting
              ? "Just a moment. We're opening your space."
              : "A private space for your everyday thoughts."}
        </p>
        {googleEnabled && (
          <>
            <div className={styles.divider}>
              <span>or</span>
            </div>
            <button
              className={styles.secondaryButton}
              disabled={busy}
              type="button"
              onClick={() => {
                setGooglePending(true);
                window.location.href = "/api/auth/google";
              }}
            >
              {googlePending ? "Connecting…" : "Continue with Google"}
            </button>
          </>
        )}
      </form>
    </AuthLayout>
  );
}
