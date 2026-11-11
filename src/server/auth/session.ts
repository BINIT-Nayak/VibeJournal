import "server-only";

import { cookies } from "next/headers";
import { auth, signOut } from "./config";
import { isSameOriginRequest } from "./request";
import { prisma } from "@/server/db";
import type { ClientUser } from "@/features/auth/types";

export async function getCurrentUser(): Promise<ClientUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true },
  });
}

export async function requireUser(request?: Request) {
  if (request && !["GET", "HEAD"].includes(request.method) && !isSameOriginRequest(request)) {
    throw new Error("Invalid request origin.");
  }
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export async function clearLegacyCookie() {
  (await cookies()).delete("vibejournal_session");
}

export async function destroyCurrentSession() {
  await signOut({ redirect: false, redirectTo: "/login" });
  await clearLegacyCookie();
}
