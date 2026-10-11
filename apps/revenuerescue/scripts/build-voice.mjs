import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
await mkdir(".local/voice", { recursive: true });
await build({
  entryPoints: ["src/relay/voice/handler.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  outfile: ".local/voice/index.js",
  minify: true,
});
execFileSync("zip", [
  "-q",
  "-j",
  ".local/voice/function.zip",
  ".local/voice/index.js",
]);
console.log("Outbound voice handler packaged. No cloud resources created.");
