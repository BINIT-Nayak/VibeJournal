import "server-only";

import { requireUser } from "@/server/auth/session";
import { createEntry, listEntries, deleteAllEntries } from "@/server/journal/service";
import { journalErrorResponse } from "@/server/journal/http";

export async function GET() {
  try {
    return Response.json({ entries: await listEntries(await requireUser()) });
  } catch (error) {
    return journalErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    return Response.json({ entry: await createEntry(user, await request.json()) }, { status: 201 });
  } catch (error) {
    return journalErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await deleteAllEntries(await requireUser(request));
    return Response.json({ ok: true });
  } catch (error) {
    return journalErrorResponse(error);
  }
}
