import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Leaf, LockKeyhole } from "lucide-react";
import styles from "./AuthLayout.module.css";

export function AuthLayout({
  mode,
  children,
}: {
  mode: "login" | "register";
  children: ReactNode;
}) {
  const login = mode === "login";
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/login" aria-label="VibeJournal sign in">
          <span className={styles.brandMark}>
            <Leaf size={20} strokeWidth={1.6} aria-hidden="true" />
          </span>
          VibeJournal
        </Link>
        <p>
          {login ? "New to VibeJournal?" : "Already have an account?"}{" "}
          <Link href={login ? "/register" : "/login"}>
            {login ? "Create account" : "Sign in"} <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </p>
      </header>
      <div className={styles.layout}>
        <section className={styles.intro} aria-labelledby="welcome-heading">
          <span className={styles.eyebrow}>A LITTLE SPACE FOR YOU</span>
          <h1 id="welcome-heading">
            {login ? (
              <>
                Come back
                <br /> to <em>yourself.</em>
              </>
            ) : (
              <>
                Make room
                <br /> for how you <em>feel.</em>
              </>
            )}
          </h1>
          <p className={styles.description}>
            {login
              ? "Take a breath. Your journal is here when you're ready to check in, reflect, and pick up where you left off."
              : "A quiet place to check in, untangle your thoughts, and notice the small things that help you feel more like yourself."}
          </p>
          <div className={styles.illustration} aria-hidden="true">
            <div className={styles.orbit} />
            <div className={styles.sun} />
            <div className={styles.note}>
              <span>A moment to pause</span>
              <p>
                {login ? (
                  <>
                    I can begin again,
                    <br /> right where I am.
                  </>
                ) : (
                  <>
                    Today, I&apos;m making
                    <br />a little room for myself.
                  </>
                )}
              </p>
              <div className={styles.noteLine} />
              <div className={styles.noteLine} />
              <Leaf size={28} strokeWidth={1.3} />
            </div>
            <span className={styles.smallLeaf}>
              <Leaf size={44} strokeWidth={1} />
            </span>
          </div>
          <div className={styles.reassurance}>
            <LockKeyhole size={18} strokeWidth={1.5} aria-hidden="true" />
            <p>
              Your own space. Your own pace.
              <br />
              <span>Start with a single thought. That&apos;s enough.</span>
            </p>
          </div>
        </section>
        <section className={styles.card} aria-labelledby={`${mode}-heading`}>
          <div className={styles.cardHeading}>
            <span className={styles.eyebrow}>
              {login ? "YOUR QUIET MOMENT" : "YOUR JOURNAL STARTS HERE"}
            </span>
            <h2 id={`${mode}-heading`}>{login ? "Welcome back." : "A fresh page awaits."}</h2>
            <p>
              {login
                ? "Sign in to your personal space."
                : "Create your private journaling account."}
            </p>
          </div>
          {children}
          <div className={styles.cardFooter}>
            {login ? "Your first page is waiting." : "Already started your journal?"}{" "}
            <Link href={login ? "/register" : "/login"}>
              {login ? "Create an account" : "Sign in"}
            </Link>
          </div>
        </section>
      </div>
      <footer className={styles.footer}>
        A moment of reflection. A little more understanding.
      </footer>
    </main>
  );
}
