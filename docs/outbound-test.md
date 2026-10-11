# Bounded outbound phone test

The owner authorized a two-person US telephone test on October 11, 2026: call the original assignee first, and call the consented replacement only after an explicit refusal. This is a separately configured demonstration, not a general production calling service. Real recipient numbers, presenter credentials, resource configuration and private setup scripts stay in ignored local storage.

## Runtime behavior

- The public phone-test page reads a designated isolated tenant. Recipient numbers are masked and raw transcripts/contact identifiers are omitted from the public response.
- A presenter code starts a single bounded sequence. Starting twice cannot reset its attempt budget. Guest sample resets cannot mutate this tenant.
- Amazon Connect makes outbound calls; Lex V2 transcribes speech and invokes a dedicated Lambda. Bedrock interprets the whole supplied conversation; deterministic domain logic controls assignment.
- An original assignee's confident, explicit refusal permits the already-authorized replacement sequence. Uncertainty, questions, lateness and partial availability do not automatically trigger substitution. One clarification turn is available.
- Replacements are revalidated by the existing workflow. An acceptance commits one assignment and stops further outreach. Sequential dispatch waits for the previous contact to disconnect.
- An environment allowlist restricts telephone destinations. This test has two total call attempts and one eligible replacement. Normal consent, quiet hours and assignment constraints still apply.
- An EventBridge minute worker runs independently of the browser. It checks contact duration and stops overlong contacts; a separate one-time cleanup rule releases the temporary number. The supervised test also polls transport state and invokes cleanup on completion. Periodic infrastructure is not an absolute real-time timeout guarantee.
- No audio recordings or Lex conversation logs are configured. Text responses are retained privately for scheduling interpretation. No production payment integration is supplied.

## Validation

TypeScript and scoped ESLint checks passed. The sample, engine, provider, HTTP, storage and outbound workflow suites passed 79 tests. Lex runtime recognition was checked with both a sample utterance and a novel free-text sentence; both invoked the configured callback without a live contact. Those checks alone are not evidence of a successful live voice conversation.

The sample schedule was separately verified through the public API: three future drafts, paused, no calls. Cloud and local builds share the same source. Browser-based visual inspection was unavailable in this session; no browser audit is claimed.

## Integration boundaries

The standard guest workspace continues to require a manager decision before replacement outreach. Only the designated, presenter-started phone test uses the owner's explicitly requested automatic substitution policy. Production identity, broader calling permissions, official AWS App Monetization, Cost Anomaly Detection, and production reliability remain separate work.

Existing source patches in the team review PR are snapshots, not automatic synchronization. Any team integration must adapt these changes to the team's contracts in an owner-reviewed PR; never overwrite team main with this prototype.

## Live test result and wording correction

The authorized two-call sequence ran on October 11, 2026. The original volunteer's spoken refusal was interpreted by real Bedrock; Connect then automatically dialed the eligible replacement after the first call disconnected. The second conversation did not contain a clear full-shift commitment, so the model returned uncertainty and the workflow stopped without assigning a replacement. The temporary caller number was released and the periodic calling worker was disabled. This verifies real speech interpretation and refusal-driven handoff, but not the successful-acceptance branch over the telephone.

The owner reported that the replacement question was unclear. The first version also let generated clarification use UTC clock values. The revised voice prompts explicitly state the original volunteer's absence, the shift role, dated local start/end times, timezone, and whether the entire period works for the replacement. Spoken follow-up questions now use deterministic local-time wording; the model receives explicit local ISO times. The window formatter handles overnight dates and daylight-saving transitions. The revised wording has passed local checks but has not yet been retested by telephone. Across seven focused suites, 82 tests pass.
