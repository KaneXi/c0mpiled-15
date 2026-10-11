# Team handoff — complete current Relay source

Updated October 11, 2026. The owner authorized PR #6 to integrate the full source into `main` in `KaneXi/c0mpiled-15`. Use updated `main` after the merge. The branch contains the complete current app, not just a patch. The separate team-repository proposal remains review-only.

## Start and branch safely

```sh
git clone --branch main https://github.com/KaneXi/c0mpiled-15.git
cd c0mpiled-15
git switch -c feat/aws-monetization-integration
cd apps/revenuerescue
npm ci
cp .env.example .env.local
npm run dev
```

Use Node.js 22.13–22.x. Do not force-push this shared snapshot, replace main, or overwrite another developer's checkout. Commit only your feature branch and open a draft PR. Authentication to the private GitHub repository is required.

## What is included

| Task | Files |
| --- | --- |
| App routes and public plan switch | `src/app/page.tsx`, `src/app/demo/page.tsx`, `src/components/relay/RelayEntry.tsx`, `src/relay-browser.tsx` |
| Dashboard, forms and tutorial | `src/components/relay/RelayDashboard.tsx`, `Editors.tsx`, `RelayTour.tsx`, `Relay.module.css` |
| Phone test controls and live results | `src/components/relay/PhoneTestView.tsx` |
| Pricing and currently disabled checkout | `src/components/relay/SubscriptionPlan.tsx` |
| Scheduling and safe assignment | `src/relay/engine.ts`, `contracts.ts`, `seed.ts` |
| Semantic interpretation | `src/relay/providers/agent.ts` |
| API, tenant persistence and worker | `src/relay/server/` |
| Connect dispatch, Lex response handler and caller cleanup | `src/relay/voice/` |
| Local Next.js HTTP adapter | `src/app/api/relay/[operation]/route.ts` |
| Existing payment-provider status label | `src/relay/server/service.ts` |
| Deployment builds | `scripts/build-relay-web.mjs`, `build-lambda.mjs`, `build-voice.mjs` |
| Core infrastructure | repository-root `infra/aws.json`, `infra/generate-template.py` |

All paths in the table are relative to `apps/revenuerescue/` unless noted. `src/demo/`, older commercial components and `demos/` are preserved prototypes, not active Relay routes.

## Official AWS monetization handoff

The owner requests first month free, then $4.99 USD per month. The sponsor's first-payment timing is still unresolved: free-trial enrollment is $0 today; advance payment for the second month is a different offer and must be explicitly disclosed. Do not invent an immediate charge or record a free signup as paid revenue.

1. Obtain the personal registry token and official package/registry instructions from the organizer. The token is for installing private tooling; it is not an AWS access key and not a customer payment credential.
2. Configure the documented registry in an ignored local `.npmrc`, outside the Git-tracked source. Do not put the token in a PR, issue, README, screenshot, `.env.example` or browser bundle. Use the organizer's actual instructions; this repository intentionally does not redistribute confidential onboarding documents or the private package.
3. If a reviewed CI workflow needs installation, store the token as an Actions secret. Suggested team secret name: `AWS_MONETIZATION_REGISTRY_TOKEN`. This is a team naming convention, not a documented AWS runtime variable. The existing workflow does not use or expose it; adding a secret alone will not install anything. Fork PRs do not receive this credential automatically.
4. Install and inspect the official skill privately in the intended app scope. Do not send unrelated workspace files, private call records or other credentials to tooling. Keep required account/terms acceptance with the account owner.
5. Resolve customer identity with the backend owner. Current two-hour guest sessions and one-day demo records are not durable billing identities. The existing AWS access does not supply Cognito customer membership automatically.
6. Use the official generated API/SDK contracts for checkout, entitlements, metering, subscription status and verified payment events. No checkout endpoint or signature schema is guessed in this source. Do not replace the official integration with direct Stripe.
7. Bind the pricing button to official hosted checkout only after configuration is verified. Never collect card fields in this app. Show explicit test-mode labeling when using the beta. Validate the $0 first month and $4.99 renewal on the provider side, not only in frontend text.
8. Verify webhook authenticity and replay handling using the official contract. Verify the actual subscription/invoice server-side. A return URL, query string, browser click or free trial must not mark an invoice paid. Preserve errors, cancellation and pending states.
9. Run the existing checks and add integration tests for enrollment, recurring terms, duplicate events, failed/canceled checkout and tenant identity. Have the sponsor complete their own authorized checkout, then confirm the actual provider receipt. Record test evidence separately from genuine revenue.

The supplied access is evaluation-only. A registry token does not grant production billing permission. Obtain an explicitly production-permitted route before collecting real money. No payment or subscription has been completed by this handoff.

## Deployment boundary

Local development uses Next.js, SQLite and the same domain services. The hosted prototype uses S3/CloudFront for the static interface and API Gateway/Lambda with DynamoDB. The separate Connect/Lex voice runtime is in Northern Virginia, while the core and Bedrock are in Ohio.

Do not assume generated Next.js billing routes will appear in the static deployment. Review `src/relay/server/lambda.ts`, HTTP dispatch, `infra/aws.json` routes, hosting and the generated integration requirements together. Preserve the live API's private origin authentication, test tenant, allowlist and presenter settings when changing Lambda configuration.

`infra/aws.json` describes the core stack, not the complete later Connect/Lex deployment. It does not include private test identities or a portable voice bootstrap. Existing voice resources and private IDs must be obtained through the authorized account owner. Source builds never claim a telephone number or place a call. See `website-phone-control.md` for required voice environment variables and IAM behavior.

The browser's `/?phone-test=1` view shows persisted facts. The owner explicitly requires all roster changes and test scheduling to be done through the website. Do not seed or tick a new live test from an operator script. Current authorization is limited to configured consenting test participants, bounded attempts and the service window.

## Verification and limits

Read `website-phone-control.md`, `subscription-plan.md` and `sample-schedule.md` for exact behavior. Earlier build-status and AWS notes describe historical checkpoints; use this handoff and the PR check results for the current source.

- The ordinary guest flow uses simulated telephone transport and can use real Bedrock interpretation when configured.
- The previous real test verified spoken refusal and sequential replacement dialing; its replacement response was uncertain, so no assignment was made.
- Revised wording, the complete website-timed real flow and successful voice acceptance still require a presenter-run live test.
- Production customer identity, official checkout, entitlements/metering and cost-anomaly notifications are unfinished.
- No credentials, actual recipient phone numbers, presenter code, local databases, raw real conversations, private onboarding PDFs, dependency folders or downloaded private skills are part of the source snapshot.

## Handoff verification

The complete local check sequence passed: TypeScript, ESLint, 172 domain/API tests, 8 separate client/tutorial tests, optimized Next.js production build and web/API/voice bundles. An existing CI failure from reading `window` during a non-browser test was repaired with an environment guard and browser-query routing coverage. The Next.js build retains a non-fatal legacy CSS compatibility warning.

After rebuilding and committing source, run `python3 scripts/package-handoff.py` from the repository root to regenerate both the readable-source download and AWS artifacts. Their manifests record the exact source commit and SHA-256 checksums. This packaging command has no cloud side effects.
