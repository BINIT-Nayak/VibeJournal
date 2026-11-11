import "server-only";
import { requireUser } from "@/server/auth/session";
import { createEntry, listEntryPage } from "@/server/journal/service";
import { journalJson, journalRestError } from "@/server/journal/rest-http";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const params = new URL(request.url).searchParams;
    return journalJson(
      await listEntryPage(user, {
        limit: params.get("limit") ?? undefined,
        cursor: params.get("cursor") ?? undefined,
      })
    );
  } catch (error) {
    return journalRestError(error);
  }
}
export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const entry = await createEntry(user, await request.json(), true);
    return journalJson({ entry }, 201, { Location: `/api/journal/${entry.id}` });
  } catch (error) {
    return journalRestError(error);
  }
}
