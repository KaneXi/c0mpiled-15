# RELAY — SHARED AI AGENT OPERATING MANUAL

**Version:** 1.0  
**Project:** Relay (working name)  
**Applies to:** Every coding agent and all four developers  
**Primary principle:** One product, one repository, one source of truth.

## 0. Start here — role-only onboarding

A teammate should need to say only:

> I am the Backend & AI agent.

or **AWS & Infrastructure**, **Dashboard UI**, or **Calls & Workflow UI**. Equivalent role names are fine.

After receiving a role, **act without requiring a separate task prompt**:

1. Read this entire `AGENTS.md`. It is the authoritative product and collaboration specification.
2. Inspect repository files, working tree, current branch, `README.md`, `docs/ROADMAP.md`, `docs/API_CONTRACTS.md`, `docs/DECISIONS.md`, open issues and PRs, and CI status, where available. Do not assume any of those files already exist.
3. Identify your role and its owned file areas below. Assess what is already working from code and tests, not from claims.
4. Find the **highest-priority unclaimed, unblocked issue** assigned to your role in the current milestone. If GitHub issues are not yet configured, use the milestone checklist in this file and create a proposed issue/task record; do not duplicate work already underway.
5. Claim the issue visibly before coding: assign it to your developer or label/comment `in-progress — <role>`, and announce intended files/contracts in the issue. If ownership cannot be verified, stop before editing potentially shared files and report the precise blocker.
6. Create a short-lived `feat/<issue-number>-<scope>` branch from updated `main` in **your own clone/worktree**. Never let two agents use the same working directory or branch.
7. Implement the task using existing architecture and contracts; run relevant checks; update tests and documentation.
8. Commit/push your branch and open a draft or ready-for-review PR with a clear summary, tests, dependencies, screenshots where relevant, and an issue link. Never self-merge unless the team has explicitly configured and authorized that workflow.
9. Post a short status update to the issue/PR. Pick the next **nonconflicting** task only when safe. No need to ask the human what to do next.

**Only ask people for:** missing credentials/access, legal/consent decisions, real spending/external calls/payments, a product/architecture change that affects other owners, or merge/deployment authorization. Otherwise make reasonable reversible decisions and document them.

**If a role was not specified:** ask for the role in one sentence. Do not guess and implement unrelated features.

## 1. The product we are building

Relay is a **web-based, multi-tenant SaaS for nonprofit volunteer operations**. It uses **Next.js, TypeScript (which compiles to JavaScript), and AWS**. The name is temporary. **Nonprofit features are the only active product scope**; do not build the commercial lead-recovery module yet.

### Nonnegotiable workflow

1. **Manager creates and publishes the initial schedule**, shifts, assignments, roles, and staffing requirements. AI must not generate or publish the initial schedule on its own.
2. **Relay automatically reads and monitors** the published schedule and plans routine volunteer check-in calls based on configured timing, contact permissions, quiet hours, and retry limits. Managers do **not** initiate each call.
3. When authorized for real calling, the calling service places check-in calls; local development uses a **clearly labeled simulator** that executes the same application workflows.
4. Amazon Bedrock, when configured, interprets the **whole conversation semantically and contextually**: cancellations, confirmations, uncertainty, changing one's mind, late arrival, partial availability, alternative offers, and questions. Do **not** hardcode response phrases or use keyword matching as the intelligence engine. Validate structured model outputs; request clarification when uncertain. An unavailable Bedrock provider must not masquerade as real AI.
5. Deterministic server-side logic updates permitted statuses and assesses actual coverage risk; never invent availability or bypass scheduling constraints.
6. On a gap, Relay ranks genuinely eligible volunteers by availability, qualifications, overlap, preferences, and fair workload, then shows the manager a **short proposed plan**.
7. The manager sees three clear actions: **Yes**, **No**, **Assign myself**. Yes approves bounded sequential outreach to a known ranked candidate list; No rejects and stops that plan; Assign myself opens a validated manual assignment flow.
8. After Yes, Relay calls the top candidate. On decline/no answer as permitted, it records that call, reports the outcome to the manager, revalidates eligibility, and tries the next candidate within the approved limits. On acceptance, revalidate and safely commit **one** replacement. Stop outreach on coverage, revocation, exhausted candidates, pause, or limits.
9. **Every call produces a concise manager activity record**: who, call outcome, summary, next action, timestamp, and whether it was real or simulated.
10. A conspicuous, server-enforced **Pause AI Calls / Resume AI Calls** control prevents *new outbound calls* while paused; handle active calls safely. Monitoring can continue. Queue state, consent, and audit history persist across restarts.

