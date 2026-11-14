"use client";

import Link from "next/link";
import { LocalEntries } from "../../offline/LocalEntries";
import { useRef, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { JournalHistoryResponse } from "../../api-types";
import { moods } from "../../mood";
import styles from "./JournalHistory.module.css";

export function JournalHistory({ userId, deleted = false }: { userId: string; deleted?: boolean }) {
  const [cursors, setCursors] = useState<Array<string | null>>([null]);
  const [page, setPage] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const cursor = cursors[page];
  const { data, error, isPending, isFetching, refetch } = useQuery({
    queryKey: ["journal-history", userId, cursor],
    queryFn: async ({ signal }): Promise<JournalHistoryResponse> => {
      const params = new URLSearchParams({ limit: "20" });
      if (cursor) params.set("cursor", cursor);
      const response = await fetch(`/api/journal?${params}`, { signal, cache: "no-store" });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? "Your session has expired. Please sign in again."
            : (result?.error?.message ?? "Couldn't load your journal.")
        );
      return result;
    },
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
  useEffect(() => {
    if (page > 0) heading.current?.focus();
  }, [page]);
  return (
    <section className={styles.history}>
      {deleted && <p role="status">Your entry was deleted.</p>}
      <header className={styles.header}>
        <div>
          <p>YOUR PERSONAL SPACE</p>
          <h1 ref={heading} tabIndex={-1}>
            Journal
          </h1>
          <p>A place to revisit your everyday reflections.</p>
        </div>
        <Link className={styles.primary} href="/journal/new">
          Write an entry
        </Link>
      </header>
      <LocalEntries userId={userId} />
      {isPending ? (
        <div className={styles.state} role="status">
          Loading your reflections…
        </div>
      ) : error ? (
        <div className={styles.state} role="alert">
          <h2>We couldn&apos;t load your journal</h2>
          <p>{error.message}</p>
          <button type="button" disabled={isFetching} onClick={() => void refetch()}>
            {isFetching ? "Retrying…" : "Try again"}
          </button>
          <Link href="/login">Sign in</Link>
        </div>
      ) : (
        data && (
          <>
            {data.entries.length === 0 ? (
              <div className={styles.state}>
                <h2>{page === 0 ? "Your first page is waiting" : "No more reflections here"}</h2>
                <p>
                  {page === 0
                    ? "Start with a few words about today. There's no right way to begin."
                    : "Entries on this page may have been removed. You can return to your newer reflections."}
                </p>
                {page === 0 && (
                  <Link className={styles.primary} href="/journal/new">
                    Write your first entry
                  </Link>
                )}
              </div>
            ) : (
              <ul className={styles.entries}>
                {data.entries.map((entry) => {
                  const mood = moods.find((item) => item.key === entry.mood);
                  const title = entry.title || entry.content.slice(0, 100) || "Untitled reflection";
                  return (
                    <li key={entry.id}>
                      <article className={styles.card}>
                        <div className={styles.meta}>
                          <time dateTime={entry.createdAt}>
                            {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
                              new Date(entry.createdAt)
                            )}
                          </time>
                          <span>
                            <span aria-hidden="true">{mood?.symbol ?? "😐"}</span> Mood{" "}
                            {entry.moodScore}/10{entry.archivedAt ? " · Archived" : ""}
                          </span>
                        </div>
                        <h2>
                          <Link href={`/journal/${entry.id}`}>{title}</Link>
                        </h2>
                        {entry.title && <p className={styles.preview}>{entry.content}</p>}
                        {entry.tags.length > 0 && (
                          <ul className={styles.tags} aria-label="Tags">
                            {entry.tags.map((tag) => (
                              <li key={tag}>{tag}</li>
                            ))}
                          </ul>
                        )}
                        <div className={styles.actions}>
                          <Link href={`/journal/${entry.id}`} aria-label={`View ${title}`}>
                            View entry
                          </Link>
                          <Link href={`/journal/${entry.id}/edit`} aria-label={`Edit ${title}`}>
                            Edit
                          </Link>
                        </div>
                      </article>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className={styles.summary} role="status">
              Page {page + 1} · {data.entries.length}{" "}
              {data.entries.length === 1 ? "entry" : "entries"}
              {isFetching ? " · Refreshing…" : !data.pageInfo.hasMore ? " · End of history" : ""}
            </p>
          </>
        )
      )}
      <nav className={styles.pagination} aria-label="Journal history pages">
        <button
          type="button"
          disabled={page === 0 || isFetching}
          onClick={() => {
            setPage((current) => current - 1);
            heading.current?.focus();
          }}
        >
          Newer entries
        </button>
        <button
          type="button"
          disabled={isFetching || Boolean(error) || !data?.pageInfo.nextCursor}
          onClick={() => {
            if (!data?.pageInfo.nextCursor) return;
            setCursors((current) => [...current.slice(0, page + 1), data.pageInfo.nextCursor]);
            setPage((current) => current + 1);
          }}
        >
          Older entries
        </button>
      </nav>
    </section>
  );
}
