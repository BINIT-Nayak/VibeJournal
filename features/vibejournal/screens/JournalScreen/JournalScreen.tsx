import { moods } from "@/lib/mood";
import { journalTags } from "../../data";
import { EntryCard } from "../../components/EntryCard/EntryCard";
import { Heatmap } from "../../components/Heatmap/Heatmap";
import { PageTitle } from "../../components/SectionTitle/SectionTitle";
import type { EntriesProps, JournalFilterActions, JournalFilters } from "../../types";
import type { MoodKey } from "@/lib/mood";
import styles from "./JournalScreen.module.css";

type JournalScreenProps = EntriesProps & JournalFilters & JournalFilterActions;
type JournalActions = {
  onArchiveEntry: (entry: EntriesProps["entries"][number]) => void;
  onDeleteEntry: (entryId: string) => void;
  onEditEntry: (entry: EntriesProps["entries"][number]) => void;
  onSelectEntry: (entryId: string) => void;
  selectedEntry: EntriesProps["entries"][number] | null;
};

export function JournalScreen({
  entries,
  moodFilter,
  query,
  selectedEntry,
  tagFilter,
  onArchiveEntry,
  onDeleteEntry,
  onEditEntry,
  onMoodFilter,
  onQuery,
  onSelectEntry,
  onTagFilter,
}: JournalScreenProps & JournalActions) {
  return (
    <section className={styles.screen}>
      <PageTitle eyebrow="Journal" title="History" />
      <Heatmap entries={entries} />
      <div className={styles.filters}>
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Search entries"
        />
        <select
          value={moodFilter}
          onChange={(event) => onMoodFilter(event.target.value as "all" | MoodKey)}
        >
          <option value="all">All moods</option>
          {moods.map((item) => (
            <option key={item.key} value={item.key}>
              {item.label}
            </option>
          ))}
        </select>
        <select value={tagFilter} onChange={(event) => onTagFilter(event.target.value)}>
          <option value="all">All tags</option>
          {journalTags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
      </div>
      {selectedEntry ? (
        <article className={styles.entryDetail}>
          <div>
            <span>Selected entry</span>
            <h2>
              {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(
                new Date(selectedEntry.createdAt)
              )}
            </h2>
          </div>
          <p>{selectedEntry.note}</p>
          {selectedEntry.voiceNote ? <p>{selectedEntry.voiceNote}</p> : null}
          <div>
            <button onClick={() => onEditEntry(selectedEntry)} type="button">
              Edit
            </button>
            <button onClick={() => onArchiveEntry(selectedEntry)} type="button">
              {selectedEntry.archivedAt ? "Restore" : "Archive"}
            </button>
            <button onClick={() => onDeleteEntry(selectedEntry.id)} type="button">
              Delete
            </button>
          </div>
        </article>
      ) : null}
      <div className={styles.timeline}>
        {entries.map((entry) => (
          <EntryCard
            entry={entry}
            key={entry.id}
            onArchive={onArchiveEntry}
            onDelete={onDeleteEntry}
            onEdit={onEditEntry}
            onView={onSelectEntry}
          />
        ))}
      </div>
    </section>
  );
}
