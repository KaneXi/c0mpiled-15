# Relay — volunteer coordination

**Complete current source branch:** [`feat/relay-sample-schedule`](https://github.com/KaneXi/c0mpiled-15/tree/feat/relay-sample-schedule) · **[Draft PR #6](https://github.com/KaneXi/c0mpiled-15/pull/6)**

Start with **[TEAM_HANDOFF.md](docs/TEAM_HANDOFF.md)** for setup, source ownership, deployment boundaries and the remaining official AWS payment integration. All current application source is included on this branch. `main` stays event-only; no merge or replacement of teammates' work is implied.

## Public entry points

- [Guest workspace](https://rescue.kanexi.me/): fictional schedules, guided help, automatic simulated check-ins and manager-approved replacement plans.
- [Real telephone demonstration](https://rescue.kanexi.me/?phone-test=1): presenter-controlled roster, exact shift times and scheduled outreach. AWS runs it independently of the browser. Only a configured consenting allowlist can receive calls.
- [Subscription offer](https://rescue.kanexi.me/?plan=1): first month free, then $4.99 USD/month. **Checkout is not connected and no payment is collected.**

The previous real test verified an original volunteer's spoken refusal and an automatic replacement call. The replacement response was uncertain, so no replacement was assigned. The revised timed website workflow and successful telephone acceptance still need a presenter-run end-to-end test. Guest sessions are not production customer accounts.

## Readable source and packaged copies

| Location | Contents |
| --- | --- |
| `apps/revenuerescue/` | Complete readable Next.js/TypeScript source, lockfile, fonts, tests and build scripts. The directory name is historical. |
| `apps/revenuerescue/src/relay/` | Scheduling engine, shared contracts, Bedrock interpretation, persistence, API and real outbound voice handler. |
| `infra/` | Core CloudFormation template and generator. Connect/Lex resources require separate configuration; see the handoff. |
| `integrated/relay-source.zip` | Downloadable source snapshot, excluding other generated archives and all local secrets. Check its source manifest. |
| `integrated/relay-sample-voice-aws.zip` | Current static website plus API/voice Lambda bundles and documentation. Requires existing infrastructure/configuration. |
| `integrated/relay-release.zip` | Older standalone Next.js baseline. It is retained for reference, not the latest website/voice release. |
| `docs/` | API, sample schedules, phone controls, pricing and handoff instructions. Earlier dated status notes are historical. |

## Run locally

Use Node.js 22.13 or later in the 22.x series.

```sh
git clone --branch feat/relay-sample-schedule https://github.com/KaneXi/c0mpiled-15.git
cd c0mpiled-15/apps/revenuerescue
npm ci
cp .env.example .env.local
npm run dev
```

Open http://localhost:3008/. Without `RELAY_AI_ENABLED=true` and an authenticated AWS profile, AI is explicitly unavailable and the simulator accepts manually selected outcomes. Real telephone infrastructure and billing are not enabled by installing the source. SQLite persists fictional local data under ignored `.data/`.

## Verify and build

```sh
npm run typecheck
npm run lint
npm test
npx tsx --test src/components/relay/*.test.ts
npm run build
npm run build:web
npm run build:lambda
node scripts/build-voice.mjs
```

Never commit the registry token, private `.npmrc`, `.env.local`, presenter code, real test roster, AWS login cache or customer conversation data. The teammate should install the official monetization tooling privately and open their own feature branch from this source branch.
