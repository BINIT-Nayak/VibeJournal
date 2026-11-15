import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { persistSettings, AccountChangedError } from "@/server/auth/settings-repository";
const owner = randomUUID(),
  other = randomUUID();
const email = `settings-${owner}@example.invalid`;
beforeAll(async () => {
  await prisma.user.create({
    data: {
      id: owner,
      email,
      passwordHash: "original",
      settings: { create: { aiConsent: false } },
    },
  });
  await prisma.user.create({ data: { id: other, email: `settings-${other}@example.invalid` } });
});
afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [owner, other] } } });
  await prisma.$disconnect();
});
describe("atomic account settings", () => {
  it("rejects a password verified before a newer reset and leaves consent unchanged", async () => {
    await prisma.user.update({ where: { id: owner }, data: { passwordHash: "reset-password" } });
    await expect(
      persistSettings(
        owner,
        { passwordHash: "stale-write" },
        { aiConsent: true },
        {},
        { passwordHash: "original", email }
      )
    ).rejects.toBeInstanceOf(AccountChangedError);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: owner } })).passwordHash).toBe(
      "reset-password"
    );
    expect(
      (await prisma.userSettings.findUniqueOrThrow({ where: { userId: owner } })).aiConsent
    ).toBe(false);
  });
  it("rolls back settings when an email uniqueness check fails", async () => {
    await expect(
      persistSettings(
        owner,
        { email: `settings-${other}@example.invalid` },
        { aiConsent: true },
        {},
        { passwordHash: "reset-password", email }
      )
    ).rejects.toMatchObject({ code: "P2002" });
    expect(
      (await prisma.userSettings.findUniqueOrThrow({ where: { userId: owner } })).aiConsent
    ).toBe(false);
  });
  it("commits password/preferences and revokes sessions and reset tokens for only the owner", async () => {
    for (const userId of [owner, other]) {
      await prisma.session.create({
        data: { userId, tokenHash: randomUUID(), expiresAt: new Date(Date.now() + 60000) },
      });
      await prisma.passwordResetToken.create({
        data: { userId, tokenHash: randomUUID(), expiresAt: new Date(Date.now() + 60000) },
      });
    }
    await persistSettings(
      owner,
      { passwordHash: "new-password" },
      { aiConsent: true },
      {},
      { passwordHash: "reset-password", email }
    );
    expect((await prisma.user.findUniqueOrThrow({ where: { id: owner } })).passwordHash).toBe(
      "new-password"
    );
    expect(
      (await prisma.userSettings.findUniqueOrThrow({ where: { userId: owner } })).aiConsent
    ).toBe(true);
    expect(await prisma.session.count({ where: { userId: owner } })).toBe(0);
    expect(await prisma.passwordResetToken.count({ where: { userId: owner } })).toBe(0);
    expect(await prisma.session.count({ where: { userId: other } })).toBe(1);
    expect(await prisma.passwordResetToken.count({ where: { userId: other } })).toBe(1);
  });
});
