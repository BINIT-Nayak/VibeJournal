"use client";

import { useEffect, useRef, type MouseEvent } from "react";
import { Leaf, Plus, LockKeyhole } from "lucide-react";
import type { Screen } from "@/features/journal/types";
import { navSymbol } from "@/features/journal/utils";
import styles from "./AppChrome.module.css";

type AppChromeProps = {
  activeScreen: Screen;
  children: React.ReactNode;
  darkMode: boolean;
  onNewEntry: () => void;
  onScreenChange: (screen: Screen) => void;
};

const navItems: Array<{ label: string; screen: Screen }> = [
  { label: "Dashboard", screen: "home" },
  { label: "Journal", screen: "journal" },
  { label: "Analytics", screen: "insights" },
  { label: "Music", screen: "music" },
  { label: "Settings", screen: "profile" },
];

export function AppChrome({
  activeScreen,
  children,
  darkMode,
  onNewEntry,
  onScreenChange,
}: AppChromeProps) {
  const main = useRef<HTMLElement>(null);
  const previous = useRef(activeScreen);
  const title =
    activeScreen === "new"
      ? "New entry"
      : (navItems.find((item) => item.screen === activeScreen)?.label ?? "Dashboard");

  useEffect(() => {
    document.title = `${title} · VibeJournal`;
    if (previous.current !== activeScreen) {
      main.current?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "instant" });
      previous.current = activeScreen;
    }
  }, [activeScreen, title]);

  function navigate(event: MouseEvent<HTMLAnchorElement>, screen: Screen) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    onScreenChange(screen);
  }

  function navigation(label: string, className: string) {
    return (
      <nav className={className} aria-label={label}>
        <ul>
          {navItems.map((item) => {
            const Icon = navSymbol(item.screen);
            const current =
              activeScreen === item.screen || (activeScreen === "new" && item.screen === "journal");
            return (
              <li key={item.screen}>
                <a
                  href={
                    item.screen === "music"
                      ? "/music"
                      : item.screen === "insights"
                        ? "/analytics"
                        : item.screen === "journal"
                          ? "/journal"
                          : item.screen === "home"
                            ? "/dashboard"
                            : `/dashboard#${item.screen}`
                  }
                  aria-current={current ? "page" : undefined}
                  onClick={(event) => navigate(event, item.screen)}
                >
                  <Icon size={21} aria-hidden="true" />
                  <span>{item.label}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  return (
    <div className={`${styles.shell} ${darkMode ? styles.darkShell : ""}`}>
      <a
        className={styles.skipLink}
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          main.current?.focus();
        }}
      >
        Skip to content
      </a>
      <aside className={styles.sidebar} aria-label="Application sidebar">
        <a className={styles.brand} href="/dashboard" onClick={(event) => navigate(event, "home")}>
          <Leaf aria-hidden="true" />
          VibeJournal
        </a>
        <p className={styles.eyebrow}>YOUR PERSONAL SPACE</p>
        {navigation("Primary navigation", styles.desktopNav)}
        <div className={styles.sidebarNote}>
          <LockKeyhole size={18} aria-hidden="true" />
          <p>
            Your own space.
            <br />
            Your own pace.
          </p>
        </div>
      </aside>
      <div className={styles.workspace}>
        <header className={styles.header}>
          <a
            className={styles.mobileBrand}
            href="/dashboard"
            onClick={(event) => navigate(event, "home")}
          >
            <Leaf size={22} aria-hidden="true" />
            <span>VibeJournal</span>
          </a>
          <span className={styles.pageLabel}>{title}</span>
          <button
            className={styles.newEntry}
            onClick={onNewEntry}
            type="button"
            disabled={activeScreen === "new"}
          >
            <Plus size={18} aria-hidden="true" />
            New entry
          </button>
        </header>
        <main
          ref={main}
          id="main-content"
          tabIndex={-1}
          className={styles.appFrame}
          aria-label={title}
        >
          {children}
        </main>
        <footer className={styles.footer}>
          A little space to pause, reflect, and begin again.
        </footer>
      </div>
      {navigation("Mobile navigation", styles.mobileNav)}
    </div>
  );
}
