import { build } from "esbuild";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const destination = resolve(root, "../../integrated");
const bundle = await build({
  absWorkingDir: root,
  entryPoints: ["src/standalone.tsx"],
  bundle: true,
  write: false,
  outdir: "standalone-output",
  format: "iife",
  platform: "browser",
  target: ["es2022"],
  jsx: "automatic",
  minify: true,
  legalComments: "inline",
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [
    {
      name: "offline-assets",
      setup(builder) {
        builder.onResolve({ filter: /^next\/link$/ }, () => ({
          path: "link",
          namespace: "offline-link",
        }));
        builder.onLoad({ filter: /.*/, namespace: "offline-link" }, () => ({
          contents:
            'import {createElement} from "react"; export default function Link(props){return createElement("a",props)}',
          resolveDir: root,
        }));
        builder.onResolve({ filter: /^\/fonts\// }, (args) => ({
          path: resolve(root, "public", args.path.slice(1)),
        }));
      },
    },
  ],
  loader: { ".woff2": "dataurl" },
});
const js = bundle.outputFiles.find((file) => file.path.endsWith(".js"))?.text;
const css = bundle.outputFiles.find((file) => file.path.endsWith(".css"))?.text;
if (!js || !css) throw new Error("The offline bundle is incomplete.");
const fontLicense = await readFile(
  resolve(root, "public/fonts/OFL.txt"),
  "utf8",
);
const html = `<!doctype html>
<!-- DM Sans font license:
${fontLicense.replaceAll("--", "- -")}
-->
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>RevenueRescue · Interactive demo</title>
<style>${css.replaceAll("</style", "<\\/style")}</style></head><body><div id="root"></div><noscript>Enable JavaScript to explore this interactive demonstration. All examples are fictional.</noscript><script>${js.replaceAll("</script", "<\\/script")}</script></body></html>`;
await mkdir(destination, { recursive: true });
await writeFile(resolve(destination, "revenuerescue-demo.html"), html);
await writeFile(
  resolve(destination, "SHA256SUMS"),
  `${createHash("sha256").update(html).digest("hex")}  revenuerescue-demo.html\n`,
);
console.log(
  `Created integrated/revenuerescue-demo.html (${Math.ceil(Buffer.byteLength(html) / 1024)} KB).`,
);
