import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve("../..");
const staging = resolve(".local/release");
const integrated = resolve(root, "integrated");
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
const dirty = execFileSync(
  "git",
  ["status", "--porcelain", "--", "apps/revenuerescue", "infra"],
  { cwd: root, encoding: "utf8" },
).trim();
if (dirty)
  throw new Error(
    "Commit the readable application and infrastructure before packaging the release.",
  );
await rm(staging, { recursive: true, force: true });
await mkdir(staging, { recursive: true });
await mkdir(integrated, { recursive: true });
await cp("out", `${staging}/website`, { recursive: true });
await cp(".local/lambda/function.zip", `${staging}/function.zip`);
await cp(`${root}/infra/aws.json`, `${staging}/aws.json`);
const hash = async (path) =>
  createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
const manifest = {
  sourceCommit,
  node: process.version,
  lockfileSha256: await hash("package-lock.json"),
  lambdaSha256: await hash(`${staging}/function.zip`),
  infrastructureSha256: await hash(`${staging}/aws.json`),
  scope:
    "Public AWS guest demonstration with fictional records; production payments and external messages unavailable.",
};
await writeFile(
  `${staging}/release-manifest.json`,
  `${JSON.stringify(manifest, null, 2)}\n`,
);
const archive = `${integrated}/aws-release.zip`;
await rm(archive, { force: true });
execFileSync("zip", ["-q", "-r", archive, "."], { cwd: staging });
await writeFile(
  `${integrated}/release-manifest.json`,
  `${JSON.stringify(manifest, null, 2)}\n`,
);
await writeFile(
  `${integrated}/SHA256SUMS`,
  `${await hash(`${integrated}/revenuerescue-demo.html`)}  revenuerescue-demo.html\n${await hash(archive)}  aws-release.zip\n`,
);
console.log(`Release package generated from ${sourceCommit}.`);
