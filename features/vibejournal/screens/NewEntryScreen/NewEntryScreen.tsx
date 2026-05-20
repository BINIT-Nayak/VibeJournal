import { type CSSProperties } from "react";
import { moods } from "@/lib/mood";
import { journalTags, reflectionPrompts } from "../../data";
import { Slider } from "../../components/Slider/Slider";
import type { EntryFormActions, EntryFormState } from "../../types";
import styles from "./NewEntryScreen.module.css";

type NewEntryScreenProps = EntryFormState & EntryFormActions;

export function NewEntryScreen({
  customTag,
  energy,
  mood,
  note,
  selectedTags,
  stress,
  onCustomTag,
  onEnergy,
  onMood,
  onNote,
  onSave,
  onStress,
  onToggleTag
}: NewEntryScreenProps) {
  return (
    <section className={styles.screen}>
      <header className={styles.topBar}>
        <div>
          <p className={styles.kicker}>New entry</p>
          <h1>{new Intl.DateTimeFormat("en", { month: "long", day: "numeric" }).format(new Date())}</h1>
        </div>
        <time>{new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date())}</time>
      </header>

      <form className={styles.entryForm} onSubmit={onSave}>
        <div className={styles.emojiScroller}>
          {moods.map((item) => (
            <button
              className={mood === item.key ? styles.selectedEmoji : ""}
              key={item.key}
              onClick={() => onMood(item.key)}
              style={{ "--mood-color": item.color } as CSSProperties}
              type="button"
            >
              <span>{item.symbol}</span>
              {item.label}
            </button>
          ))}
        </div>

        <div className={styles.sliderCard}>
          <Slider label="Energy" value={energy} onChange={onEnergy} />
          <Slider label="Stress" value={stress} onChange={onStress} />
        </div>

        <section className={styles.editorBlock}>
          <div className={styles.promptChips}>
            {reflectionPrompts.map((prompt) => (
              <button key={prompt} onClick={() => onNote(note ? `${note}\n${prompt} ` : `${prompt} `)} type="button">
                {prompt}
              </button>
            ))}
          </div>
          <textarea
            aria-label="Journal entry"
            onChange={(event) => onNote(event.target.value)}
            placeholder="Write your thoughts here..."
            rows={8}
            value={note}
          />
        </section>

        <section className={styles.tagSelector}>
          <input value={customTag} onChange={(event) => onCustomTag(event.target.value)} placeholder="Search or add a tag" />
          <div>
            {journalTags.map((tag) => (
              <button
                className={selectedTags.includes(tag) ? styles.selectedTag : ""}
                key={tag}
                onClick={() => onToggleTag(tag)}
                type="button"
              >
                {tag}
              </button>
            ))}
          </div>
        </section>

        <div className={styles.mediaActions}>
          <button type="button">Record voice</button>
          <button type="button">Upload photo</button>
        </div>

        <button className={styles.primaryButton} type="submit">Save & Get Insight</button>
      </form>
    </section>
  );
}
