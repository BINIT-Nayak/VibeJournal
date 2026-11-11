import Link from "next/link";

export default function EntryNotFound() {
  return (
    <section>
      <h1>Entry not found</h1>
      <p>This entry is unavailable. Return to your journal to see your reflections.</p>
      <Link href="/journal">Back to journal</Link>
    </section>
  );
}
