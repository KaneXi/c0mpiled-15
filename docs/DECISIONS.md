# Decisions

## 2026-10-11 — Relay scope supersedes RevenueRescue guest scope

The user adopted the supplied Relay operating manual and explicitly waived the ChatGPT/Claude planning and review process: "No review process needed; do it directly." The active product is nonprofit volunteer operations only. Existing commercial code is a preserved prototype, not active product functionality.

The owner has already authorized implementation, private GitHub delivery away from main and domain deployment. That does not authorize real calls, phone purchases or live payments. Test-only AWS App Monetization remains a required but access-dependent deliverable.

The current prototype is preserved at commit ca23540. Migration branches build on that unmerged source baseline because main is intentionally event-only. Separate per-role worktrees avoid shared working-directory edits. Integration and PRs remain separate from main; no self-merge.

Local mode uses server-side SQLite persistence and opaque guest-manager sessions scoped to fictional tenants. Cloud persistence uses a separately configured AWS adapter. A server worker, not a browser button, plans routine check-ins. Next.js route handlers own local API behavior. Contact transport is explicitly simulated until Connect setup and real-contact permission are verified. Human-created published schedules and bounded manager-approved replacement plans are authoritative.

The user waived model review, not correctness tests, permission checks, data isolation or truthful provider labels. Product completion requires documented evidence; missing AWS services must remain labeled blocked.

## 2026-10-11 — Public, read-only owner phone test

The owner authorized one call to their own US number with a $1 incremental budget and a two-minute limit, then asked to pause until the schedule and progress were visible on the website. The owner subsequently requested public visibility. The website exposes the designated test at `/?phone-test=1`, with a homepage link, the actual name and shift, masked phone suffix and factual progress. No phone number has been claimed or dialed at this checkpoint. Amazon Connect instance creation is verified; speech playback is prepared but not published. Free-form voice conversation remains unimplemented.

`RELAY_PUBLIC_TEST_TENANT` selects exactly one existing tenant. The public GET does not create a session or grant write access. The test workspace is read-only even with its existing session; the automatic simulator worker also skips it. Only trusted AWS/operator updates may advance the test record, based on actual evidence. The original proposal for a private magic link was removed before final delivery. Personal test configuration, session credentials and deployment secrets remain ignored and are excluded from release archives.

The test remains paused after the user's interruption. Completing or ending a phone call must not mark attendance confirmed. Any eventual dialing must honor the previously authorized single destination, consent, duration and budget, and release the temporary caller number afterward.

## 2026-10-11 — Explicit four-person sample reset

The owner requested a testable sample schedule. The existing RESET_DEMO command now accepts an optional sample selector; old clients keep the original seed. The four-person sample is loaded only after the existing destructive-reset confirmation, affects only the current guest tenant, starts paused with drafts and fictional contacts, and uses the unchanged scheduling and simulation services. It does not modify the public real-phone tenant or enable Connect. Dates are regenerated relative to load time. The original seed and independent voice work are preserved.

## 2026-10-11 — Authorized bounded two-person outbound test

The owner provided the second consenting test participant and explicitly requested testing. A separate paused real-name tenant was prepared, with two total outbound attempts, one eligible replacement and a one-hour future shift. A presenter start authorizes this specific bounded automatic-refusal workflow; ordinary guest workspaces retain manager approval. The actual result was original refusal, automatic replacement call, then uncertainty with no assignment. The number was released and the worker disabled. This authorization is not a general dialing permission or authorization to repeat the sequence indefinitely.

The owner requested clearer replacement questions. Initial questions, follow-ups and successful-confirmation receipts now use deterministic local-time windows. Bedrock receives explicit local ISO times. Historical test results are preserved rather than rewritten as successful outcomes.
