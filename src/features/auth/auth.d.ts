import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & { id: string };
  }
  interface User {
    credentialVersion?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sid?: string;
    credentialVersion?: string;
  }
}
