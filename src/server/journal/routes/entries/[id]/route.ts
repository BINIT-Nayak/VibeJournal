import "server-only";

import { entryInclude, setEntryTags } from "@/server/journal/entries";

import { requireUser } from "@/server/auth/session";
import { jsonError } from "@/lib/http";
import { serializeEntry } from "@/server/api";
import { journalUpdateSchema, normalizeJournalInput } from "@/features/journal/schemas";
import { prisma } from "@/server/db";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const entry = await prisma.journalEntry.findFirst({
      where: { id, userId: user.id },
      include: entryInclude,
    });

    if (!entry) {
      return jsonError("Entry not found.", 404);
    }

    return Response.json({ entry: serializeEntry(entry) });
  } catch {
    return jsonError("Please log in to view this entry.", 401);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireUser(request);
    const { id } = await context.params;
    const parsed = journalUpdateSchema.safeParse(normalizeJournalInput(await request.json()));
    if (!parsed.success)
      return Response.json(
        { error: "Check the journal fields.", issues: parsed.error.issues },
        { status: 400 }
      );
    const { tags, archived, ...fields } = parsed.data;

    const existingEntry = await prisma.journalEntry.findFirst({
      where: { id, userId: user.id },
      include: entryInclude,
    });

    if (!existingEntry) {
      return jsonError("Entry not found.", 404);
    }

    const entry = await prisma.$transaction(async (tx) => {
      await tx.journalEntry.update({
        where: { id },
        data: {
          ...fields,
          archivedAt: archived === undefined ? undefined : archived ? new Date() : null,
          legacyTags: tags,
        },
      });
      if (tags !== undefined) await setEntryTags(tx, id, user.id, tags ?? []);
      return tx.journalEntry.findUniqueOrThrow({ where: { id }, include: entryInclude });
    });

    return Response.json({ entry: serializeEntry(entry) });
  } catch (error) {
    if (error instanceof Error && error.message !== "UNAUTHORIZED") {
      return jsonError(error.message);
    }

    return jsonError("Please log in to update this entry.", 401);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const user = await requireUser(request);
    const { id } = await context.params;
    const entry = await prisma.journalEntry.findFirst({
      where: { id, userId: user.id },
      include: entryInclude,
    });

    if (!entry) {
      return jsonError("Entry not found.", 404);
    }

    await prisma.journalEntry.delete({ where: { id } });

    return Response.json({ ok: true });
  } catch {
    return jsonError("Please log in to delete this entry.", 401);
  }
}
