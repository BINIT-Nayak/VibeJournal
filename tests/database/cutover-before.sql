INSERT INTO "User" (id, email, "updatedAt") VALUES
  ('move-a', 'move-a@example.invalid', now()), ('move-b', 'move-b@example.invalid', now());
INSERT INTO "MoodEntry" (id, "userId", mood, energy, stress, valence, note, tags,
  "sleepHours", "exerciseMinutes", "socialLevel", "voiceNote", "photoNames",
  "archivedAt", "createdAt", "updatedAt") VALUES
  ('move-full', 'move-a', 'hopeful', 7, 3, 8, 'Keep my reflection', ARRAY['work','rest','work',' '],
    7.5, 25, 6, 'Keep transcript', ARRAY['photo.png'], '2026-01-03', '2026-01-01', '2026-01-02'),
  ('move-null', 'move-b', 'sad', 1, 10, 1, NULL, ARRAY['work'],
    NULL, NULL, NULL, NULL, ARRAY[]::TEXT[], NULL, '2026-02-01', '2026-02-02');
