import "server-only";

import NextAuth from "next-auth";

// Foundation only: keep the existing authentication flow until its migration.
// Add providers here when the UI and protected API routes move to Auth.js together.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [],
  session: { strategy: "jwt" },
});
