import "server-only";
import { z } from "zod";
import { readExportSnapshot } from "./repository";
import { openEntry, openTag, openValue } from "../encryption/content";
import { EncryptionError } from "../encryption/envelope";
import { validateJournalAnalysis } from "../journal-analysis/validation";

export async function exportUserData(actor: { id: string }) {
  if (!actor?.id) throw new Error("UNAUTHORIZED");
  const userId = actor.id;
  const snapshot = await readExportSnapshot(userId);
  if (!snapshot.account) throw new Error("UNAUTHORIZED");
  const journals = [];
  // Decrypt after releasing the DB transaction; KMS never holds snapshot locks.
  for (const row of snapshot.journals) {
    const entry = await openEntry(userId, row);
    journals.push({
      id: entry.id,
      title: entry.title,
      content: entry.content,
      voiceNote: entry.voiceNote,
      photoNames: entry.photoNames,
      prompt: entry.prompt,
      tracking: {
        moodScore: entry.moodScore,
        energyScore: entry.energyScore,
        sleepHours: entry.sleepHours,
        exercised: entry.exercised,
        socialScore: entry.socialScore,
        mood: entry.mood,
        stress: entry.stress,
        exerciseMinutes: entry.exerciseMinutes,
      },
      tags: entry.tags.map(({ tag, position }) => ({ id: tag.id, name: tag.name, position })),
      archivedAt: entry.archivedAt,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    });
  }
  const versions = new Map(snapshot.journals.map((row) => [row.id, +row.updatedAt]));
  const aiAnalyses = [];
  for (const row of snapshot.analyses) {
    if (row.userId !== userId || !versions.has(row.journalEntryId)) throw new EncryptionError();
    try {
      const privateFields = z
        .object({ themes: z.array(z.string()), reflectionPrompt: z.string() })
        .strict()
        .parse(
          await openValue(
            userId,
            "analysis",
            row.journalEntryId,
            row.privatePayload,
            row.sourceUpdatedAt.toISOString()
          )
        );
      const analysis = validateJournalAnalysis({
        ...privateFields,
        primaryEmotion: row.primaryEmotion,
        emotions: row.emotions,
        sentimentScore: row.sentimentScore,
        estimatedEnergy: row.estimatedEnergy,
        confidence: row.confidence,
      });
      aiAnalyses.push({
        id: row.id,
        journalEntryId: row.journalEntryId,
        createdAt: row.createdAt,
        sourceUpdatedAt: row.sourceUpdatedAt,
        stale: versions.get(row.journalEntryId) !== +row.sourceUpdatedAt,
        ...analysis,
      });
    } catch {
      throw new EncryptionError();
    }
  }
  const tags = [];
  for (const tag of snapshot.tags)
    tags.push({ id: tag.id, name: await openTag(userId, tag.id, tag.privateLabel) });
  const settings = snapshot.settings;
  return {
    format: "vibejournal-data-export",
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    account: snapshot.account,
    settings: settings
      ? {
          aiConsent: settings.aiConsent,
          darkMode: settings.darkMode,
          privacyAcknowledged: settings.privacyAcknowledged,
          reminderEnabled: settings.reminderEnabled,
          reminderTime: settings.reminderTime,
          spotifyConnected: settings.spotifyConnected,
          createdAt: settings.createdAt,
          updatedAt: settings.updatedAt,
        }
      : null,
    musicPreferences: settings
      ? {
          favoriteGenres: settings.favoriteGenres,
          dislikedGenres: settings.dislikedGenres,
          preferredLanguages: settings.preferredLanguages,
          allowExplicit: settings.allowExplicit,
        }
      : null,
    journals,
    tags,
    aiAnalyses,
    musicHistory: snapshot.musicHistory,
    securityAuditEvents: snapshot.securityAuditEvents,
  };
}
