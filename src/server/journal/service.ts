import "server-only";

import type { ClientUser } from "@/features/auth/types";
import {
  journalCreateSchema,
  journalUpdateSchema,
  normalizeJournalInput,
} from "@/features/journal/schemas";
import { serializeEntry } from "@/server/api";
import * as repository from "./repository";

export class JournalNotFoundError extends Error {
  constructor() {
    super("Entry not found.");
  }
}

// The actor must come from server authentication, never request JSON or query params.
type Actor = Pick<ClientUser, "id">;
function ownerId(actor: Actor) {
  if (!actor?.id) throw new Error("UNAUTHORIZED");
  return actor.id;
}

export async function createEntry(actor: Actor, input: unknown) {
  const userId = ownerId(actor);
  const { tags = [], ...fields } = journalCreateSchema.parse(normalizeJournalInput(input));
  return serializeEntry(await repository.create(userId, { ...fields, legacyTags: tags }, tags));
}

export async function getEntry(actor: Actor, id: string) {
  const entry = await repository.findByOwner(ownerId(actor), id);
  // Missing and foreign-owned entries intentionally have the same outcome.
  if (!entry) throw new JournalNotFoundError();
  return serializeEntry(entry);
}

export async function listEntries(actor: Actor) {
  return (await repository.listByOwner(ownerId(actor))).map(serializeEntry);
}

export async function updateEntry(actor: Actor, id: string, input: unknown) {
  const userId = ownerId(actor);
  const { tags, archived, ...fields } = journalUpdateSchema.parse(normalizeJournalInput(input));
  const entry = await repository.updateByOwner(
    userId,
    id,
    {
      ...fields,
      legacyTags: tags,
      archivedAt: archived === undefined ? undefined : archived ? new Date() : null,
    },
    tags
  );
  if (!entry) throw new JournalNotFoundError();
  return serializeEntry(entry);
}

export async function deleteEntry(actor: Actor, id: string) {
  const result = await repository.deleteByOwner(ownerId(actor), id);
  if (result.count === 0) throw new JournalNotFoundError();
}

export async function deleteAllEntries(actor: Actor) {
  await repository.deleteAllByOwner(ownerId(actor));
}
