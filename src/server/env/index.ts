import "server-only";
import { parseServerEnv, type ServerEnv } from "./schema";

let validated: Readonly<ServerEnv> | undefined;

// Read lazily: building an image must not capture deployment secrets. The startup
// hook calls this before serving requests. New server consumers should use it too.
export function getServerEnv(): Readonly<ServerEnv> {
  return (validated ??= parseServerEnv(process.env));
}
