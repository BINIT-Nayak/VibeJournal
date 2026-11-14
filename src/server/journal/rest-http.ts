import "server-only";
import { EncryptionError } from "../encryption/envelope";
import { ZodError } from "zod";
import type { JournalApiError, JournalApiErrorCode } from "@/features/journal/api-types";
import { JournalNotFoundError, JournalConflictError } from "./service";
import { InvalidJournalCursorError } from "./pagination";

export function journalJson(data: unknown, status = 200, headers?: Record<string, string>) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store", ...headers },
  });
}
export function journalRestError(error: unknown) {
  let status = 500;
  let code: JournalApiErrorCode = "INTERNAL_ERROR";
  let message = "Your journal is temporarily unavailable. Please try again.";
  let issues: JournalApiError["error"]["issues"];
  if (error instanceof EncryptionError) {
    status = 503;
    message = error.message;
  } else if (error instanceof ZodError) {
    status = 400;
    code = "VALIDATION_ERROR";
    message = "Check the journal fields.";
    issues = error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
  } else if (error instanceof InvalidJournalCursorError) {
    status = 400;
    code = "INVALID_CURSOR";
    message = error.message;
  } else if (error instanceof JournalConflictError) {
    status = 409;
    code = "CONFLICT";
    message = error.message;
  } else if (error instanceof JournalNotFoundError) {
    status = 404;
    code = "NOT_FOUND";
    message = error.message;
  } else if (error instanceof SyntaxError) {
    status = 400;
    code = "INVALID_JSON";
    message = "Invalid JSON request.";
  } else if (error instanceof Error && error.message === "UNAUTHORIZED") {
    status = 401;
    code = "UNAUTHORIZED";
    message = "Please log in to access your journal.";
  } else if (error instanceof Error && error.message === "Invalid request origin.") {
    status = 403;
    code = "FORBIDDEN";
    message = error.message;
  }
  return journalJson(
    { error: { code, message, ...(issues ? { issues } : {}) } } satisfies JournalApiError,
    status
  );
}