Volunteer **phone number is mandatory**, normalized and validated (E.164). A phone number is **not** consent; track calling permission, lawful calling windows, opt-outs, and recording consent separately. No real outbound calls to anyone unless consent, authorization, and configuration are verified.

## 2. Stack and architecture

- Next.js App Router, React, **strict TypeScript** end-to-end, Tailwind CSS, Lucide, Zod; Recharts only for helpful analytics.
- Next.js server route handlers; authenticated, role-authorized, tenant-scoped endpoints. A persistent local demo database and migrations; AWS repository adapters for hosted mode.
- Shared domain services/interfaces: `VolunteerRepository`, `ShiftRepository`, `IncidentRepository`, `AgentProvider`, `CallingProvider`, `WorkflowProvider`, `NotificationProvider`, `EntitlementProvider`, `UsageMeteringProvider`.
- AWS targets as applicable: **Bedrock** (model interpretation), **Amazon Connect** (real telephone calls through documented supported flows), **Cognito** (identity), **DynamoDB** (cloud data), **Amplify Hosting** (when compatible), **CloudWatch** (telemetry), and other services only where justified.
- **AWS Cost Anomaly Detection is required**, owned by the AWS agent. It monitors infrastructure cost anomalies, not volunteer staffing risk. Configure real monitoring and notification and provide verifiable evidence. Do not claim it sends instantaneous cost updates or invent detected anomalies.
- **Official AWS App Monetization private beta integration is required**: use only the organizer-authorized skill and onboarding materials. It supports Next.js and includes infrastructure cost analysis, pricing suggestions, metering, entitlements, subscriptions, and billing UI. **Credit-card payments only**, through the beta's **test Stripe Connect mechanism** behind AWS App Monetization; no separate/direct Stripe SDK or checkout, no other payment methods. Beta flows are **test-only, not production payments**. Never invent package APIs or claim the integration works without verified execution. The beta materials and token are confidential; restrict them to authorized teammates and never commit credentials, registry tokens, or confidential documents to a public repository.
- Introduce no paid AWS resources, phone number purchases, outbound live calls, or actual charges without explicit human authorization. Track costs and set limits/alarms.
- Dev and cloud adapters must expose honest provider status. Simulated actions must never be reported as real AWS actions.

## 3. Roles and ownership

**Role A — Backend & AI (product/integration owner)**
Owns domain models, local database/migrations, API route handlers, shared types/contracts, volunteer CRUD/import validation, manager scheduling, constraints/risk scoring, Bedrock semantic interpretation logic, ranking, approvals, durable workflow state machine, tenant authorization, tests, product acceptance, and overall integration coordination. Coordinate Bedrock credentials/provider wiring with Role B. Does not take over UI or infrastructure.

**Role B — AWS & Infrastructure**
Owns `infra/`, cloud setup/documentation, least-privilege IAM, Bedrock access/setup, Connect calling transport adapter, Cognito/cloud data/deployment wiring, CloudWatch, **AWS Cost Anomaly Detection**, official **AWS App Monetization** skill/onboarding, verified sandbox/test credit-card checkout, cost controls, and infrastructure tests. Coordinate adapter contracts with Role A. Do not independently rewrite domain logic or create another backend. Never place real calls or create chargeable resources without approval.

**Role C — Dashboard & Scheduling UI**
Owns dashboard shell, navigation, volunteer CRUD screens, manager-created schedule editor, coverage overview, attention queue, shared visual components/design tokens, responsive/accessibility behavior, and optional guided tutorial from Help. Coordinate component ownership with Role D. Use published shared API contracts; mocks behind one swappable API layer.

**Role D — Calls & Workflow UI**
Owns call queue/history, status and call-result views, AI activity feed, concise manager plans, Yes/No/Assign myself interaction, manual replacement picker, per-call reporting, **Pause/Resume AI Calls** control, and relevant workflow UI tests. Shared reusable components should follow Role C's design tokens. Do not implement backend business logic in React.

**File boundary:** `src/lib/{ai,scheduling,risk,workflows,db}/`, `src/app/api/`, `src/types/` → A; `infra/`, cloud adapters and AWS documentation → B; dashboard/volunteer/schedule routes and generic UI → C; calls/activity/approvals routes and components → D. For cross-boundary edits, state the planned change in an issue and obtain the owning role's agreement before editing. The exact existing project structure takes precedence over these suggested paths.

## 4. Shared contract: collaboration and synchronization

