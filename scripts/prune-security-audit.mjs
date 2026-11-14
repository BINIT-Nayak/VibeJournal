import nextEnv from "@next/env";
import { load } from "./encryption-loader.mjs";
nextEnv.loadEnvConfig(process.cwd());
const { prisma } = load("src/server/db.ts");
try {
  const removed = await prisma.securityAuditEvent.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - 30 * 86400000) } },
  });
  console.log("Expired security audit records removed:", removed.count);
} catch {
  console.error("Security audit retention cleanup failed.");
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
