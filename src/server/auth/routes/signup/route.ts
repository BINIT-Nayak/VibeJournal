import "server-only";

import { Prisma } from "@prisma/client";
import { registerSchema } from "@/features/auth/schemas";
import { hashPassword } from "@/server/auth/password";
import { isSameOriginRequest } from "@/server/auth/request";
import { allowAuthAttempt } from "@/server/auth/rate-limit";
import { jsonError } from "@/lib/http";
import { prisma } from "@/server/db";
import { POST as login } from "../login/route";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return jsonError("Invalid request origin.", 403);
  const parsed = registerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Invalid registration.");
  const { email, password, name } = parsed.data;
  try {
    if (!(await allowAuthAttempt("register", email, 5))) {
      return jsonError("Too many attempts. Try again in 15 minutes.", 429);
    }
    await prisma.user.create({
      data: {
        email,
        name: name || null,
        passwordHash: await hashPassword(password),
        settings: { create: {} },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return jsonError("An account already exists for this email.", 409);
    }
    return jsonError("Registration is temporarily unavailable.", 503);
  }
  // Complete registration through the same Auth.js credentials flow as login.
  return login(
    new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify({ email, password }),
    })
  );
}
