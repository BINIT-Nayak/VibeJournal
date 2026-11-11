import "server-only";

import { entryInclude, setEntryTags } from "@/server/journal/entries";

import { requireUser } from "@/server/auth/session";
import { jsonError } from "@/lib/http";
import { serializeEntry } from "@/server/api";
import { journalCreateSchema, normalizeJournalInput } from "@/features/journal/schemas";
import { prisma } from "@/server/db";

export async function GET() {
  try {
    const user = await requireUser();
    const entries = await prisma.journalEntry.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: entryInclude,
    });

    return Response.json({ entries: entries.map(serializeEntry) });
  } catch {
    return jsonError("Please log in to view entries.", 401);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const parsed = journalCreateSchema.safeParse(normalizeJournalInput(await request.json()));
    if (!parsed.success)
      return Response.json(
        { error: "Check the journal fields.", issues: parsed.error.issues },
        { status: 400 }
      );
    const { tags, ...fields } = parsed.data;
    const entry = await prisma.$transaction(async (tx) => {
      const saved = await tx.journalEntry.create({
        data: { ...fields, userId: user.id, legacyTags: tags ?? [] },
      });
      await setEntryTags(tx, saved.id, user.id, tags ?? []);
      return tx.journalEntry.findUniqueOrThrow({ where: { id: saved.id }, include: entryInclude });
    });

    return Response.json({ entry: serializeEntry(entry) }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message !== "UNAUTHORIZED") {
      return jsonError(error.message);
    }

    return jsonError("Please log in to save entries.", 401);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser(request);
    await prisma.journalEntry.deleteMany({ where: { userId: user.id } });

    return Response.json({ ok: true });
  } catch {
    return jsonError("Please log in to delete entries.", 401);
  }
}
