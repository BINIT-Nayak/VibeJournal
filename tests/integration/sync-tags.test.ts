import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { createEntry, getEntry } from "@/server/journal/service";
import { replayMutation } from "@/server/journal-sync/service";
const user = { id: randomUUID() };
beforeAll(async () => {
  await prisma.user.create({
    data: {
      id: user.id,
      email: `sync-${user.id}@example.invalid`,
      settings: { create: { aiConsent: false } },
    },
  });
});
afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: user.id } });
  await prisma.$disconnect();
});
it("preserves omitted tags in sync updates and clears them only for an explicit empty array", async () => {
  const created = await createEntry(
    user,
    { content: "Original reflection", moodScore: 6, tags: ["quiet"] },
    true
  );
  const mutation = {
    key: randomUUID(),
    entryId: created.id,
    kind: "update",
    expectedUpdatedAt: created.updatedAt,
    values: { content: "Updated reflection", moodScore: 7 },
  };
  const first = await replayMutation(user.id, mutation);
  expect((await getEntry(user, created.id, true)).tags).toEqual(["quiet"]);
  // A replay returns the committed receipt without applying another edit.
  expect(await replayMutation(user.id, mutation)).toEqual(first);
  await replayMutation(user.id, {
    ...mutation,
    key: randomUUID(),
    expectedUpdatedAt: first.updatedAt,
    values: { ...mutation.values, tags: [] },
  });
  const result = await getEntry(user, created.id, true);
  expect(result.content).toBe("Updated reflection");
  expect(result.tags).toEqual([]);
});
