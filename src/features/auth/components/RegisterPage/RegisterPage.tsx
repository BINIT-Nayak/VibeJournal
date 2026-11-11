"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Check, LoaderCircle } from "lucide-react";
import { registrationFormSchema, type RegistrationFormValues } from "../../schemas";
import styles from "../shared/AuthLayout.module.css";
import { AuthLayout } from "../shared/AuthLayout";
import { PasswordInput } from "../shared/PasswordInput";

export function RegisterPage() {
  const [succeeded, setSucceeded] = useState(false);
  const submitting = useRef(false);
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<RegistrationFormValues>({
    resolver: zodResolver(registrationFormSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
    mode: "onBlur",
    reValidateMode: "onChange",
  });
  const busy = isSubmitting || succeeded;

  async function submit(values: RegistrationFormValues) {
    if (submitting.current) return;
    submitting.current = true;
    clearErrors("root");
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Confirmation is a form check, never persisted or sent to the API.
        body: JSON.stringify({ name: values.name, email: values.email, password: values.password }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 409) {
          setError(
            "email",
            { message: "An account already uses this email. Try signing in." },
            { shouldFocus: true }
          );
        }
        throw new Error(
          typeof result?.error === "string"
            ? result.error
            : "We couldn't create your account. Please try again."
        );
      }
      if (typeof result?.user?.id !== "string") {
        throw new Error(
          "Your account may have been created, but we couldn't sign you in. Please try the sign-in link below."
        );
      }
      setSucceeded(true);
      // A full navigation lets the protected server page read the new auth cookie.
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
    <AuthLayout mode="register">
      <form onSubmit={handleSubmit(submit)} noValidate aria-busy={busy}>
        <fieldset disabled={busy} className={styles.fields}>
          <legend className={styles.srOnly}>Create your account</legend>
          <div className={styles.field}>
            <label htmlFor="register-name">Your name</label>
            <input
              id="register-name"
              autoComplete="name"
              placeholder="What should we call you?"
              maxLength={100}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "name-error" : undefined}
              {...register("name")}
            />
            {errors.name && (
              <p id="name-error" className={styles.fieldError} role="alert">
                {errors.name.message}
              </p>
            )}
          </div>
          <div className={styles.field}>
            <label htmlFor="register-email">Email address</label>
            <input
              id="register-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="you@example.com"
              maxLength={254}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "email-error" : undefined}
              {...register("email")}
            />
            {errors.email && (
              <p id="email-error" className={styles.fieldError} role="alert">
                {errors.email.message}
              </p>
            )}
          </div>
          <div className={styles.field}>
            <label htmlFor="register-password">Password</label>
            <PasswordInput
              id="register-password"
              autoComplete="new-password"
              placeholder="Create a password"
              maxLength={128}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={`password-hint${errors.password ? " password-error" : ""}`}
              {...register("password")}
            />
            <p id="password-hint" className={styles.hint}>
              Use at least 8 characters. A longer phrase works well.
            </p>
            {errors.password && (
              <p id="password-error" className={styles.fieldError} role="alert">
                {errors.password.message}
              </p>
            )}
          </div>
          <div className={styles.field}>
            <label htmlFor="register-confirm">Confirm password</label>
            <PasswordInput
              visibilityLabel="confirmed password"
              id="register-confirm"
              autoComplete="new-password"
              placeholder="Enter your password again"
              maxLength={128}
              aria-invalid={Boolean(errors.confirmPassword)}
              aria-describedby={errors.confirmPassword ? "confirm-error" : undefined}
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p id="confirm-error" className={styles.fieldError} role="alert">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>
        </fieldset>

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
          {succeeded
            ? "Your journal is ready"
            : isSubmitting
              ? "Creating your account…"
              : "Create my account"}
          {!busy && <ArrowRight size={18} aria-hidden="true" />}
        </button>
        <p className={styles.status} role="status" aria-live="polite">
          {succeeded
            ? "Account created. Opening your journal…"
            : isSubmitting
              ? "Just a moment. We're preparing your space."
              : "A private space for your everyday thoughts."}
        </p>
      </form>
    </AuthLayout>
  );
}
