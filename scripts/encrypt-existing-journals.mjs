import nextEnv from "@next/env";
import assert from "node:assert/strict";
import { load } from "./encryption-loader.mjs";
nextEnv.loadEnvConfig(process.cwd());
const { prisma } = load("src/server/db.ts");
const { sealJournal, openJournal, protectTag, openTag, sealValue, openValue } = load(
  "src/server/encryption/content.ts"
);
try {
  if (await prisma.moodEntry.count()) throw new Error("Legacy data requires migration first");
  const counts = { journals: 0, tags: 0, analyses: 0, receipts: 0 };
  for (;;) {
    const rows = await prisma.journalEntry.findMany({ where: { privatePayload: null }, take: 100 });
    if (!rows.length) break;
    for (const row of rows) {
      const sealed = await sealJournal(row.userId, row.id, 1, row);
      const opened = await openJournal(row.userId, { ...row, ...sealed });
      for (const field of ["title", "content", "voiceNote", "photoNames", "prompt"])
        assert.deepEqual(opened[field], row[field]);
      const changed = await prisma.journalEntry.updateMany({
        where: { id: row.id, userId: row.userId, updatedAt: row.updatedAt, privatePayload: null },
        data: { ...sealed, updatedAt: row.updatedAt },
      });
      if (!changed.count) throw new Error("Concurrent modification; rerun backfill");
      counts.journals++;
    }
  }
  for (;;) {
    const rows = await prisma.tag.findMany({ where: { privateLabel: null }, take: 100 });
    if (!rows.length) break;
    for (const row of rows) {
      const sealed = await protectTag(row.userId, row.name, row.id);
      assert.equal(await openTag(row.userId, row.id, sealed.privateLabel), row.name);
      const changed = await prisma.tag.updateMany({
        where: { id: row.id, name: row.name, privateLabel: null },
        data: sealed,
      });
      if (!changed.count) throw new Error("Concurrent modification");
      counts.tags++;
    }
  }
  for (;;) {
    const rows = await prisma.journalAnalysis.findMany({
      where: { privatePayload: null },
      take: 100,
    });
    if (!rows.length) break;
    for (const row of rows) {
      const value = { themes: row.themes, reflectionPrompt: row.reflectionPrompt };
      const revision = row.sourceUpdatedAt.toISOString();
      const privatePayload = await sealValue(
        row.userId,
        "analysis",
        row.journalEntryId,
        value,
        revision
      );
      assert.deepEqual(
        await openValue(row.userId, "analysis", row.journalEntryId, privatePayload, revision),
        value
      );
      const changed = await prisma.journalAnalysis.updateMany({
        where: { id: row.id, privatePayload: null, sourceUpdatedAt: row.sourceUpdatedAt },
        data: { privatePayload, themes: [], reflectionPrompt: "" },
      });
      if (!changed.count) throw new Error("Concurrent modification");
      counts.analyses++;
    }
  }
  for (;;) {
    const rows = await prisma.journalMutationReceipt.findMany({
      where: { NOT: { payloadHash: { startsWith: "e1." } } },
      take: 100,
    });
    if (!rows.length) break;
    for (const row of rows) {
      const payloadHash = await sealValue(row.userId, "receipt", row.key, row.payloadHash);
      assert.equal(await openValue(row.userId, "receipt", row.key, payloadHash), row.payloadHash);
      const changed = await prisma.journalMutationReceipt.updateMany({
        where: { userId: row.userId, key: row.key, payloadHash: row.payloadHash },
        data: { payloadHash },
      });
      if (!changed.count) throw new Error("Concurrent modification");
      counts.receipts++;
    }
  }
  for (const [table, constraint] of [
    ["JournalEntry", "JournalEntry_private_storage_check"],
    ["Tag", "Tag_private_storage_check"],
    ["JournalAnalysis", "JournalAnalysis_private_storage_check"],
    ["JournalMutationReceipt", "JournalMutationReceipt_private_hash_check"],
  ])
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "' + table + '" VALIDATE CONSTRAINT "' + constraint + '"'
    );
  console.log("Encrypted historical records and validated storage constraints:", counts);
} catch {
  console.error(
    "Encryption backfill failed safely. Check key configuration and migration state, then rerun. No sensitive error details were logged."
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
