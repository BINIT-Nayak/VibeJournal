import { requireUser } from "@/lib/auth";
import { jsonError, parseMood, parseNumber, parseStringArray, serializeEntry } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const entry = await prisma.moodEntry.findFirst({ where: { id, userId: user.id } });

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
    const user = await requireUser();
    const { id } = await context.params;
    const body = await request.json();
    const existingEntry = await prisma.moodEntry.findFirst({ where: { id, userId: user.id } });

    if (!existingEntry) {
      return jsonError("Entry not found.", 404);
    }

    const entry = await prisma.moodEntry.update({
      where: { id },
      data: {
        mood: body.mood ? parseMood(body.mood) : existingEntry.mood,
        energy: typeof body.energy === "number" ? parseNumber(body.energy, existingEntry.energy, 1, 10) : existingEntry.energy,
        stress: typeof body.stress === "number" ? parseNumber(body.stress, existingEntry.stress, 1, 10) : existingEntry.stress,
        valence: typeof body.valence === "number" ? parseNumber(body.valence, existingEntry.valence, 1, 10) : existingEntry.valence,
        note: typeof body.note === "string" ? body.note.trim() : existingEntry.note,
        tags: Array.isArray(body.tags) ? parseStringArray(body.tags) : existingEntry.tags,
        sleepHours: typeof body.sleepHours === "number" ? parseNumber(body.sleepHours, 7, 0, 14) : existingEntry.sleepHours,
        exerciseMinutes: typeof body.exerciseMinutes === "number" ? parseNumber(body.exerciseMinutes, 0, 0, 240) : existingEntry.exerciseMinutes,
        socialLevel: typeof body.socialLevel === "number" ? parseNumber(body.socialLevel, 5, 1, 10) : existingEntry.socialLevel,
        voiceNote: typeof body.voiceNote === "string" && body.voiceNote.trim() ? body.voiceNote.trim() : existingEntry.voiceNote,
        photoNames: Array.isArray(body.photoNames) ? parseStringArray(body.photoNames) : existingEntry.photoNames,
        archivedAt: typeof body.archived === "boolean" ? (body.archived ? new Date() : null) : existingEntry.archivedAt
      }
    });

    return Response.json({ entry: serializeEntry(entry) });
  } catch (error) {
    if (error instanceof Error && error.message !== "UNAUTHORIZED") {
      return jsonError(error.message);
    }

    return jsonError("Please log in to update this entry.", 401);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const entry = await prisma.moodEntry.findFirst({ where: { id, userId: user.id } });

    if (!entry) {
      return jsonError("Entry not found.", 404);
    }

    await prisma.moodEntry.delete({ where: { id } });

    return Response.json({ ok: true });
  } catch {
    return jsonError("Please log in to delete this entry.", 401);
  }
}
