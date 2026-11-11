import "server-only";
import { z } from "zod";

export const historyQuerySchema = z.object({
  limit: z
    .string()
    .regex(/^[1-9]\d*$/)
    .transform(Number)
    .pipe(z.number().int().max(100))
    .default(20),
  cursor: z.string().min(1).max(1024).optional(),
});
const cursorSchema = z.object({
  v: z.literal(1),
  userId: z.string().min(1),
  id: z.string().min(1).max(128),
  createdAt: z.iso.datetime(),
});
export class InvalidJournalCursorError extends Error {
  constructor() {
    super("Invalid journal cursor.");
  }
}
export function decodeCursor(cursor: string, userId: string) {
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error();
    const parsed = cursorSchema.parse(
      JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"))
    );
    if (parsed.userId !== userId) throw new Error();
    return { id: parsed.id, createdAt: new Date(parsed.createdAt) };
  } catch {
    throw new InvalidJournalCursorError();
  }
}
export function encodeCursor(userId: string, entry: { id: string; createdAt: Date }) {
  return Buffer.from(
    JSON.stringify({ v: 1, userId, id: entry.id, createdAt: entry.createdAt.toISOString() })
  ).toString("base64url");
}
