import type { JournalAnalysisView } from "./types";
import styles from "./JournalAnalysisPanel.module.css";

export function JournalAnalysisPanel({ result }: { result: JournalAnalysisView }) {
  return (
    <section className={styles.panel} aria-labelledby="ai-interpretation-heading">
      <p className={styles.label}>AI-GENERATED · OPTIONAL INTERPRETATION</p>
      <h2 id="ai-interpretation-heading">Another perspective on your reflection</h2>
      <p>
        These are AI suggestions, not facts you recorded or a medical diagnosis. AI can misread your
        experience. Keep what feels useful and disregard the rest.
      </p>
      {result.status === "available" ? (
        <>
          <h3>Possible emotions</h3>
          <p>
            Primary emotion suggested by AI: <strong>{result.analysis.primaryEmotion}</strong>
          </p>
          <ul className={styles.labels}>
            {result.analysis.emotions.map((emotion) => (
              <li key={emotion}>{emotion}</li>
            ))}
          </ul>
          <h3>Suggested themes</h3>
          {result.analysis.themes.length ? (
            <ul className={styles.labels}>
              {result.analysis.themes.map((theme) => (
                <li key={theme}>{theme}</li>
              ))}
            </ul>
          ) : (
            <p>No themes were suggested for this entry.</p>
          )}
          <h3>A reflection prompt, if useful</h3>
          <p className={styles.prompt}>{result.analysis.reflectionPrompt}</p>
        </>
      ) : (
        <p>
          {result.status === "stale"
            ? "This entry has changed since its AI interpretation was created. The earlier interpretation is hidden because it may no longer fit."
            : result.status === "unavailable"
              ? "The AI interpretation is unavailable right now. Your original reflection and recorded context are still here."
              : "No AI interpretation is saved for this entry. You can reflect on it as it is; AI analysis is optional and only runs for new entries when enabled in Settings."}
        </p>
      )}
    </section>
  );
}
