import styles from "./StatCard.module.css";

export function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <article className={styles.statCard}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
