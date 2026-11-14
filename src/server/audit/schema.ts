import { z } from "zod";

// No free-form metadata, messages, request objects or error objects are accepted.
export const auditInputSchema = z
  .object({
    event: z.enum([
      "login",
      "logout",
      "password.change",
      "password.reset",
      "data.export",
      "account.delete",
      "ai.preference",
    ]),
    outcome: z.enum(["requested", "succeeded", "denied", "failed"]),
    userId: z
      .string()
      .regex(/^[a-zA-Z0-9_-]{1,128}$/)
      .optional(),
    reason: z
      .enum([
        "invalid_input",
        "invalid_credentials",
        "unauthorized",
        "invalid_origin",
        "rate_limited",
        "unavailable",
        "reauth_required",
      ])
      .optional(),
    provider: z.enum(["credentials", "google"]).optional(),
    enabled: z.boolean().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.enabled !== undefined && value.event !== "ai.preference")
      ctx.addIssue({ code: "custom", message: "Unexpected preference field." });
    if (value.provider !== undefined && value.event !== "login")
      ctx.addIssue({ code: "custom", message: "Unexpected provider field." });
    if (value.event === "account.delete" && value.outcome === "succeeded" && value.userId)
      ctx.addIssue({ code: "custom", message: "Completed deletion must be anonymous." });
  });
export type AuditInput = z.infer<typeof auditInputSchema>;
