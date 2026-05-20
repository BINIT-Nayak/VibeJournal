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

const navItems: Screen[] = ["home", "journal", "insights", "music", "profile"];

export function AppChrome({
  activeScreen,
  children,
  darkMode,
  onNewEntry,
  onScreenChange
}: AppChromeProps) {
  return (
    <main className={`${styles.shell} ${darkMode ? styles.darkShell : ""}`}>
      <section className={styles.appFrame}>
        {children}

        {activeScreen !== "new" && (
          <button className={styles.floatingButton} onClick={onNewEntry} type="button" aria-label="New entry">
            +
          </button>
        )}

        <nav className={styles.bottomNav} aria-label="Primary navigation">
          {navItems.map((screen) => (
            <button
              aria-current={activeScreen === screen ? "page" : undefined}
              className={activeScreen === screen ? styles.activeNavItem : ""}
              key={screen}
              onClick={() => onScreenChange(screen)}
              type="button"
            >
              <span>{navSymbol(screen)}</span>
              {screen[0].toUpperCase() + screen.slice(1)}
            </button>
          ))}
        </nav>
      </section>
    </main>
  );
}
