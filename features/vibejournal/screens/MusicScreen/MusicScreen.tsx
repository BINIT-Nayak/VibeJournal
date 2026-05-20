import { type CSSProperties } from "react";
import { moodStations } from "../../data";
import { PanelTitle } from "../../components/SectionTitle/SectionTitle";
import type { MoodMeta, PlaylistSuggestion } from "../../types";
import styles from "./MusicScreen.module.css";

type MusicScreenProps = {
  latestMood: MoodMeta;
  playlist: PlaylistSuggestion;
};

export function MusicScreen({ latestMood, playlist }: MusicScreenProps) {
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
        <textarea placeholder="I feel overwhelmed but hopeful. Make me something steady and warm." />
        <a href={`https://open.spotify.com/search/${encodeURIComponent(playlist.query)}`} target="_blank" rel="noreferrer">
          Generate Playlist
        </a>
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
        {moodStations.map((station) => <button key={station} type="button">{station}</button>)}
      </div>
      <div className={styles.miniPlayer}>
        <div />
        <span>Now cued: {playlist.title}</span>
        <button type="button">Open in Spotify</button>
      </div>
    </section>
  );
}
