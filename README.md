# Relay — volunteer coordination

Relay helps a nonprofit manager publish a schedule, confirm attendance and fill gaps through a short approved outreach plan.

**Public workspace:** https://rescue.kanexi.me/

This branch contains a fictional guest demonstration. Calls are explicitly simulated. The deployed Amazon Bedrock integration interprets full conversation text. No real telephone calls or payments are made.

First visit: choose **Take a quick tour** for a skippable guided walkthrough. Use **Help** to replay it.

## One workflow

Publish the sample meal-packing shift. Relay starts a simulated check-in automatically. Enter a cancellation, approve the replacement plan with **Yes**, decline the first replacement offer, and accept the second. Relay assigns one replacement and stops outreach. **No** rejects a plan. **Assign myself** validates the manager's availability and qualifications. **Pause AI Calls** stops new calls while preserving the queue and history.

## Source and integrated release

- `apps/revenuerescue/`: readable Next.js, TypeScript and React source. The directory name is retained from the preserved prototype.
- `apps/revenuerescue/src/relay/`: canonical contracts, deterministic workflow, persistent server and Bedrock provider.
- `infra/`: reproducible AWS infrastructure.
- `integrated/relay-release.zip`: generated runnable server plus website/Lambda distribution with a source-commit manifest and checksums.
- `docs/API_CONTRACTS.md`, `docs/DECISIONS.md`, `docs/BUILD_STATUS.md`: integration truth and verification status.

The original commercial prototype is preserved in Git history. Main remains event-only; no automatic merge is authorized.

## Local development

Use Node.js 22.13 or later in the 22.x series.

```sh
cd apps/revenuerescue
npm ci
AWS_PROFILE=revenuerescue AWS_REGION=us-east-2 RELAY_AI_ENABLED=true npm run dev
```

Open http://localhost:3008/. Use an authenticated AWS profile with permission to invoke the configured model. No credentials belong in Git. Omitting `RELAY_AI_ENABLED=true` explicitly disables AI; the simulator then requires a manually selected outcome and labels it accordingly.

SQLite saves local fictional tenant data under `.data/`, which is ignored by Git. Guest sessions last two hours; cloud demo records expire after one day. Refreshing the browser does not reset the workspace. Use **Reset demo** deliberately to start over.

```sh
npm run typecheck
npm run lint
npm test
npx tsx --test src/components/relay/*.test.ts
npm run build
npm run build:web
npm run build:lambda
```

Commit the readable source before running `npm run package:release`. The manifest records the source commit and artifact checksums. See `docs/relay-aws.md` for integration boundaries.
