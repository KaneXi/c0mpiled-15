import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const destination = resolve(".local/relay-web");
await mkdir(destination, { recursive: true });
const bundle = await build({
  entryPoints: ["src/relay-browser.tsx"],
  bundle: true,
  write: false,
  outdir: destination,
  entryNames: "app-[hash]",
  assetNames: "asset-[hash]",
  format: "iife",
  platform: "browser",
  target: "es2022",
  jsx: "automatic",
  minify: true,
  legalComments: "eof",
  define: { "process.env.NODE_ENV": '"production"' },
  loader: { ".woff2": "dataurl" },
  plugins: [
    {
      name: "local-fonts",
      setup(b) {
        b.onResolve({ filter: /^\/fonts\// }, (args) => ({
          path: resolve("public", args.path.slice(1)),
        }));
      },
    },
  ],
});
for (const file of bundle.outputFiles)
  await writeFile(file.path, file.contents);
const js = bundle.outputFiles
  .find((f) => f.path.endsWith(".js"))
  .path.split("/")
  .at(-1);
const css = bundle.outputFiles
  .find((f) => f.path.endsWith(".css"))
  .path.split("/")
  .at(-1);
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Relay · Volunteer coordination</title><link rel="stylesheet" href="/${css}"></head><body><div id="root"></div><noscript>Enable JavaScript to use Relay.</noscript><script defer src="/${js}"></script></body></html>`;
await writeFile(`${destination}/index.html`, html);
await writeFile(`${destination}/demo.html`, html);
console.log("Relay static website generated from the same dashboard source.");
