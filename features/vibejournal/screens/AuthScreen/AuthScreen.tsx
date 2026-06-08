"use client";

import { type FormEvent, useState } from "react";
import styles from "./AuthScreen.module.css";

type AuthMode = "login" | "signup" | "reset-request" | "reset-confirm";

type AuthScreenProps = {
  error: string;
  isBusy: boolean;
  onLogin: (email: string, password: string) => void;
  onPasswordReset: (email: string) => void;
  onPasswordResetConfirm: (token: string, password: string) => void;
  onSignup: (name: string, email: string, password: string) => void;
  resetToken: string;
};

export function AuthScreen({
  error,
  isBusy,
  onLogin,
  onPasswordReset,
  onPasswordResetConfirm,
  onSignup,
  resetToken,
}: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [token, setToken] = useState("");
  const shouldShowResetNotice = resetToken ? mode === "reset-confirm" : false;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (mode === "signup") {
      onSignup(name, email, password);
      return;
    }

    if (mode === "reset-request") {
      onPasswordReset(email);
      setMode("reset-confirm");
      return;
    }

    if (mode === "reset-confirm") {
      onPasswordResetConfirm(token || resetToken, password);
      return;
    }

    onLogin(email, password);
  }

  return (
    <main className={styles.authShell}>
      <section className={styles.hero}>
        <p>Private mood journal</p>
        <h1>VibeJournal</h1>
        <span>Keep your check-ins tied to your account, not a single browser tab.</span>
      </section>

      <form className={styles.authPanel} onSubmit={handleSubmit}>
        <div className={styles.modeSwitch}>
          <button
            className={mode === "login" ? styles.activeMode : ""}
            onClick={() => setMode("login")}
            type="button"
          >
            Login
          </button>
          <button
            className={mode === "signup" ? styles.activeMode : ""}
            onClick={() => setMode("signup")}
            type="button"
          >
            Signup
          </button>
        </div>

        {mode === "signup" ? (
          <label>
            Name
            <input
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              value={name}
            />
          </label>
        ) : null}

        {mode !== "reset-confirm" ? (
          <label>
            Email
            <input
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              type="email"
              value={email}
            />
          </label>
        ) : null}

        {mode === "reset-confirm" ? (
          <label>
            Reset token
            <input
              onChange={(event) => setToken(event.target.value)}
              placeholder="Paste reset token"
              value={token || resetToken}
            />
          </label>
        ) : null}

        {mode !== "reset-request" ? (
          <label>
            Password
            <span className={styles.passwordField}>
              <input
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                type={showPassword ? "text" : "password"}
                value={password}
              />
              <button
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((current) => !current)}
                type="button"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </span>
          </label>
        ) : null}

        {error ? <p className={styles.error}>{error}</p> : null}
        {shouldShowResetNotice ? (
          <p className={styles.notice}>Dev reset token generated. Paste it or submit as-is.</p>
        ) : null}

        <button className={styles.primaryButton} disabled={isBusy} type="submit">
          {isBusy ? "Working..." : getSubmitLabel(mode)}
        </button>

        <button
          className={styles.textButton}
          onClick={() => setMode(mode === "reset-confirm" ? "login" : "reset-request")}
          type="button"
        >
          {mode === "reset-confirm" ? "Back to login" : "Forgot password?"}
        </button>

        <button className={styles.googleButton} disabled type="button">
          Google login ready when OAuth keys are configured
        </button>
      </form>
    </main>
  );
}

function getSubmitLabel(mode: AuthMode) {
  if (mode === "signup") return "Create Account";
  if (mode === "reset-request") return "Send Reset Token";
  if (mode === "reset-confirm") return "Reset Password";
  return "Login";
}
