# RevenueRescue guest demo

A small, interactive workspace for a shop owner to follow up on inquiries, confirm appointments, and record outcomes. The fictional Juniper Studio salon demonstrates the flow without an account or setup.

**This release is a guest demo.** All supplied people, inquiries, appointments, and amounts are fictional. Changes stay in React memory and reset when the page refreshes. No email, text, telephone call, payment, AWS request, or AI inference is performed. Do not enter real customer information.

## Open the readable application

Use Node.js 22.13 or later in the Node 22 release line and npm. Run these commands from `apps/revenuerescue/`:

```sh
npm ci
npm run dev
```

Open `http://localhost:3008/`, then enter the guest workspace. The application is available directly at `http://localhost:3008/demo`.

To check and build the application:

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

To serve a completed production build locally:

```sh
npm start
```

There are no application credentials or environment secrets to configure for this guest demo. Installing dependencies may require a network connection; the product interactions do not call external services.

## Try the main flow

1. In **Today**, open Lena's inquiry and choose **Prepare a draft**. The text comes from a deterministic sample template.
2. Edit the message if desired, choose **Approve draft**, and then **Simulate sending**. Approval and sending are separate; editing clears approval. Nothing is actually sent.
3. In **Appointments**, move Jamie's existing visit. The original remains confirmed until an available replacement is explicitly confirmed.
4. In **Customers**, try a voice example or add an inquiry using fictional details. Voice examples demonstrate reviewed text and uncertainty; they do not record or transcribe audio.
5. Record a sample sale and view **Results**. The total is staff-reported value, not a verified payment.
6. Use **Reset demo** to restore the original examples. **Show me how** opens the guided walkthrough.

The sample schedule covers October 12–16, 2026, from 9 AM to 5 PM in `America/New_York`. Maya and Theo can each hold one appointment at a time. Appointment requests do not reserve capacity. The model permits durations of 15–120 minutes in 15-minute steps and rejects overlap, off-grid times, and visits that run beyond closing.

## Code map

| File or directory                  | Purpose                                                             |
| ---------------------------------- | ------------------------------------------------------------------- |
| `src/app/`                         | Welcome page, guest route, shared layout and styles                 |
| `src/components/DemoApp.tsx`       | Today, Customers, Appointments and Results screens                  |
| `src/components/GuidedTour.tsx`    | Walkthrough and navigation guidance                                 |
| `src/components/VoiceExamples.tsx` | Explicitly simulated caller examples                                |
| `src/domain/demo-types.ts`         | Shared inquiry, appointment and action types                        |
| `src/demo/model.ts`                | Fictional initial state, approvals, outcomes and scheduling rules   |
| `src/demo/voice-examples.ts`       | Sample transcripts and interpretation explanations                  |
| `tests/`                           | Meaningful behavior checks, including approval and scheduling rules |

The pure state model is the source of truth for business behavior. Failed actions preserve the original state. Components must not reimplement those rules or silently bypass errors.

## Readable and integrated deliveries

- **Readable version:** this directory, `apps/revenuerescue/`.
- **Integrated version:** repository-root `integrated/revenuerescue-demo.html`, generated from the guest interface for direct browser use. It remains a demo, not a production backend.
- **Earlier visual prototypes:** repository-root `demos/story-wall/` and `demos/heartops/`, labeled as historical samples.
- **Walkthrough and limits:** repository-root `docs/guest-demo.md`.

Keep generated output synchronized with the readable source; do not maintain a separate manual implementation. Verify the integrated artifact independently after generation.

Generate it from this app directory with:

```sh
npm run bundle:demo
```

The output path from this directory is `../../integrated/revenuerescue-demo.html`.

GitHub delivery belongs on the separate `codex/revenuerescue-product` branch in the private hackathon repository. Do not merge or push these product files into `main`.

## Current limits

The demo has no real login, durable database, AWS connection, Bedrock model, speech recognition, telephone number, outbound provider, calendar integration, or payment processing. A checked contact-permission box refers only to a fictional example. The demo is suitable for explaining and testing the intended workflow, not handling live customer operations or collecting money.
