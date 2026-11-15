import "server-only";
import { prisma } from "./db";

export async function getAccountTheme(userId: string): Promise<"light" | "dark"> {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { darkMode: true },
  });
  return settings?.darkMode ? "dark" : "light";
}
