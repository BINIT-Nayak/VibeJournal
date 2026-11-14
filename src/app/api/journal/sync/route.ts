import { requireUser } from "@/server/auth/session";
import { JournalConflictError } from "@/server/journal/service";
import { replayMutation } from "@/server/journal-sync/service";
import { journalJson, journalRestError } from "@/server/journal/rest-http";

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    if (request.headers.get("X-Local-Journal-Owner") !== user.id) {
      return journalJson(
        {
          error: { code: "FORBIDDEN", message: "Sign in to the account that queued this change." },
        },
        403
      );
    }
    return journalJson({ result: await replayMutation(user.id, await request.json()) });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2002")
      return journalRestError(new JournalConflictError());
    return journalRestError(error);
  }
}
