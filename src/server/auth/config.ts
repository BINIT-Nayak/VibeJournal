import "server-only";

import { randomBytes } from "node:crypto";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { credentialsSchema, normalizeEmail } from "@/features/auth/schemas";
import { prisma } from "@/server/db";
import { dummyPasswordHash, hashPassword, verifyPassword } from "./password";
import { allowAuthAttempt } from "./rate-limit";
import { hashToken, sessionMaxAge } from "./tokens";

class RateLimited extends CredentialsSignin {
  code = "rate_limited";
}

export const googleEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  pages: { signIn: "/login", error: "/login" },
  session: { strategy: "jwt", maxAge: sessionMaxAge },
  providers: [
    Credentials({
      credentials: { email: { type: "email" }, password: { type: "password" } },
      async authorize(input) {
        const parsed = credentialsSchema.safeParse(input);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        if (!(await allowAuthAttempt("login", email))) throw new RateLimited();
        const user = await prisma.user.findUnique({ where: { email } });
        const valid = await verifyPassword(password, user?.passwordHash || dummyPasswordHash);
        if (!user?.passwordHash || !valid) return null;
        let passwordHash = user.passwordHash;
        if (!passwordHash.startsWith("scrypt$")) {
          const upgraded = await hashPassword(password);
          const result = await prisma.user.updateMany({
            where: { id: user.id, passwordHash },
            data: { passwordHash: upgraded },
          });
          if (result.count !== 1) return null;
          passwordHash = upgraded;
        }
        // Only these database-derived fields can enter the signed session.
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          credentialVersion: hashToken(passwordHash),
        };
      },
    }),
    ...(googleEnabled
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            async profile(profile) {
              if (!profile.email_verified || !profile.email || !profile.sub)
                throw new Error("Unverified Google identity");
              const email = normalizeEmail(profile.email);
              let user = await prisma.user.findUnique({ where: { googleSubject: profile.sub } });
              if (!user) {
                // Never silently attach an OAuth identity to an existing password account.
                if (await prisma.user.findUnique({ where: { email } }))
                  throw new Error("Account linking requires authentication");
                user = await prisma.user.create({
                  data: {
                    email,
                    name: profile.name || null,
                    authProvider: "google",
                    googleSubject: profile.sub,
                    settings: { create: {} },
                  },
                });
              }
              return { id: user.id, name: user.name, email: user.email };
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        if (!user.id) throw new CredentialsSignin();
        const current = await prisma.user.findUnique({ where: { id: user.id } });
        if (!current) throw new CredentialsSignin();
        const version = hashToken(current.passwordHash || "oauth");
        if (user.credentialVersion && user.credentialVersion !== version)
          throw new CredentialsSignin();
        const sid = randomBytes(32).toString("hex");
        await prisma.session.create({
          data: {
            tokenHash: hashToken(sid),
            userId: current.id,
            expiresAt: new Date(Date.now() + sessionMaxAge * 1000),
          },
        });
        token.sub = current.id;
        token.sid = sid;
        token.credentialVersion = version;
      }
      // Ignore all client-supplied session updates. Validate the server session on
      // every request; password changes/deletion/logout invalidate replayed cookies.
      if (typeof token.sid !== "string" || !token.sub) return null;
      const stored = await prisma.session.findUnique({
        where: { tokenHash: hashToken(token.sid) },
        include: { user: true },
      });
      if (
        !stored ||
        stored.userId !== token.sub ||
        stored.expiresAt <= new Date() ||
        token.credentialVersion !== hashToken(stored.user.passwordHash || "oauth")
      )
        return null;
      token.name = stored.user.name;
      token.email = stored.user.email;
      token.sessionExpiresAt = stored.expiresAt.toISOString();
      return token;
    },
    async session({ session, token }) {
      return {
        expires:
          typeof token.sessionExpiresAt === "string"
            ? token.sessionExpiresAt
            : new Date(session.expires).toISOString(),
        user: { id: token.sub!, name: token.name, email: token.email! },
      };
    },
  },
  events: {
    async signOut(message) {
      if ("token" in message && typeof message.token?.sid === "string") {
        await prisma.session.deleteMany({ where: { tokenHash: hashToken(message.token.sid) } });
      }
    },
  },
});
