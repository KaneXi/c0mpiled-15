# Relay guest demo

Relay coordinates nonprofit volunteer shifts. A manager publishes the schedule; Relay automatically checks attendance, identifies staffing gaps, proposes eligible replacements, and follows a bounded outreach plan after approval.

The public deployment target is [rescue.kanexi.me](https://rescue.kanexi.me). Deployment is verified; see [build status](BUILD_STATUS.md) for verified availability. Real Amazon Bedrock interpretation has passed the complete public end-to-end workflow. Phone calls are simulated, and payments are not enabled.

## Start with the guide

On your first visit, choose **Take a quick tour** or **Skip for now**. The six-step guide highlights the real schedule, volunteers, calls, attention area, pause control and activity feed. It changes views only; it never publishes a shift, places a call, submits a conversation or changes pause state. Replay it from **Help**. Back, Next, Skip and Escape are available.

## Try the workflow

1. Open a guest workspace. It contains fictional Community Table volunteers and draft shifts. Review the volunteers' roles, availability, phone numbers, and separate calling permissions.
2. Publish **Community meal packing**. Relay's background worker plans Taylor Reed's check-in automatically. Calls wait when paused or outside the volunteer's calling hours.
3. In the active simulated call, enter a fictional conversation in which Taylor can no longer attend. With AI enabled, Bedrock interprets the conversation; the server checks the result and assesses coverage.
4. Review the proposed replacement plan. **Yes** approves its named candidates and attempt limit. **No** stops the plan. **Assign myself** validates the manager's availability, role, and conflicts before assigning them.
5. After Yes, simulate Avery declining and Samira accepting. Relay contacts candidates sequentially, checks eligibility again, and commits the accepted replacement. Each call records its outcome, summary, next action, and simulated transport.
6. Try **Pause AI Calls**. New calls stop; monitoring continues. An active call may finish safely. Resume rechecks permissions and eligibility before starting another call.

Uncertain, partial, or contradictory responses require clarification rather than an invented confirmation. A provider error stays visible and requires an explicit retry; it never becomes fake AI success.

## Run the readable source

Use Node.js 22.13 or later in the 22.x series. From `apps/revenuerescue`:

```sh
npm ci
npm run dev
```

Open `http://localhost:3008`. The development command enables the background worker. Without AI enabled, choose an explicit manual simulator outcome; the app labels it accordingly. To use real Bedrock with an authenticated, permitted AWS profile:

```sh
AWS_PROFILE=revenuerescue AWS_REGION=us-east-2 RELAY_AI_ENABLED=true npm run dev
```

The profile name may be changed for another authorized local profile. No credentials are included in the repository or release package.

Validation commands are `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`. After building, `npm start` runs the local production server with its worker enabled.

## Scope and data

- Each guest session has a separate fictional tenant. This is not production organization membership or a customer login system.
- Local records persist in SQLite; hosted records use DynamoDB. Refreshing the page does not reset the operational state.
- Use fictional details only. A phone number is required, but it does not grant calling or recording consent.
- No real outbound telephone calls, messages, or payments are made. Amazon Connect, production identity, and the official test billing integration are not enabled.
- The previous commercial RevenueRescue interface is archived. The active product contains nonprofit volunteer operations only.

Readable application code is in `apps/revenuerescue`. The integrated Relay package is documented in [integrated/README.md](../integrated/README.md). Product work stays on separate feature branches; `main` remains reserved for event information.
