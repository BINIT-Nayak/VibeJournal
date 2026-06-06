import { requireUser } from "@/lib/auth";
import { jsonError, parseMood, parseNumber, parseStringArray, serializeEntry } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await requireUser();
    const entries = await prisma.moodEntry.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" }
    });

    return Response.json({ entries: entries.map(serializeEntry) });
  } catch {
    return jsonError("Please log in to view entries.", 401);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const mood = parseMood(body.mood);
    const energy = parseNumber(body.energy, 5, 1, 10);
    const stress = parseNumber(body.stress, 5, 1, 10);
    const valence = parseNumber(body.valence, 5, 1, 10);
    const note = String(body.note ?? "").trim();

    if (!note) {
      return jsonError("Write a note before saving.");
    }

    const entry = await prisma.moodEntry.create({
      data: {
        userId: user.id,
        mood,
        energy,
        stress,
        valence,
        note,
        tags: parseStringArray(body.tags),
        sleepHours: typeof body.sleepHours === "number" ? parseNumber(body.sleepHours, 7, 0, 14) : null,
        exerciseMinutes: typeof body.exerciseMinutes === "number" ? parseNumber(body.exerciseMinutes, 0, 0, 240) : null,
        socialLevel: typeof body.socialLevel === "number" ? parseNumber(body.socialLevel, 5, 1, 10) : null,
        voiceNote: typeof body.voiceNote === "string" && body.voiceNote.trim() ? body.voiceNote.trim() : null,
        photoNames: parseStringArray(body.photoNames)
      }
    });

    return Response.json({ entry: serializeEntry(entry) }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message !== "UNAUTHORIZED") {
      return jsonError(error.message);
    }

    return jsonError("Please log in to save entries.", 401);
  }
}

export async function DELETE() {
  try {
    const user = await requireUser();
    await prisma.moodEntry.deleteMany({ where: { userId: user.id } });

    return Response.json({ ok: true });
  } catch {
    return jsonError("Please log in to delete entries.", 401);
  }
}
