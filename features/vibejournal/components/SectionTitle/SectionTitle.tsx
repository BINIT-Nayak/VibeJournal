import styles from "./SectionTitle.module.css";

export function PageTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <header className={styles.pageTitle}>
      <p className={styles.kicker}>{eyebrow}</p>
      <h1>{title}</h1>
    </header>
  );
}

export function PanelTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className={styles.panelHeader}>
      <div>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h2>{title}</h2>
      </div>
    </div>
  );
}
