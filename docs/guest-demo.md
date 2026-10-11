# Guest demo guide

RevenueRescue helps illustrate one clear shop workflow: **read the inquiry, prepare a follow-up, approve it, confirm a visit, and record the outcome**. This version uses a fictional salon named Juniper Studio. No account is required.

## Which version to open

The readable application lives in `apps/revenuerescue/`. Its README contains the local development and verification commands. The generated browser-ready version is `integrated/revenuerescue-demo.html`; open that file in a browser once it has been generated. It is a packaged guest interface, not a connection to a live customer system.

The original donation story wall and HeartOps volunteer interface remain in `demos/` as historical visual prototypes. They are not additional features of the current salon demo.

## A short demonstration

| Step | What to do | What it demonstrates |
| --- | --- | --- |
| 1 | Open the guest workspace and select Lena in **Today**. | A manager sees the request and a useful next action. |
| 2 | Prepare the sample draft, edit it, approve it, and simulate sending. | The manager controls the exact message. Editing removes approval; a second sample send is blocked. |
| 3 | Open Jamie in **Appointments** and choose **Change time**. Select an available replacement and confirm it. | One shared appointment schedule prevents overlap. The old time stays reserved until the change succeeds. |
| 4 | In **Customers**, choose **Try a voice example**. Review the transcript and uncertain details before adding the inquiry. | Different phrases, corrections, and ambiguity need interpretation and clarification. The demonstration does not claim live speech recognition. |
| 5 | Record a sample sale and view **Results**. | Follow-ups, confirmed appointments, and staff-reported sales remain different measures. |
| 6 | Reset the demo. | The original fictional examples are restored. Refreshing the page also discards changes. |

Use **Show me how** at any point for the in-page walkthrough. Use fictional names and `.test` email addresses when adding your own examples.

## Rules worth trying

- Try sending before approval. The action is refused.
- Approve a draft, then change its wording. It must be approved again.
- Open Alex's inquiry. A local draft can be prepared and edited, but approval and simulated sending are blocked because contact permission is missing.
- Add a voice or walk-in request with no email and permission off. The request can be reviewed, but no follow-up can be sent.
- Choose a time already occupied by the same stylist. It is unavailable. The other stylist has separate capacity.
- Move a visit to an available time. The same appointment changes; it is not duplicated.
- Cancel a confirmed visit. Its capacity becomes available, and a booked inquiry returns to open.
- Try closing a customer without a sale while their appointment remains confirmed. Cancel the appointment first.
- Change a reported sale amount. Results use the current record rather than repeatedly adding the old amount.

The fixed sample week is October 12–16, 2026, 9 AM–5 PM, New York time. Dates are intentionally anchored for a repeatable demonstration. Adjacent appointments may meet exactly at their start/end boundary; overlapping appointments for the same stylist are rejected.

## What is real in this version

The interface, in-memory state transitions, editable sample messages, explicit approvals, shared appointment-capacity rules, and calculated sample results work locally. The sample drafting step uses a template. Voice content consists of fictional, prewritten examples.

No actual customer messages or calls are sent. No microphone recording, transcription, AWS service, AI model, real authentication, shared database, checkout, or payment processor is connected in this guest interface. “Sale recorded” means a staff-reported sample amount. It does not mean money was collected or independently verified.

All changes last only for the current page session. Do not enter personal or confidential customer information. This is a workflow demonstration, not an operational customer record system.

## Verification commands

Run from `apps/revenuerescue/`:

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run bundle:demo
npm run dev
```

Automated checks should be paired with a desktop/mobile browser walkthrough of both the readable application and the generated integrated file. A successful local check does not establish live AWS, email, telephone, or payment readiness.

## Repository delivery

Keep code, documentation, comments, and commit messages in English. Deliver on the private `codex/revenuerescue-product` branch, with readable application code, integrated output, historical demos, and documentation in separate directories. Leave `main` and its event brief unchanged. Do not upload private onboarding documents, model review transcripts, credentials, or customer records.
