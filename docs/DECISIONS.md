# Decisions

## 2026-10-11 — Relay scope supersedes RevenueRescue guest scope

The user adopted the supplied Relay operating manual and explicitly waived the ChatGPT/Claude planning and review process: "No review process needed; do it directly." The active product is nonprofit volunteer operations only. Existing commercial code is a preserved prototype, not active product functionality.

The owner has already authorized implementation, private GitHub delivery away from main and domain deployment. That does not authorize real calls, phone purchases or live payments. Test-only AWS App Monetization remains a required but access-dependent deliverable.

The current prototype is preserved at commit ca23540. Migration branches build on that unmerged source baseline because main is intentionally event-only. Separate per-role worktrees avoid shared working-directory edits. Integration and PRs remain separate from main; no self-merge.

Local mode uses server-side SQLite persistence and opaque guest-manager sessions scoped to fictional tenants. Cloud persistence uses a separately configured AWS adapter. A server worker, not a browser button, plans routine check-ins. Next.js route handlers own local API behavior. Contact transport is explicitly simulated until Connect setup and real-contact permission are verified. Human-created published schedules and bounded manager-approved replacement plans are authoritative.

The user waived model review, not correctness tests, permission checks, data isolation or truthful provider labels. Product completion requires documented evidence; missing AWS services must remain labeled blocked.
