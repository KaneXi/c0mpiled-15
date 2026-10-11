# Relay API contract

Canonical schemas and types: `apps/revenuerescue/src/relay/contracts.ts`.

- `POST /api/relay/session` `{}` creates an opaque HttpOnly guest-manager session and a separate persistent fictional tenant. The client never chooses its tenant.
- `GET /api/relay/state` returns `RelayView`. It reads current state; it does not initiate ordinary check-ins.
- `POST /api/relay/command` accepts `CommandEnvelope`, including a UUID requestId and expectedRevision. Same-origin required. Successful response is `RelayView`. Stale version: 409; bad input: 400; unavailable provider: 503. `SUBMIT_CALL` represents the other side of a clearly simulated call, not manager initiation of ordinary calls.
- A server worker independently monitors published shifts, queues due check-ins and starts the next eligible simulated call. Pause, permission, quiet hours, opt-out, assignment eligibility and approved outreach scope are revalidated server-side.
- No operational business logic in React. All UI mutations use this API.

Engine interface (Role A workflow): `createRelayState(tenantId, nowISO)`; `applyCommand(state, DomainCommand, nowISO): RelayState`; `monitor(state, nowISO): RelayState`; `startNextCall(state, nowISO): RelayState`; `completeCall(state, callId, Interpretation, provider, transcript, nowISO): RelayState`; `eligibleCandidates(state, shiftId, nowISO): Candidate[]`; `coverage(state, shiftId): {required, assigned, confirmed, gap, status}`. Throw Error with an actionable message on invalid commands. Return unchanged state reference for no-op ticks. The repository owns revision increments and atomic compare-and-swap; engine functions never increment revision. Engine functions are pure and do not mutate their input.

Default transport is simulated. Free-text interpretation uses Bedrock when enabled; a provider failure is reported and cannot silently become success. Explicit structured manual-simulator results are allowed only when AI is disabled and visibly labeled. No keyword interpretation engine.
