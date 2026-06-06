import { hashPassword, normalizeEmail, requireUser, verifyPassword } from "@/lib/auth";
import { jsonError, serializeSettings } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
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

    if (typeof body.currentPassword === "string" && typeof body.newPassword === "string" && body.newPassword) {
      const existingUser = await prisma.user.findUnique({ where: { id: user.id } });
      if (!existingUser || !(await verifyPassword(body.currentPassword, existingUser.passwordHash))) {
        return jsonError("Current password is incorrect.", 401);
      }
      if (body.newPassword.length < 8) {
        return jsonError("New password must be at least 8 characters.");
      }
      userUpdates.passwordHash = await hashPassword(body.newPassword);
    }

    const settings = await prisma.userSettings.upsert({
      where: { userId: user.id },
      update: {
        darkMode: typeof body.darkMode === "boolean" ? body.darkMode : undefined,
        reminderEnabled: typeof body.reminderEnabled === "boolean" ? body.reminderEnabled : undefined,
        reminderTime: typeof body.reminderTime === "string" ? body.reminderTime : undefined
      },
      create: {
        userId: user.id,
        darkMode: typeof body.darkMode === "boolean" ? body.darkMode : false,
        reminderEnabled: typeof body.reminderEnabled === "boolean" ? body.reminderEnabled : true,
        reminderTime: typeof body.reminderTime === "string" ? body.reminderTime : "20:30"
      }
    });

    const updatedUser = Object.keys(userUpdates).length
      ? await prisma.user.update({
          where: { id: user.id },
          data: userUpdates,
          select: { id: true, email: true, name: true }
        })
      : user;

    return Response.json({
      user: updatedUser,
      settings: serializeSettings(settings)
    });
  } catch (error) {
    if (error instanceof Error && error.message !== "UNAUTHORIZED") {
      return jsonError(error.message);
    }

    return jsonError("Please log in to update settings.", 401);
  }
}
