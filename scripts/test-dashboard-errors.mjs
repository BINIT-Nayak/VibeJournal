import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import ts from "typescript";

// Compile the actual modules in memory using the installed TypeScript compiler.
// No provider, database, network, or generated source files are needed.
const cache = new Map();
function loadTypeScript(filename) {
  if (cache.has(filename)) return cache.get(filename);
  const exports = {};
  cache.set(filename, exports);
  const require = createRequire(filename);
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  });
  new Function("require", "exports", compiled.outputText)(
    (specifier) =>
      specifier.startsWith("@/")
        ? loadTypeScript(resolve("src", specifier.slice(2) + ".ts"))
        : specifier.startsWith(".")
          ? loadTypeScript(resolve(dirname(filename), specifier + ".ts"))
          : require(specifier),
    exports
  );
  return exports;
}

const { z } = createRequire(import.meta.url)("zod");
cache.set(resolve("src/server/auth/session.ts"), {
  requireUser: async () => ({ id: "test-user" }),
});
const service = loadTypeScript(resolve("src/server/dashboard/service.ts"));
const { DashboardQueryError } = service;
const getDashboard = service.getDashboard;
const { GET } = loadTypeScript(resolve("src/server/dashboard/route.ts"));
const request = new Request("http://localhost:3000/api/dashboard?timeZone=Asia%2FCalcutta");
let observed;
service.getDashboard = async (_user, query) => {
  observed = query;
  return { ok: true };
};
assert.equal((await GET(request)).status, 200);
assert.equal(observed.timeZone, "Asia/Calcutta");
const validation = z.string().safeParse(undefined).error;
service.getDashboard = async () => {
  throw validation;
};
const internal = await GET(request);
assert.equal(internal.status, 500);
assert.equal((await internal.json()).error.code, "INTERNAL_ERROR");
service.getDashboard = async () => {
  throw new DashboardQueryError(validation);
};
const invalid = await GET(request);
assert.equal(invalid.status, 400);
assert.equal((await invalid.json()).error.code, "VALIDATION_ERROR");
service.getDashboard = getDashboard;
await assert.rejects(
  getDashboard({ id: "test-user" }, { timeZone: "Not/AZone" }),
  DashboardQueryError
);
console.log(
  "PASS: dashboard forwards Asia/Calcutta, distinguishes invalid query from internal schema errors, and rejects invalid zones before database access."
);
