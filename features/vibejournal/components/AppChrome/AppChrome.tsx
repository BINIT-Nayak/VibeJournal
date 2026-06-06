"use client";

import type { Screen } from "../../types";
import { navSymbol } from "../../utils";
import styles from "./AppChrome.module.css";

type AppChromeProps = {
  activeScreen: Screen;
  children: React.ReactNode;
  darkMode: boolean;
  onNewEntry: () => void;
  onScreenChange: (screen: Screen) => void;
};

const navItems: Array<{ label: string; screen: Screen }> = [
  { label: "Home", screen: "home" },
  { label: "Journal", screen: "journal" },
  { label: "Insights", screen: "insights" },
  { label: "Music", screen: "music" },
  { label: "Profile", screen: "profile" },
];

export function AppChrome({
  activeScreen,
  children,
  darkMode,
  onNewEntry,
  onScreenChange,
}: AppChromeProps) {
  return (
    <main className={`${styles.shell} ${darkMode ? styles.darkShell : ""}`}>
      <section className={styles.appFrame}>
        {children}

        {activeScreen !== "new" && (
          <button
            className={styles.floatingButton}
            onClick={onNewEntry}
            type="button"
            aria-label="New entry"
          >
            +
          </button>
        )}

        <nav className={styles.bottomNav} aria-label="Primary navigation">
          {navItems.map((item) => {
            const Icon = navSymbol(item.screen);

            return (
              <button
                aria-current={activeScreen === item.screen ? "page" : undefined}
                aria-label={item.label}
                className={activeScreen === item.screen ? styles.activeNavItem : ""}
                key={item.screen}
                onClick={() => onScreenChange(item.screen)}
                type="button"
              >
                <span aria-hidden="true">
                  <Icon size={16} strokeWidth={2.4} />
                </span>
                <strong>{item.label}</strong>
              </button>
            );
          })}
        </nav>
      </section>
    </main>
  );
}
