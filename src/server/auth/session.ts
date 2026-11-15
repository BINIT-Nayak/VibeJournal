import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { auth, signOut } from "./config";
import { isSameOriginRequest } from "./request";
import type { ClientUser } from "@/features/auth/types";

// React cache is scoped to a server render, never shared across requests or accounts.
export const getCurrentUser = cache(async (): Promise<ClientUser | null> => {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) return null;
  // auth() already loads the persisted session and user in its JWT callback,
  // checks expiry/credential version, and ignores client-supplied session updates.
  return { id: session.user.id, email: session.user.email, name: session.user.name ?? null };
});

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
