import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");

const migrationName = "20261110090000_journal_tags";
const migrations = "prisma/migrations";
const readMigration = (name) =>
  readFileSync(`${migrations}/${name}/migration.sql`, "utf8").replace(/^(BEGIN|COMMIT);$/gm, "");
const previous = readdirSync(migrations)
  .filter((name) => /^\d/.test(name) && name < migrationName)
  .sort()
  .map(readMigration)
  .join("\n");
const migration = readMigration(migrationName);
const checks = readFileSync("tests/database/journal.sql", "utf8");

function run(sql) {
  const schema = `journal_test_${randomUUID().replaceAll("-", "")}`;
  const url = new URL(process.env.DATABASE_URL);
  const result = spawnSync("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1"], {
    env: {
      ...process.env,
      PGHOST: url.hostname,
      PGPORT: url.port || "5432",
      PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
      PGUSER: decodeURIComponent(url.username),
      PGPASSWORD: decodeURIComponent(url.password),
      PGSSLMODE: url.searchParams.get("sslmode") || "prefer",
    },
    input: `BEGIN; CREATE SCHEMA "${schema}"; SET LOCAL search_path TO "${schema}";\n${previous}\n${sql}\nROLLBACK;`,
    encoding: "utf8",
  });
  if (result.error) throw new Error(result.stderr || result.error.message);
  return result;
}

const valid = run(`${migration}\n${checks}`);
if (valid.status !== 0) throw new Error(valid.stderr);
console.log("PASS: migration replay, ranges, ownership, uniqueness, indexes, and cascades");

const blocked = run(`
INSERT INTO "User" (id, email, "updatedAt") VALUES ('legacy-user', 'legacy@example.invalid', now());
INSERT INTO "JournalEntry" (id, "userId", content, "updatedAt") VALUES ('legacy-entry', 'legacy-user', 'Preserve this', now());
${migration}`);
if (blocked.status === 0 || !blocked.stderr.includes("provide a reviewed moodScore backfill")) {
  throw new Error("Expected migration to reject unscored legacy entries safely.");
}
console.log("PASS: populated legacy JournalEntry table requires an explicit backfill");
const transferred = run(
  `${migration}\n${readFileSync("tests/database/cutover-before.sql", "utf8")}\n${readMigration("20261110093000_journal_cutover")}\n${readFileSync("tests/database/cutover-after.sql", "utf8")}`
);
if (transferred.status !== 0) throw new Error(transferred.stderr);
console.log(
  "PASS: data transfer preserves fields, IDs, timestamps, nulls, ownership, and tag order"
);
console.log("All test schemas and data rolled back; application tables unchanged.");
