# Relay build status

Updated 2026-10-11. Status reflects implementation and verification, not planned work.

| Area | Status | Evidence / remaining work |
|---|---|---|
| Shared contract and nonprofit UI | Implemented; tests passing | Relay dashboard with first-visit opt-in, six-step spotlight tour and Help replay; appearance still needs browser verification |
| Manager scheduling and constraints | Implemented; tests passing | Human-only publish, phone validation, role/availability/overlap guards |
| Automatic workflow and approved replacement | Implemented; tests passing | Pause, consent, quiet hours, retries, frozen candidate lists, stale results and single replacement |
| Local persistence and guest isolation | Implemented; tests passing | SQLite restart/readback, opaque sessions, tenant isolation, command receipts and version conflicts |
| Bedrock semantic interpretation | WORKING in the guest release | Deployed Nova Lite interpreted a correction, replacement decline and acceptance in the complete public smoke test |
| Public AWS hosting | WORKING in the guest release | https://rescue.kanexi.me; CloudFormation UPDATE_COMPLETE; public state persistence and complete workflow verified |
| Live telephone transport | Blocked / not enabled | Connect configuration and explicit real-contact authorization required |
| Production identity and organization membership | Not implemented | Current access is fictional guest-manager sessions only |
| Official AWS App Monetization | Blocked / not implemented | Organizer skill/token and verified test checkout required; no direct Stripe integration |
| AWS Cost Anomaly Detection notifications | Not configured | Owner must select alert destination and threshold |
| Browser visual verification | Blocked | Browser safety-policy verification currently rejects navigation; no screenshot-based completion claim |

No production phone call or payment is represented as completed. No change has been merged to main.

## Verified checks

- 131 automated tests across nine suites, plus six UI API and guided-tour tests: passed.
- TypeScript, ESLint, production Next.js build, website bundle and Lambda bundle: passed.
- Public end-to-end smoke: passed on 2026-10-11 at 20:19 UTC, with three real Bedrock interpretations, manager approval, pause/resume, one replacement, stopped outreach, idempotent replay and persistent DynamoDB readback.
- Independent scheduled worker: verified on the public deployment at 20:22 UTC. A future check-in started after publication without any further mutation request.
- UI interaction and appearance have not been visually verified because browser policy checks blocked access.

Implementation is delivered on a feature branch for review. No claim of a reviewed merge is made. The full operating manual is not complete while the external integrations above remain absent.
