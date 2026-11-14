import "server-only";
import { prisma } from "../db";
import type { AuditInput } from "./schema";

export function insertAuditEvent(input: AuditInput) {
  return prisma.securityAuditEvent.create({
    data: {
      event: input.event,
      outcome: input.outcome,
      userId: input.userId ?? null,
      reason: input.reason ?? null,
      provider: input.provider ?? null,
      enabled: input.enabled ?? null,
    },
  });
}
export function pruneAuditEvents(before: Date) {
  return prisma.securityAuditEvent.deleteMany({ where: { createdAt: { lt: before } } });
}
