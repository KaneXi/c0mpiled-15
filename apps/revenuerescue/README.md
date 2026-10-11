# RevenueRescue + HeartOps

An online AWS-powered guest application for customer requests and volunteer coordination. A committed sample inquiry or registration automatically triggers Amazon Bedrock, checks deterministic availability tools, and publishes an internal operator notification. The operator confirms any proposed schedule change.

**Use fictional information only.** Guest business records remain in browser memory and reset on refresh. Analysis sessions and short-lived results are stored on AWS. This is a public demonstration, not a customer account system. It does not send external messages, receive telephone calls, transcribe audio, or collect payments.

## Open and develop

The public destination is [rescue.kanexi.me](https://rescue.kanexi.me). See the repository deployment notes for verified release status.

Use Node 22.13 or later in the Node 22 line:

```sh
npm ci
npm run dev
```

The local interface opens at `http://localhost:3008`. Live analysis requires the deployed same-origin AWS API; the static development server does not impersonate AWS.

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run build:lambda
npm run bundle:demo
```

## Try the online workflow

1. Enter the guest workspace and choose Business or Volunteers.
2. Choose **Simulate incoming request**, or add fictional text in the intake form.
3. Wait for **Your assistant’s updates**. The request is analyzed by Amazon Bedrock and checked against the sample schedule. Open the provenance details to see the actual model and tools.
4. Review the suggested time or clarification. A notification alone changes no booking, assignment, message approval, or completion.
5. Confirm a current suggestion. Changes made after analysis make the suggestion stale; the reducer checks the current schedule again.
6. Switch modes, explore the guided tour, or reset the active demo. Committed changes in the other mode remain intact until refresh.

The business schedule is October 12–16, 2026, 9 AM–5 PM, America/New_York, with 15-minute boundaries. Volunteer completion uses a fixed simulation clock of October 12 at noon; completed hours are recorded only after the shift ends. Registration is not assignment, and assignment is not completed attendance.

Optional sample follow-up drafts and simulated sending remain deterministic demonstrations and are labeled separately from the real AWS analysis. Voice examples are prewritten text, not speech recognition. Staff-reported business sales are not verified payments.

## Source map

| Location | Responsibility |
| --- | --- |
| `src/app/` | Welcome page, static guest route and shared styles |
| `src/components/DemoApp.tsx` | Shared Business / Volunteers shell |
| `src/components/VolunteerWorkspace.tsx` | Volunteer registration, shifts and results |
| `src/components/AgentNotifications.tsx` | Automatic analysis, notifications and confirmation |
| `src/demo/` | Pure fictional state, deterministic scheduling and version guards |
| `src/domain/agent-types.ts` | Minimal snapshot projection and API contracts |
| `src/server/` | Lambda, Bedrock tools, validation, sessions and durable quotas |
| `tests/` | Workflow, scheduling, quotas and trust-boundary checks |
| `../../infra/aws.json` | Private S3, CloudFront, HTTP API, Lambda and DynamoDB |
| `../../docs/deployment.md` | Deployment, limits and shutdown instructions |

## Separate deliveries

- Readable source: `apps/revenuerescue/` and `infra/`.
- Generated offline preview: `integrated/revenuerescue-demo.html`. It makes no AWS calls; the live assistant is explicitly unavailable.
- Generated deployment package: `integrated/aws-release.zip`, assembled from the same source and lockfile.
- Earlier visual studies: `demos/story-wall/` and `demos/heartops/`.

All product code belongs on the private `codex/revenuerescue-product` branch. Keep `main` unchanged. Never commit `.local/`, credentials, login caches, private onboarding documents, or live customer information.
