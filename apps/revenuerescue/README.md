# Relay application

Read the repository README and `docs/API_CONTRACTS.md` for the supported workflow and commands.

- `src/components/relay/`: manager UI and one API client.
- `src/relay/contracts.ts`: shared validated inputs and types.
- `src/relay/engine.ts`: schedule ownership, permissions, ranking, approvals, sequential outreach and atomic replacement.
- `src/relay/server/`: SQLite/DynamoDB persistence, session boundaries, optimistic concurrency, usage admission and automatic monitoring.
- `src/relay/providers/agent.ts`: bounded real Bedrock interpretation; no keyword engine or fake fallback.
- `src/app/api/relay/[operation]/route.ts`: local Next.js API.
- `src/relay/server/lambda.ts`: hosted adapter for the same API/service.

The public guest app stores fictional operational records in DynamoDB and uses opaque manager-demo sessions. It does not implement production Cognito membership, real calls or production payment. Local mode uses SQLite. Every call record distinguishes transport from interpretation provider.

The old `src/demo/` and legacy components are preserved reference code and are not exposed by the active routes.
