import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";

export class AccountChangedError extends Error {}

type UserUpdates = { name?: string | null; email?: string; passwordHash?: string };
export function persistSettings(
  userId: string,
  userUpdates: UserUpdates,
  settingsUpdate: Prisma.UserSettingsUpdateInput,
  settingsCreate: Omit<Prisma.UserSettingsUncheckedCreateInput, "userId">,
  verified?: { passwordHash: string; email: string }
) {
  return prisma.$transaction(async (tx) => {
    // Lock/check the identity before any settings write. A reset or concurrent
    // account change after password verification must not be overwritten.
    if (Object.keys(userUpdates).length) {
      const updated = await tx.user.updateMany({
        where: { id: userId, ...verified },
        data: userUpdates,
      });
      if (updated.count !== 1) throw new AccountChangedError();
    }
    const settings = await tx.userSettings.upsert({
      where: { userId },
      update: settingsUpdate,
      create: { ...settingsCreate, userId },
    });
    if (userUpdates.passwordHash || verified) {
      await tx.session.deleteMany({ where: { userId } });
      await tx.passwordResetToken.deleteMany({ where: { userId } });
    }
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });
    return { user, settings };
  });
}
