import { type CSSProperties } from "react";
import { useMemo, useState } from "react";
import { moodStations } from "../../data";
import { PanelTitle } from "../../components/SectionTitle/SectionTitle";
import type { MoodMeta, PlaylistSuggestion } from "../../types";
import styles from "./MusicScreen.module.css";

type MusicScreenProps = {
  latestMood: MoodMeta;
  playlist: PlaylistSuggestion;
};

export function MusicScreen({ latestMood, playlist }: MusicScreenProps) {
  const [intent, setIntent] = useState("I feel overwhelmed but hopeful. Make me something steady and warm.");
  const [station, setStation] = useState(latestMood.label);
  const audioProfile = useMemo(() => mapIntentToAudioProfile(intent, latestMood.label), [intent, latestMood.label]);
  const spotifyQuery = `${playlist.query} ${station} ${audioProfile.searchTone}`.trim();

  return (
    <section className={styles.screen}>
      <div className={styles.musicBanner} style={{ "--mood-color": latestMood.color } as CSSProperties}>
        <span>{latestMood.symbol}</span>
        <div>
          <p className={styles.kicker}>Current mood</p>
          <h1>{latestMood.label}</h1>
        </div>
      </div>
      <section className={styles.generatePanel}>
        <textarea
          onChange={(event) => setIntent(event.target.value)}
          placeholder="I feel overwhelmed but hopeful. Make me something steady and warm."
          value={intent}
        />
        <a href={`https://open.spotify.com/search/${encodeURIComponent(spotifyQuery)}`} target="_blank" rel="noreferrer">
          Play for my mood
        </a>
      </section>
      <section className={styles.audioProfile}>
        <span>Valence {audioProfile.valence}</span>
        <span>Energy {audioProfile.energy}</span>
        <span>Tempo {audioProfile.tempo} bpm</span>
        <span>Danceability {audioProfile.danceability}</span>
      </section>
      <PanelTitle eyebrow="Saved" title="Playlists" />
      <div className={styles.playlistGrid}>
        {[playlist.title, "Morning Reset", "After Work Exhale", "Deep Focus"].map((title, index) => (
          <article className={styles.playlistCard} key={title}>
            <div>{index + 1}</div>
            <strong>{title}</strong>
            <span>{index === 0 ? playlist.description : "A saved mood mix ready to open in Spotify."}</span>
          </article>
        ))}
      </div>
      <PanelTitle eyebrow="Mood Radio" title="Stations" />
      <div className={styles.stationRow}>
        {moodStations.map((item) => (
          <button className={station === item ? styles.activeStation : ""} key={item} onClick={() => setStation(item)} type="button">
            {item}
          </button>
        ))}
      </div>
      <div className={styles.miniPlayer}>
        <div />
        <span>Now cued: {playlist.title}</span>
        <a href={`https://open.spotify.com/search/${encodeURIComponent(spotifyQuery)}`} target="_blank" rel="noreferrer">Open in Spotify</a>
      </div>
    </section>
  );
}

function mapIntentToAudioProfile(intent: string, mood: string) {
  const text = `${intent} ${mood}`.toLowerCase();
  const isLow = /tired|sad|low|heavy|drained|sleepy/.test(text);
  const isTense = /angry|anxious|overwhelmed|stress|pressure/.test(text);
  const isBright = /joy|happy|hopeful|grateful|brave/.test(text);

  if (isTense) {
    return { valence: "0.35", energy: "0.72", tempo: 132, danceability: "0.58", searchTone: "cathartic release" };
  }

  if (isLow) {
    return { valence: "0.28", energy: "0.32", tempo: 76, danceability: "0.34", searchTone: "soft recovery acoustic" };
  }

  if (isBright) {
    return { valence: "0.78", energy: "0.68", tempo: 118, danceability: "0.72", searchTone: "bright uplifting" };
  }

  return { valence: "0.58", energy: "0.50", tempo: 96, danceability: "0.55", searchTone: "balanced mellow focus" };
}
