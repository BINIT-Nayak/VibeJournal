import "server-only";

import type { ClientUser } from "@/features/auth/types";
import {
  journalCreateSchema,
  journalUpdateSchema,
  normalizeJournalInput,
} from "@/features/journal/schemas";
import { serializeEntry } from "@/server/api";
import type { JournalEntryDto, JournalHistoryResponse } from "@/features/journal/api-types";
import { historyQuerySchema, decodeCursor, encodeCursor } from "./pagination";
import * as repository from "./repository";
import { analyzeCreatedEntry } from "@/server/journal-analysis/after-create";

export class JournalNotFoundError extends Error {
  constructor() {
    super("Entry not found.");
  }
}

export class JournalConflictError extends Error {
  constructor() {
    super(
      "This entry has changed since you opened it. Your draft is still here. Review the latest version before saving again."
    );
  }
}

// The actor must come from server authentication, never request JSON or query params.
type Actor = Pick<ClientUser, "id">;
function ownerId(actor: Actor) {
  if (!actor?.id) throw new Error("UNAUTHORIZED");
  return actor.id;
}

export async function createEntry(actor: Actor, input: unknown, canonical = false) {
  const userId = ownerId(actor);
  const { tags = [], ...fields } = journalCreateSchema.parse(normalizeJournalInput(input));
  const entry = await repository.create(userId, { ...fields, legacyTags: tags }, tags);
  const analysisStatus = await analyzeCreatedEntry(userId, entry.id);
  return { ...(canonical ? toJournalDto(entry) : serializeEntry(entry)), analysisStatus };
}

export function getEntry(actor: Actor, id: string, canonical: true): Promise<JournalEntryDto>;
export function getEntry(
  actor: Actor,
  id: string,
  canonical?: false
): Promise<ReturnType<typeof serializeEntry>>;
export async function getEntry(actor: Actor, id: string, canonical = false) {
  const entry = await repository.findByOwner(ownerId(actor), id);
  // Missing and foreign-owned entries intentionally have the same outcome.
  if (!entry) throw new JournalNotFoundError();
  return canonical ? toJournalDto(entry) : serializeEntry(entry);
}

export async function listEntries(actor: Actor) {
  return (await repository.listByOwner(ownerId(actor))).map(serializeEntry);
}

export async function updateEntry(actor: Actor, id: string, input: unknown, canonical = false) {
  const userId = ownerId(actor);
  const existing = await repository.findByOwner(userId, id);
  if (!existing) throw new JournalNotFoundError();
  const { tags, archived, expectedUpdatedAt, ...fields } = journalUpdateSchema.parse(
    normalizeJournalInput(input)
  );
  const expected = new Date(expectedUpdatedAt);
  if (existing.updatedAt.getTime() !== expected.getTime()) throw new JournalConflictError();
  // Always advance the token, including two updates in the same millisecond.
  const updatedAt = new Date(Math.max(Date.now(), existing.updatedAt.getTime() + 1));
  const entry = await repository.updateByOwner(
    userId,
    id,
    expected,
    {
      ...fields,
      updatedAt,
      legacyTags: tags,
      archivedAt: archived === undefined ? undefined : archived ? new Date() : null,
    },
    tags
  );
  if (!entry) {
    if (!(await repository.findByOwner(userId, id))) throw new JournalNotFoundError();
    throw new JournalConflictError();
  }
  return canonical ? toJournalDto(entry) : serializeEntry(entry);
}

export async function deleteEntry(actor: Actor, id: string) {
  const result = await repository.deleteByOwner(ownerId(actor), id);
  if (result.count === 0) throw new JournalNotFoundError();
}

export async function deleteAllEntries(actor: Actor) {
  await repository.deleteAllByOwner(ownerId(actor));
}

export async function listEntryPage(actor: Actor, query: unknown) {
  const userId = ownerId(actor);
  const { limit, cursor } = historyQuerySchema.parse(query);
  const rows = await repository.pageByOwner(
    userId,
    limit + 1,
    cursor ? decodeCursor(cursor, userId) : undefined
  );
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  return {
    entries: page.map(toJournalDto),
    pageInfo: { hasMore, nextCursor: hasMore ? encodeCursor(userId, page[page.length - 1]) : null },
  } satisfies JournalHistoryResponse;
}

function toJournalDto(entry: repository.JournalEntryWithTags): JournalEntryDto {
  return {
    ...serializeEntry(entry),
    updatedAt: entry.updatedAt.toISOString(),
    title: entry.title,
    content: entry.content,
    moodScore: entry.moodScore,
    energyScore: entry.energyScore,
    sleepHours: entry.sleepHours,
    exercised: entry.exercised,
    socialScore: entry.socialScore,
  };
}
