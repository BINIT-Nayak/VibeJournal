import "server-only";

import { requireUser } from "@/server/auth/session";
import { getEntry, updateEntry, deleteEntry } from "@/server/journal/service";
import { journalErrorResponse } from "@/server/journal/http";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    return Response.json({ entry: await getEntry(user, (await context.params).id) });
  } catch (error) {
    return journalErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireUser(request);
    return Response.json({
      entry: await updateEntry(user, (await context.params).id, await request.json()),
    });
  } catch (error) {
    return journalErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    await deleteEntry(await requireUser(request), (await context.params).id);
    return Response.json({ ok: true });
  } catch (error) {
    return journalErrorResponse(error);
  }
}
