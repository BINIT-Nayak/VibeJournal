import { moods } from "@/lib/mood";
import { journalTags } from "../../data";
import { EntryCard } from "../../components/EntryCard/EntryCard";
import { Heatmap } from "../../components/Heatmap/Heatmap";
import { PageTitle } from "../../components/SectionTitle/SectionTitle";
import type { EntriesProps, JournalFilterActions, JournalFilters } from "../../types";
import type { MoodKey } from "@/lib/mood";
import styles from "./JournalScreen.module.css";

type JournalScreenProps = EntriesProps & JournalFilters & JournalFilterActions;

export function JournalScreen({
  entries,
  moodFilter,
  query,
  tagFilter,
  onMoodFilter,
  onQuery,
  onTagFilter
}: JournalScreenProps) {
  return (
    <section className={styles.screen}>
      <PageTitle eyebrow="Journal" title="History" />
      <Heatmap entries={entries} />
      <div className={styles.filters}>
        <input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Search entries" />
        <select value={moodFilter} onChange={(event) => onMoodFilter(event.target.value as "all" | MoodKey)}>
          <option value="all">All moods</option>
          {moods.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
        </select>
        <select value={tagFilter} onChange={(event) => onTagFilter(event.target.value)}>
          <option value="all">All tags</option>
          {journalTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
        </select>
      </div>
      <div className={styles.timeline}>
        {entries.map((entry) => <EntryCard entry={entry} key={entry.id} />)}
      </div>
    </section>
  );
}
