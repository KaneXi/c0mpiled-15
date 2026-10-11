import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const destination = resolve(".local/lambda");
await mkdir(destination, { recursive: true });
await build({
  entryPoints: ["src/server/handler.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  outfile: `${destination}/index.js`,
  legalComments: "eof",
  sourcemap: false,
});
execFileSync("zip", [
  "-q",
  "-j",
  `${destination}/function.zip`,
  `${destination}/index.js`,
]);
const bytes = await readFile(`${destination}/function.zip`);
const hash = createHash("sha256").update(bytes).digest("hex");
await writeFile(`${destination}/SHA256SUMS`, `${hash}  function.zip\n`);
console.log(`Lambda bundle ready (${bytes.length} bytes).`);
