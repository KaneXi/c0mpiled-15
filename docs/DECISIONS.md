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
