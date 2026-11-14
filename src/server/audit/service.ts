import "server-only";
import { auditInputSchema, type AuditInput } from "./schema";
import { insertAuditEvent, pruneAuditEvents } from "./repository";

export const AUDIT_RETENTION_DAYS = 30;
let nextPrune = 0;
let nextWarning = 0;
function reportFailure() {
  if (Date.now() < nextWarning) return;
  nextWarning = Date.now() + 60_000;
  console.warn("Security audit recording unavailable.");
}
// Audit failure must never turn a successful login/deletion into a false failure.
// Runtime validation protects against accidental unsafe casts or future callers.
export async function recordAuditEvent(input: AuditInput): Promise<boolean> {
  try {
    const parsed = auditInputSchema.safeParse(input);
    if (!parsed.success) {
      reportFailure();
      return false;
    }
    await insertAuditEvent(parsed.data);
    if (Date.now() >= nextPrune) {
      nextPrune = Date.now() + 3_600_000;
      try {
        await pruneAuditEvents(new Date(Date.now() - AUDIT_RETENTION_DAYS * 86400000));
      } catch {
        reportFailure();
      }
    }
    return true;
  } catch {
    reportFailure();
    return false;
  }
}