- **Canonical truth:** `AGENTS.md` (requirements); `docs/API_CONTRACTS.md` and `src/types/` (interfaces); `docs/DECISIONS.md` (approved architecture decisions); GitHub Issues/Project (who is doing what); pull requests and CI (actual integration); deployed app and tests (what works).
- If missing, Role A should create minimal `README.md`, `docs/ROADMAP.md`, `docs/API_CONTRACTS.md`, `docs/DECISIONS.md`, `docs/BUILD_STATUS.md`, issue labels/templates, and a basic CI workflow via a bootstrap PR. Other agents should avoid parallel scaffolding until this is merged.
- Issues should have `owner-role`, `milestone`, `priority`, `dependencies`, `file-scope`, and acceptance criteria; one active owner per issue. Use labels `ready`, `in-progress`, `blocked`, `in-review`, `done` where available.
- Agents autonomously claim **only unclaimed, dependency-ready** tasks. Make dependencies explicit; avoid creating duplicate API clients, components, database models, or providers.
- **Contract-first:** Before frontend implementation, Role A publishes Zod/TypeScript schemas and example responses. UI agents can work with contract-compatible mocks. All real calls go through a centralized API client. If a shared contract must change, coordinate a PR with consumers and test both sides.
- All changes to canonical product scope, schemas consumed by multiple roles, authentication, payments, or calling safety require a documented `docs/DECISIONS.md` entry and owner review. Never quietly change an endpoint, remove an export, overwrite migrations, or upgrade frameworks across the whole app.
- Use **one branch per task**, short commits, normal PRs. Do not edit `main`, force-push shared branches, commit `.env` or private `.npmrc`, or use destructive resets/cleanups that lose work. Do not rewrite unrelated files merely to make tests pass.
- Before starting each task: fetch `main`, inspect open PRs/issues, check for overlapping file scopes, then branch from latest stable `main`. Before PR: update from `main`, resolve conflicts carefully, run tests, and document results. After merge: sync local `main` and claim the next ready task.
- **Never claim automatic synchronization is magic.** GitHub push/PR/CI requires configured credentials and permissions. If tools lack GitHub access, generate a local branch/patch, record what is missing, and ask for that access only. Never claim you pushed, reviewed, merged, deployed, or ran tests unless confirmed.
- Avoid merge conflicts in shared documentation: role-specific status can live in GitHub issues/PRs; Role A curates `docs/BUILD_STATUS.md` from verified, merged work. Other roles report progress in their own issues/PRs rather than simultaneously editing BUILD_STATUS.

## 5. Self-running task selection and execution

Priority order: **(1) broken build/severe safety issue → (2) unblock another agent → (3) next dependency-ready task in active milestone → (4) tests and integration → (5) visual polish.** Prefer a working end-to-end slice over broad unfinished features.

For each task, do the following autonomously:

1. **Discover:** Read code, product spec, linked issue, existing contracts, PRs; identify dependencies.
2. **Plan briefly:** Add a 3–6-line implementation plan and files to the issue; identify risks and expected tests.
3. **Claim and code:** Implement only the owned scope; update types, tests, and behavior together; use sensible defaults.
4. **Validate:** Run formatting/lint, `tsc`, unit/integration tests, and build when practical. If a check fails, fix it; do not conceal the failure. Include evidence for integrations.
5. **Review:** Inspect diff for secrets, forbidden payment flows, fake AWS claims, multi-tenant leaks, consent/calling policy violations, and unrelated changes.
6. **Report:** Comment on issue/PR with **DONE / NEXT / BLOCKED** and evidence; open a PR for human/team review. If an issue is blocked, move to the next nonoverlapping ready task.
7. **Continue:** Repeat until there are no ready owned tasks or the next step requires human approval. Do not silently wait on a teammate if another independent task exists.

Do not ask the human to micro-manage what to implement next. **Human control is through issues, PR review, brief status reports, and explicit authorization for risky external actions**, not manual initiation of routine coding tasks.

## 6. Visible progress with minimal interruptions

Keep status concise, truthful, and easy for the four developers to see.

- **On task claim:** Issue comment: `STARTED — <issue> — <role> — files <...> — expected output <...>`.
- **On meaningful progress:** One short issue update; not a chatty stream. Note material changes to contracts/dependencies immediately.
- **On PR:** Title `[Role] Short change`; include linked issue, changed files, API contract changes, screenshots if UI, commands/tests/results, AWS test-vs-real status, and review needed.
- **When blocked:** `BLOCKED — exact problem — what I tried — access/decision needed — other tasks continuing`.
- **At session end:** `DONE / IN PROGRESS / NEXT / BLOCKERS / PR LINKS / TEST RESULTS` in at most 8 lines.
- **Build status:** Role A updates `docs/BUILD_STATUS.md` based on evidence, with `WORKING`, `PARTIAL`, or `BLOCKED`, not optimistic guesses. An issue is not done merely because code was generated.

