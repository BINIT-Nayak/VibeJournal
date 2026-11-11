import type { JournalApiError, JournalEntryResponse } from "./api-types";
import type { JournalCreateInput } from "./schemas";

export class JournalSaveError extends Error {
  constructor(
    message: string,
    readonly issues: NonNullable<JournalApiError["error"]["issues"]> = []
  ) {
    super(message);
  }
}

async function saveJournalEntry(
  values: JournalCreateInput,
  id?: string
): Promise<JournalEntryResponse> {
  let response: Response;
  try {
    response = await fetch(id ? `/api/journal/${encodeURIComponent(id)}` : "/api/journal", {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
  } catch {
    throw new JournalSaveError(
      "We couldn't connect. Your writing is still here. Check your connection and try again."
    );
  }
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new JournalSaveError(
      response.status === 401
        ? "Your session has expired. Sign in again before saving. Your writing is still here."
        : typeof result?.error?.message === "string"
          ? result.error.message
          : "Could not save your entry. Please try again.",
      Array.isArray(result?.error?.issues)
        ? result.error.issues.filter(
            (issue: { path?: unknown; message?: unknown }) =>
              typeof issue?.path === "string" && typeof issue?.message === "string"
          )
        : []
    );
  }
  if (typeof result?.entry?.id !== "string" || !result.entry.id) {
    throw new JournalSaveError(
      "We couldn't confirm the save. Check your journal history before trying again."
    );
  }
  return result as JournalEntryResponse;
}

export const createJournalEntry = (values: JournalCreateInput) => saveJournalEntry(values);
export const updateJournalEntry = (id: string, values: JournalCreateInput) =>
  saveJournalEntry(values, id);
