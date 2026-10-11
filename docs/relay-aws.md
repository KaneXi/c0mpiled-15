# Relay AWS integration status

Updated October 11, 2026. This is a fast core release for fictional nonprofit workflows. It does **not** complete every requirement in the Relay operating manual.

## Current deployment

The Relay frontend and backend are deployed to the existing AWS stack, with AI enabled. The domain [rescue.kanexi.me](https://rescue.kanexi.me) has valid DNS and a certificate. CloudFormation reached `UPDATE_COMPLETE`; the public smoke test passed at **2026-10-11 20:19:39 UTC** (4:19:39 PM Eastern).

- **Hosted:** private S3 and CloudFront serve the interface; API Gateway and Lambda run the shared Relay services; DynamoDB persists fictional tenant state, sessions, workflow records and usage limits. An EventBridge worker runs every minute independently of the browser.
- **Local:** Next.js route handlers use the same services with SQLite persistence and a server worker.
- **Access:** opaque guest-manager sessions last two hours; fictional tenants expire after 24 hours. This is a guest demo with server-side tenant isolation, not Cognito accounts or durable customer onboarding.
- **Calling:** always simulated. Published schedules drive routine check-ins; managers approve replacement outreach plans. The simulated workflow enforces pause, consent, quiet hours, eligibility and bounded sequential outreach. No real telephone calls are placed.
- **Cost limits:** durable reservations cap AI analyses at 100 per day, 500 lifetime and 20 per tenant. Failed or uncertain model requests consume their reservation. These limits constrain inference usage; they are not a guarantee of zero hosting or API charges.

## Real Bedrock interpretation

`apps/revenuerescue/src/relay/providers/agent.ts` exports `createAgentProvider()`. It interprets the full supplied conversation through `amazon.nova-lite-v1:0` in `us-east-2`, then validates a structured outcome. Deterministic domain services control all schedule and workflow changes.

Each interpretation permits one SDK attempt, 8,000 transcript characters, 800 output tokens and an 18-second deadline. Low confidence or missing essential partial/late timing becomes a clarification request. Model confidence is an estimate, not a calibrated probability. Failures remain visible and never silently become simulated AI success. A simulated call can therefore have a **real Bedrock interpretation**; the two provider labels remain separate.

The parser accepts plain JSON or one complete JSON fence, then applies strict schema validation. An explicit `clarification: null` becomes an empty string; missing fields, incorrect types, surrounding prose, inconsistent times and unsupported outcomes remain rejected.

Local development selects temporary login credentials with `AWS_PROFILE=revenuerescue`. Hosted execution uses its IAM role; no local login cache or credentials are deployed. `RELAY_AI_ENABLED` controls the Relay provider. [AWS credential chain](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/setting-credentials-node.html), [Bedrock Converse](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Converse.html).

## Verified behavior

Both the local API flow and the public deployment completed three real Bedrock interpretations. The public test used the deployed IAM role:

1. Taylor corrected an earlier commitment and could no longer attend → `declined`.
2. Avery declined the replacement request → `declined`; outreach advanced to the next approved candidate.
3. Samira accepted → `confirmed`; one replacement was committed and all further outreach stopped.

The public test also verified human schedule publication, automatic check-in creation, pause blocking new outreach, resume with bounded manager approval, an idempotent completion re-submit with no revision change, and persistent DynamoDB readback at revision 15. The private nonsecret result record is `apps/revenuerescue/.local/relay-smoke-result.json`; it records all checks passing and every tested API response returning HTTP 200. This establishes the tested guest workflow, not the unfinished integrations below.

A separate post-fix replacement-decline probe returned `amazon-bedrock` / `declined` in 1,014 ms. Eighteen provider tests pass, including strict output validation, low-confidence clarification, partial availability, opt-outs, one-call bounds and honest failures. Typecheck and scoped lint passed for the provider changes. These checks establish the tested cases, not universal speech or semantic accuracy. The transcript is entered through the simulator; live speech recognition is not implemented.

Earlier fenced-JSON and nullable-clarification failures were repaired and superseded by these successful checks. Private raw fictional probe responses remain in ignored local evidence directories; no credentials or raw conversations are committed here.

## Required integrations still absent

| Integration | Remaining work |
| --- | --- |
| Amazon Connect | No real calling adapter, verified instance, phone number or published outbound flow. Requires explicit authorization for chargeable setup and calls, actual number/region eligibility, consent and recording policy, caller ID and tested contact outcome handling. Core Connect is not available in Ohio; Northern Virginia is a supported option. [Endpoints](https://docs.aws.amazon.com/general/latest/gr/connect_region.html), [outbound API](https://docs.aws.amazon.com/connect/latest/APIReference/API_StartOutboundVoiceContact.html). |
| Cognito | No account sign-in or customer membership provisioning. Requires a pool/client, callback configuration, manager roles, server token verification and tenant membership enforcement. Guest sessions do not satisfy this requirement. [Token verification](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-verifying-a-jwt.html). |
| AWS Cost Anomaly Detection | No verified monitor-and-notification subscription. Needs billing access, an approved threshold and a confirmed notification destination. This detects delayed infrastructure cost anomalies; it is neither staffing-risk detection nor an immediate spending stop. [Setup](https://docs.aws.amazon.com/cost-management/latest/userguide/getting-started-ad.html), [detection delay](https://docs.aws.amazon.com/cost-management/latest/userguide/manage-ad.html). |
| Official AWS App Monetization | No verified organizer skill integration, metering/entitlements or test checkout. The private beta requires organizer-authorized access and its documented test Stripe Connect flow. Only credit-card test payments are in scope; no direct Stripe checkout, real payments or production billing claims. Keep all private onboarding documents and registry tokens outside Git. |

The owner selected a fast core release. Real calls, persistent customer accounts, official beta billing and cost-anomaly notification remain separate unfinished deliverables; the release must not be represented as completing the full manual.