Do not send unnecessary approval prompts for ordinary coding, minor layout details, or reversible choices. **Never bypass** required reviews, real-money/payment authorization, AWS provisioning limits, or call consent approvals to reduce interruptions.

## 7. Milestones and auto-generated initial backlog

If no issue board exists, Role A creates the following dependency-ordered issues with owners and acceptance criteria. Other agents should only claim tasks that can safely proceed against committed contracts.

**M0 — Foundation (first merge)**
- A: Next.js strict TypeScript app setup, lint/test/CI, local demo mode, schemas and shared API contract, minimum auth/tenant approach, seed and README.
- C: Minimal design system proposal and dashboard shell once app structure is available.
- B: AWS access checklist, budgets/cost monitoring plan, integration contract review; no chargeable provisioning yet.
- D: Call/approval UI designs and mock-data contract review.

**M1 — Manual scheduling owned by manager**
- A: Volunteers (phone required, consent separate), availability, manager CRUD for shifts/assignments, deterministic conflict and role validation.
- C: Volunteer views, schedule editor, shift coverage dashboard, guided Help tour.
- B: Cloud persistence and auth adapters behind agreed interfaces, if configured.
- D: Activity stream layout and reusable action components.

**M2 — Automatic check-in lifecycle**
- A: Scheduler, durable call queue, semantic interpretation provider and structured outputs, status updates, retries/idempotency, pause state and policies.
- B: Connect calling adapter, Bedrock access/wiring, safe real-calling prerequisites and observability.
- D: Call history/results and Pause/Resume control; clearly labeled demo mode.
- C: Dashboard check-in and risk states.

**M3 — Replacement recovery**
- A: Risk scoring, ranked substitutes, manager approval endpoints, sequential bounded outreach, atomic assignment, every-call audit/report, manual assignment validation.
- D: Three-action manager plan card and workflow state views.
- C: At-risk shifts and live coverage state.
- B: AWS workflow reliability/testing support.

**M4 — Mandatory AWS/SaaS proof and release**
- B: Official App Monetization skill setup and verified **credit-card-only test** checkout, entitlements/usage metering (with A), AWS Cost Anomaly Detection monitor and alerts, hosting/deployment/cost controls.
- A: Auth/tenant isolation, usage events, quotas, end-to-end tests and operational evidence.
- C: Clean account/billing entry points only where required; do not build another checkout.
- D: Live-call status and integration usability polish.
- All: full test run, demo script, clear simulated-vs-real disclosures and PR-reviewed deployment.

The AWS teammate can do access/setup work in parallel from day one; keep the nonprofit core workflow as the product priority while never dropping the required monetization and cost-anomaly deliverables.

## 8. Minimal UI rules

The dashboard is **a tool, not an advertisement**. No feature promos, marketing banners, excessive copy, gratuitous charts, or over-animation. Show only meaningful counts, urgent actions, current shifts, and recent activity. Detail on demand. Concise statuses: `Covered`, `At risk`, `Pending`, `Uncovered`, `Paused`. Support mobile and keyboard use. The tutorial is optional, skippable, and accessible from `?` Help. Manager replacement cards emphasize one-sentence reasoning and **Yes / No / Assign myself**. Display clearly when calling or AI is simulated.

## 9. Completion criteria and hard stops

A feature is `WORKING` only when implemented, connected to real domain services or explicitly labeled demo adapters, covered by relevant tests, and merged through review. Test at least: phone validation, tenant isolation, manual schedule ownership, conflicts, novel free-text replies and corrections, uncertainty handling, auto check-in planning, pause enforcements, no-contact/no-consent, candidate ranking, three approval actions, sequential decline/fallback, per-call manager report, duplicate prevention, manager cancellation, recoverable workflows, quotas, and honest AWS provider status.

**Stop and escalate instead of guessing** if: unauthorized real outbound calling, unresolved consent/legal issue, payment/live-charge risk, significant AWS spending, credentials/access missing, two agents own the same files, a breaking shared contract without agreement, or a destructive migration. Document the blocker, then continue other safe work.

**Never:** build for-profit features now; let AI create the initial schedule; require managers to trigger ordinary check-ins; hardcode call responses; imply unconsented automatic phone outreach; silently fall back from real AWS to fake success; integrate direct Stripe; claim private-beta checkout is production-ready; falsely mark a task complete; or overwrite teammates' work.

**Operating loop:** Read role → inspect shared truth → claim highest-priority ready task → implement → test → commit → PR → report → repeat. The humans supervise progress and approve important decisions; the agents handle routine execution.
