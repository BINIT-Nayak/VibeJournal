import "server-only";
import { EncryptionError } from "../encryption/envelope";

import { ZodError } from "zod";
import { jsonError } from "@/lib/http";
import { JournalNotFoundError, JournalConflictError } from "./service";

export function journalErrorResponse(error: unknown) {
  if (error instanceof EncryptionError) return jsonError(error.message, 503);
  if (error instanceof ZodError) {
    return Response.json(
      { error: "Check the journal fields.", issues: error.issues },
      { status: 400 }
    );
  }
  if (error instanceof JournalConflictError) return jsonError(error.message, 409);
  if (error instanceof JournalNotFoundError) return jsonError(error.message, 404);
  if (error instanceof SyntaxError) return jsonError("Invalid JSON request.", 400);
  if (error instanceof Error && error.message === "UNAUTHORIZED")
    return jsonError("Please log in to access your journal.", 401);
  if (error instanceof Error && error.message === "Invalid request origin.")
    return jsonError(error.message, 403);
  // Do not expose database error details or misreport infrastructure failures as 401.
  return jsonError("Your journal is temporarily unavailable. Please try again.", 500);
}
