import "server-only";
import { requireUser } from "@/server/auth/session";
import { getEntry, updateEntry, deleteEntry } from "@/server/journal/service";
import { journalJson, journalRestError } from "@/server/journal/rest-http";

type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const user = await requireUser();
    const owner = request.headers.get("X-Local-Journal-Owner");
    if (owner && owner !== user.id)
      return journalJson(
        {
          error: {
            code: "FORBIDDEN",
            message: "Sign in to the account that owns this local change.",
          },
        },
        403
      );
    return journalJson({ entry: await getEntry(user, (await context.params).id, true) });
  } catch (error) {
    return journalRestError(error);
  }
}
export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requireUser(request);
    return journalJson({
      entry: await updateEntry(user, (await context.params).id, await request.json(), true),
    });
  } catch (error) {
    return journalRestError(error);
  }
}
export async function DELETE(request: Request, context: Context) {
  try {
    await deleteEntry(await requireUser(request), (await context.params).id);
    return new Response(null, { status: 204, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return journalRestError(error);
  }
}
