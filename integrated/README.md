# Integrated deliveries

**Relay is the current product:** a nonprofit volunteer scheduling and replacement workflow. Its readable source is in [`../apps/revenuerescue/`](../apps/revenuerescue/). The owner authorized merging the complete product into `main`. Continue new work on separate feature branches.

The target public address is [rescue.kanexi.me](https://rescue.kanexi.me). Deployment is verified; consult [build status](../docs/BUILD_STATUS.md) for verified availability.

## Current source and AWS artifacts

- `relay-source.zip`: complete tracked source snapshot excluding this generated-artifact directory, dependency folders and private local configuration. `source-manifest.json` records its source commit and checksum. Start with `docs/TEAM_HANDOFF.md` after extracting it.
- `relay-sample-voice-aws.zip`: latest website, API Lambda and voice Lambda with documentation. Includes the subscription offer; checkout remains unavailable. `sample-voice-manifest.json` identifies its source and checksum. This archive requires existing AWS infrastructure and private configuration; it is not a standalone local server.

## Older standalone baseline

`relay-release.zip` is an older runnable baseline artifact produced by the packaging command. It contains the standalone Next.js server, static website, Lambda bundle, infrastructure template, and a source-commit manifest. No credentials or private onboarding materials belong in the package.

After extracting a generated package, use Node.js 22.13 or later in the 22.x series and run from its `server/` directory:

```sh
RELAY_WORKER_ENABLED=true PORT=3008 HOSTNAME=127.0.0.1 node server.js
```

Open `http://localhost:3008`. Keep the server running for automatic local monitoring. SQLite persists local fictional records across restarts. To enable real Bedrock, add `RELAY_AI_ENABLED=true`, an authenticated `AWS_PROFILE`, and the appropriate `AWS_REGION` to that environment. Without AI enabled, explicitly select a labeled manual simulator outcome. Telephone transport remains simulated in both cases. No payments are enabled.

Regenerate the release from the readable app directory after validating and committing its source:

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run build:web
npm run build:lambda
npm run package:release
```

`release-manifest.json` identifies the packaged source commit; `SHA256SUMS` verifies the generated archive. Do not edit generated bundles manually. See the [guest demo guide](../docs/guest-demo.md) for the complete workflow and current limitations.

## Archived prototype

**`revenuerescue-demo.html` is an archived RevenueRescue prototype, not the current Relay application.** It preserves the earlier business/volunteer browser demonstration for reference. Its operational data resets on refresh, its AWS assistant is unavailable, and it does not represent the durable Relay workflow or current deployment.

The archived HTML bundles React, React DOM, Luxon, Lucide, and DM Sans. Retain its bundled license notices; the font license is in [`../apps/revenuerescue/public/fonts/OFL.txt`](../apps/revenuerescue/public/fonts/OFL.txt).
