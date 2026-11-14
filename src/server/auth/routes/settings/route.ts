import "server-only";
import { recordAuditEvent } from "@/server/audit/service";
import { Prisma } from "@prisma/client";
import { musicPreferencesSchema } from "@/features/music/preferences";

import { requireUser } from "@/server/auth/session";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { credentialsSchema, normalizeEmail } from "@/features/auth/schemas";
import { jsonError } from "@/lib/http";
import { serializeSettings } from "@/server/api";
import { prisma } from "@/server/db";

export async function PATCH(request: Request) {
  let actorId: string | undefined;
  let passwordAttempt = false;
  let aiAttempt = false;
  try {
    const user = await requireUser(request);
    actorId = user.id;
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body))
      return jsonError("Provide a settings object.", 400);
    passwordAttempt = typeof body.newPassword === "string" && Boolean(body.newPassword);
    aiAttempt = "aiConsent" in body;
    if (passwordAttempt && (typeof body.currentPassword !== "string" || !body.currentPassword)) {
      await recordAuditEvent({
        event: "password.change",
        outcome: "denied",
        userId: actorId,
        reason: "reauth_required",
      });
      return jsonError("Enter your current password.", 401);
    }
    if (aiAttempt && typeof body.aiConsent !== "boolean") {
      await recordAuditEvent({
        event: "ai.preference",
        outcome: "denied",
        userId: actorId,
        reason: "invalid_input",
      });
      return jsonError("AI analysis preference must be true or false.", 400);
    }
    const preferences =
      "musicPreferences" in body
        ? musicPreferencesSchema.safeParse(body.musicPreferences)
        : undefined;
    if (preferences && !preferences.success)
      return jsonError(preferences.error.issues[0]?.message ?? "Invalid music preferences.", 400);
    const musicUpdates = preferences?.success ? preferences.data : {};
    const userUpdates: { name?: string | null; email?: string; passwordHash?: string } = {};

    if (typeof body.name === "string") {
      userUpdates.name = body.name.trim() || null;
    }

    if (typeof body.email === "string") {
      const email = normalizeEmail(body.email);
      if (!email.includes("@")) {
        return jsonError("Enter a valid email.");
      }
      userUpdates.email = email;
    }

    if (
      typeof body.currentPassword === "string" &&
      typeof body.newPassword === "string" &&
      body.newPassword
    ) {
      const existingUser = await prisma.user.findUnique({ where: { id: user.id } });
      if (!existingUser?.passwordHash) {
        await recordAuditEvent({
          event: "password.change",
          outcome: "denied",
          userId: actorId,
          reason: "reauth_required",
        });
        return jsonError("Password changes are only available for password-based accounts.", 400);
      }

      if (!(await verifyPassword(body.currentPassword, existingUser.passwordHash))) {
        await recordAuditEvent({
          event: "password.change",
          outcome: "denied",
          userId: actorId,
          reason: "invalid_credentials",
        });
        return jsonError("Current password is incorrect.", 401);
      }
      if (!credentialsSchema.shape.password.safeParse(body.newPassword).success) {
        await recordAuditEvent({
          event: "password.change",
          outcome: "denied",
          userId: actorId,
          reason: "invalid_input",
        });
        return jsonError("New password must be between 8 and 128 characters.");
      }
      userUpdates.passwordHash = await hashPassword(body.newPassword);
    }

    const settings = await prisma.userSettings.upsert({
      where: { userId: user.id },
      update: {
        ...musicUpdates,
        aiConsent: typeof body.aiConsent === "boolean" ? body.aiConsent : undefined,
        darkMode: typeof body.darkMode === "boolean" ? body.darkMode : undefined,
        privacyAcknowledged:
          typeof body.privacyAcknowledged === "boolean" ? body.privacyAcknowledged : undefined,
        reminderEnabled:
          typeof body.reminderEnabled === "boolean" ? body.reminderEnabled : undefined,
        reminderTime: typeof body.reminderTime === "string" ? body.reminderTime : undefined,
        spotifyConnected:
          typeof body.spotifyConnected === "boolean" ? body.spotifyConnected : undefined,
      },
      create: {
        userId: user.id,
        ...musicUpdates,
        aiConsent: typeof body.aiConsent === "boolean" ? body.aiConsent : false,
        darkMode: typeof body.darkMode === "boolean" ? body.darkMode : false,
        privacyAcknowledged:
          typeof body.privacyAcknowledged === "boolean" ? body.privacyAcknowledged : false,
        reminderEnabled: typeof body.reminderEnabled === "boolean" ? body.reminderEnabled : true,
        reminderTime: typeof body.reminderTime === "string" ? body.reminderTime : "20:30",
        spotifyConnected:
          typeof body.spotifyConnected === "boolean" ? body.spotifyConnected : false,
      },
    });

    if (aiAttempt) {
      await recordAuditEvent({
        event: "ai.preference",
        outcome: "succeeded",
        userId: actorId,
        enabled: settings.aiConsent,
      });
      aiAttempt = false;
    }
    const updatedUser = Object.keys(userUpdates).length
      ? await prisma.user.update({
          where: { id: user.id },
          data: userUpdates,
          select: { id: true, email: true, name: true },
        })
      : user;

    if (userUpdates.passwordHash) {
      await recordAuditEvent({ event: "password.change", outcome: "succeeded", userId: actorId });
      passwordAttempt = false;
      await prisma.session.deleteMany({ where: { userId: user.id } });
    }

    return Response.json({
      user: updatedUser,
      settings: serializeSettings(settings),
    });
  } catch (error) {
    if (passwordAttempt)
      await recordAuditEvent({
        event: "password.change",
        outcome: "failed",
        userId: actorId,
        reason: "unavailable",
      });
    if (aiAttempt)
      await recordAuditEvent({
        event: "ai.preference",
        outcome: "failed",
        userId: actorId,
        reason: "unavailable",
      });
    if (error instanceof Error && error.message === "UNAUTHORIZED")
      return jsonError("Please log in to update settings.", 401);
    if (error instanceof Error && error.message === "Invalid request origin.")
      return jsonError("Invalid request origin.", 403);
    if (error instanceof SyntaxError) return jsonError("Provide valid JSON settings.", 400);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      return jsonError("That email is already in use.", 409);
    return jsonError("Settings are temporarily unavailable. Please try again.", 500);
  }
}
