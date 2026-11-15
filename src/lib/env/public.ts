import { z } from "zod";

// Deliberately empty: no application configuration currently belongs in the browser.
// Add only reviewed NEXT_PUBLIC_* fields, with explicit process.env.NEXT_PUBLIC_X
// reads below so Next.js can inline those values at build time. Never spread process.env.
export const publicEnvSchema = z.object({}).strict();
export type PublicEnv = z.infer<typeof publicEnvSchema>;
export const publicEnv: Readonly<PublicEnv> = Object.freeze(publicEnvSchema.parse({}));
