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
  exerciseMinutes,
  isEditing,
  mood,
  note,
  photoNames,
  selectedTags,
  sleepHours,
  socialLevel,
  stress,
  voiceNote,
  onCustomTag,
  onEnergy,
  onExerciseMinutes,
  onMood,
  onNote,
  onPhotoNames,
  onSave,
  onSleepHours,
  onSocialLevel,
  onStress,
  onToggleTag,
  onVoiceNote,
}: NewEntryScreenProps) {
  return (
    <section className={styles.screen}>
      <header className={styles.topBar}>
        <div>
          <p className={styles.kicker}>{isEditing ? "Edit entry" : "New entry"}</p>
          <h1>
            {new Intl.DateTimeFormat("en", { month: "long", day: "numeric" }).format(new Date())}
          </h1>
        </div>
        <time>
          {new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date())}
        </time>
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

        <section className={styles.contextGrid}>
          <label>
            Sleep
            <input
              max="14"
              min="0"
              onChange={(event) => onSleepHours(Number(event.target.value))}
              step="0.5"
              type="number"
              value={sleepHours}
            />
            <span>hours</span>
          </label>
          <label>
            Movement
            <input
              max="240"
              min="0"
              onChange={(event) => onExerciseMinutes(Number(event.target.value))}
              step="5"
              type="number"
              value={exerciseMinutes}
            />
            <span>minutes</span>
          </label>
          <label>
            Social
            <input
              max="10"
              min="1"
              onChange={(event) => onSocialLevel(Number(event.target.value))}
              type="range"
              value={socialLevel}
            />
            <span>{socialLevel}/10</span>
          </label>
        </section>

        <section className={styles.editorBlock}>
          <div className={styles.promptChips}>
            {reflectionPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => onNote(note ? `${note}\n${prompt} ` : `${prompt} `)}
                type="button"
              >
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

        <section className={styles.voiceBlock}>
          <label htmlFor="voice-note">Voice note transcript</label>
          <textarea
            id="voice-note"
            onChange={(event) => onVoiceNote(event.target.value)}
            placeholder="Paste a voice-note transcript or dictate with your keyboard microphone."
            rows={3}
            value={voiceNote}
          />
        </section>

        <section className={styles.tagSelector}>
          <input
            value={customTag}
            onChange={(event) => onCustomTag(event.target.value)}
            placeholder="Search or add a tag"
          />
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
          <button onClick={() => onVoiceNote(voiceNote ? "" : "Voice note: ")} type="button">
            {voiceNote ? "Clear voice note" : "Add voice note"}
          </button>
          <label>
            Upload photo
            <input
              accept="image/*"
              multiple
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []).map((file) => file.name);
                onPhotoNames(files);
              }}
              type="file"
            />
          </label>
        </div>
        {photoNames.length > 0 ? (
          <div className={styles.attachmentList}>
            {photoNames.map((name) => (
              <span key={name}>{name}</span>
            ))}
          </div>
        ) : null}

        <button className={styles.primaryButton} type="submit">
          {isEditing ? "Update Entry" : "Save & Get Insight"}
        </button>
      </form>
    </section>
  );
}
