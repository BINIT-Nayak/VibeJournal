import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import ts from "typescript";
const cache = new Map();
export function load(filename) {
  filename = resolve(filename);
  if (cache.has(filename)) return cache.get(filename);
  const exports = {};
  cache.set(filename, exports);
  const require = createRequire(filename);
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  new Function("require", "exports", compiled.outputText)((specifier) => {
    if (specifier.startsWith(".") || specifier.startsWith("@/")) {
      const path = specifier.startsWith("@/")
        ? resolve("src", specifier.slice(2))
        : resolve(dirname(filename), specifier);
      return load(existsSync(path + ".ts") ? path + ".ts" : resolve(path, "index.ts"));
    }
    return require(specifier);
  }, exports);
  return exports;
}
