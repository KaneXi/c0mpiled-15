import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
const root = resolve("../.."),
  destination = resolve(root, "integrated"),
  staging = resolve(".local/relay-release");
const dirty = execFileSync(
  "git",
  ["status", "--porcelain", "--", "apps/revenuerescue", "infra"],
  { cwd: root, encoding: "utf8" },
).trim();
if (dirty)
  throw new Error("Commit the readable source before packaging Relay.");
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
await rm(staging, { recursive: true, force: true });
await mkdir(`${staging}/server`, { recursive: true });
await mkdir(destination, { recursive: true });
await cp(".next/standalone", `${staging}/server`, { recursive: true });
await cp("public", `${staging}/server/public`, { recursive: true });
await cp(".next/static", `${staging}/server/.next/static`, { recursive: true });
await cp(".local/relay-web", `${staging}/website`, { recursive: true });
await cp(".local/lambda/function.zip", `${staging}/function.zip`);
await cp(`${root}/infra/aws.json`, `${staging}/aws.json`);
const checksum = async (path) =>
  createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
const manifest = {
  product: "Relay",
  sourceCommit,
  node: process.version,
  lockfileSha256: await checksum("package-lock.json"),
  lambdaSha256: await checksum(`${staging}/function.zip`),
  scope:
    "Persistent fictional volunteer workflow. Real Bedrock when configured; telephone transport simulated. No production payments.",
};
await writeFile(
  `${staging}/README.txt`,
  "Relay requires Node.js 22.13 or later in the 22.x series. From server/: RELAY_WORKER_ENABLED=true PORT=3008 HOSTNAME=127.0.0.1 node server.js. Open http://localhost:3008. To enable real Bedrock with an authenticated AWS profile, also set RELAY_AI_ENABLED=true AWS_PROFILE=revenuerescue AWS_REGION=us-east-2. No credentials are included. Without Bedrock, explicitly choose manual simulator outcomes. Website and function.zip are the AWS deployment artifacts; see readable docs for setup.\n",
);
await writeFile(
  `${staging}/manifest.json`,
  JSON.stringify(manifest, null, 2) + "\n",
);
const archive = `${destination}/relay-release.zip`;
await rm(archive, { force: true });
execFileSync("zip", ["-q", "-r", archive, "."], { cwd: staging });
await writeFile(
  `${destination}/release-manifest.json`,
  JSON.stringify(manifest, null, 2) + "\n",
);
await writeFile(
  `${destination}/SHA256SUMS`,
  `${await checksum(archive)}  relay-release.zip\n`,
);
console.log(`Relay package generated from ${sourceCommit}.`);
