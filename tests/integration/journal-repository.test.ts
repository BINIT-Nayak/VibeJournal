import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import * as repository from "@/server/journal/repository";
const owner = randomUUID(),
  other = randomUUID();
beforeAll(async () => {
  await prisma.user.createMany({
    data: [owner, other].map((id) => ({ id, email: `repo-${id}@example.invalid` })),
  });
});
afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [owner, other] } } });
  await prisma.$disconnect();
});
function create(userId = owner, createdAt = new Date()) {
  // Repository tests treat encrypted content as opaque; crypto correctness has its own unit suite.
  return repository.create(
    userId,
    {
      id: randomUUID(),
      content: "",
      privatePayload: "e1.repository-test-fixture",
      contentRevision: 1,
      moodScore: 6,
      createdAt,
    },
    []
  );
}
describe("journal persistence against PostgreSQL", () => {
  it("does not let another owner read, update, or delete an entry", async () => {
    const entry = await create();
    expect(await repository.findByOwner(other, entry.id)).toBeNull();
    expect(
      await repository.updateByOwner(other, entry.id, entry.updatedAt, { moodScore: 9 })
    ).toBeNull();
    expect((await repository.deleteByOwner(other, entry.id)).count).toBe(0);
    expect((await repository.findByOwner(owner, entry.id))?.moodScore).toBe(6);
  });
  it("rejects a stale version while preserving the newer saved values", async () => {
    const entry = await create();
    const newer = new Date(entry.updatedAt.getTime() + 1000);
    await repository.updateByOwner(owner, entry.id, entry.updatedAt, {
      moodScore: 8,
      updatedAt: newer,
    });
    expect(
      await repository.updateByOwner(owner, entry.id, entry.updatedAt, { moodScore: 2 })
    ).toBeNull();
    expect((await repository.findByOwner(owner, entry.id))?.moodScore).toBe(8);
  });
  it("paginates tied timestamps without duplicates or another owner’s entries", async () => {
    const timestamp = new Date("2026-01-01T00:00:00Z");
    const entries = await Promise.all([
      create(other, timestamp),
      create(other, timestamp),
      create(other, timestamp),
    ]);
    const first = await repository.pageByOwner(other, 2);
    const second = await repository.pageByOwner(other, 2, {
      id: first[1].id,
      createdAt: first[1].createdAt,
    });
    expect(first).toHaveLength(2);
    expect(second).toHaveLength(1);
    expect(new Set([...first, ...second].map((entry) => entry.id))).toEqual(
      new Set(entries.map((entry) => entry.id))
    );
  });
});
