# Website-controlled telephone demonstration

The presenter sets the roster, shift and inquiry time. AWS executes the saved sequence without an open browser or an operator manually advancing it.

## Presenter workflow

Open `https://rescue.kanexi.me/` and enter the private manager access code. The homepage loads the real saved coordination state; `?demo=1` explicitly opens the separate simulator. The page is publicly readable; changing real-call settings requires the code.

1. Select **Ask first** and **Ask as replacement** from the two consenting, allowlisted participants.
2. Enter the dated shift start and end in America/New_York time. Click **Save roster & shift**. Saving prepares availability but does not schedule or start calls.
3. Review **Saved calling plan**, including the exact time question. Select an inquiry time or click **Use two minutes from now**.
4. Confirm authorization and click **Schedule automatic inquiry**. Each run permits at most two outgoing calls. The displayed $2 budget is not a hard AWS billing cap.
5. Watch automatic updates. An explicit, confidently interpreted refusal triggers the eligible replacement. Only acceptance covering the complete shift confirms attendance.
6. **Cancel / stop calling** cancels pending outreach or requests stopping an active contact on the next worker pass. Keep the presenter code available after reloading.

AWS reserves a caller number after authorization, displays it when ready, and releases it when the run ends. Previous run results remain visible. Canceled runs consume the configured run allowance. The authorized service window and participant quiet hours remain enforced. No payment integration is involved.

## Execution and failures

- EventBridge invokes the dedicated voice Lambda once per minute. Deployment does not arm a test.
- DynamoDB stores the chosen roster, shift and start. The API checks the code, allowlist, consent, distinct participants, time bounds, allowance and authorization.
- Number allocation persists the selected number and an idempotency token before claiming it. An ambiguous response retries the same request, including cleanup recovery after cancellation.
- Call dispatch uses a stable client token. The original contact must disconnect before the replacement is called.
- Starting more than two minutes late stops the sequence instead of surprising participants with a late first call.
- Unclear speech, partial availability, no answer and low confidence never silently confirm attendance.
- AWS outages can delay cleanup until the next successful worker pass.
- The ordinary guest simulator does not advance the real telephone tenant.
- Public responses mask destination numbers and omit raw transcripts, Connect contact IDs, allocation tokens and caller resource IDs, including in history.

## Deployment configuration

The core API requires `RELAY_PHONE_CONTROL_CODE`, `RELAY_PUBLIC_TEST_TENANT`, `VOICE_ALLOWED_PHONES`, `VOICE_SERVICE_READY=true` and `VOICE_SERVICE_ENDS_AT`.

The voice Lambda retains its Connect, Lex, Bedrock and data settings and adds `VOICE_CONNECT_INSTANCE_ARN`. Obsolete `VOICE_CALLER_NUMBER` and `VOICE_PHONE_NUMBER_ID` values are unused. Enable the minute EventBridge rule and its Lambda invocation permission.

The voice role requires search/describe access to phone resources in the deployment account and region; claim/tag access for the dedicated instance and phone resources with the `RelayDemo=website-outbound` request tag; and release access restricted to resources carrying that tag. See the [Connect authorization reference](https://docs.aws.amazon.com/service-authorization/latest/reference/list_connect.html).

Credentials, real telephone numbers, the presenter code and private deployment settings are excluded from GitHub and release artifacts.

## Verification boundary

Type checking, lint, 162 automated tests and the web/API/voice builds passed. Tests cover website authorization, role selection, timing, cancellation, missed starts, retained history, public redaction, claim recovery, cleanup, refusal-to-replacement progression and acceptance-to-assignment logic.

The prior real test verified the original participant's refusal and a subsequent replacement call. The replacement answer was uncertain, so successful telephone acceptance was not verified. Revised wording and the complete website-triggered timed lifecycle await the presenter's next real test. Deployment did not initiate another call.

## Immediate website test

After saving the two participants and exact future shift hours, enter the presenter code, authorize the bounded two-call sequence, and click **Call [first participant] now**. No inquiry time is required for this button. The saved plan is used unchanged; unsaved form edits disable start. Only a clear refusal triggers the eligible replacement, and full acceptance is required to confirm coverage.

The API persists and arms the run before asynchronously waking the dedicated voice Lambda. Set `VOICE_FUNCTION_NAME` and optionally `VOICE_FUNCTION_REGION` (default `us-east-1`) on the core API, and grant its role `lambda:InvokeFunction` on that exact function ARN only. AWS invocation uses `InvocationType: Event`; a 202 acknowledges queuing, not a connected telephone call. See [AWS Invoke documentation](https://docs.aws.amazon.com/lambda/latest/api/API_Invoke.html).

Duplicate starts return 409 without invoking the worker again. Dispatch timeout leaves the same run armed for the existing minute worker, rather than creating another run. Caller provisioning can delay ringing. Cancellation, service expiry, consent, allowed numbers and existing call limits still apply. No real call is made by tests, builds or deployment. The original scheduled option remains available.

## Caller reservation fix (October 11)

A website-initiated run reached AWS, but ClaimPhoneNumber rejected the previous 64-character hash with `Invalid request parameter: ClientToken`. This API requires a UUID-shaped token. New reservations now generate and persist a UUID before claiming, and uncertain retries reuse that exact token. Regression coverage checks the documented pattern on the actual outbound command. Failure logs include only the error type and AWS request ID, without phone numbers or request payloads. Failed runs remain stopped until the presenter saves and starts a new test on the website; deploying the fix does not retry them.

## Confirmations, speech clarification and visible replacement history

The live phone page shows the dated shift start/end, original volunteer, current responsible volunteer, each call and saved outcome, manager notifications and final assignment. Manager notifications are in-app records (not SMS); they are saved atomically with the decision before the subsequent worker can call a replacement. The page polls about every three seconds.

A clear full-shift confirmation updates the existing assignment or commits the eligible replacement immediately. Coverage stops further outreach. A clear refusal records the manager notice, then the worker waits for disconnection and asks the next eligible candidate. Ambiguous speech does not confirm attendance or trigger substitution.

The first availability question is now included in the AI conversation context. The Bedrock instruction distinguishes short yes/no answers and contradictory speech-recognition text such as affirmative language followed by inability. Clarification asks for availability using alternative wording rather than silently rewriting the transcript. A separate, usage-metered Bedrock verification checks whether the full conversation supports each proposed confirmation/refusal before any assignment or manager notice; disagreement, invalid output or timeout withholds the action and requests clarification. It can withhold a proposed decision but cannot reverse one. On October 11, eight live Bedrock semantic cases passed (yes, no, contradictory positive/negative phrases, full confirmation, an explicit correction, the exact short affirmative and a resolved clarification). These checks validate text interpretation, not telephone transcription accuracy; a new participant-run phone test is still required.

For the owner's requested next test, the core API accepts a private `VOICE_TEST_RUN_LIMIT` setting (default 3, bounded to 3–50). The configured allowance is displayed publicly; previous usage/history stays intact. This does not arm a run or authorize arbitrary recipients. The owner must still save the next shift, authorize the two-call budget and click start on the website.

## Homepage coordination and saved shift times

The homepage now brings task creation, the two preselected participants, complete shift responsibility and persistent manager messages together. Declined, unanswered and unconfirmed calls remain visible from the current run and archived history. These are in-app notifications; deployment does not send SMS or place calls.

A separately verified full-shift acceptance uses the authoritative saved shift rather than model-generated date offsets. This fixes a real case where "yes it will work" was correctly understood but invented UTC/EDT offsets prevented assignment. Conditional, partial and unresolved answers still require clarification. Historical failures are not rewritten as successes.

The original dashboard layout, Schedule / Volunteers / Calls navigation, schedule cards and guided tour are preserved. Create shift and Manage calls open the real task controls within the dashboard. Manager messages and the replacement timeline are embedded below the schedule.

## Renewed owner-authorized allowance

The owner requested substantially more tests. The configured total is now 50 sequences, retaining all consumed runs and history. Each sequence still allows at most two calls to the existing consented, allowlisted participants and requires fresh website authorization. The existing service end time remains unchanged. Deployment never starts a sequence.

The exact live workspace may also receive a bounded `VOICE_ANALYSIS_LIMIT` of up to 500 reservations so speech interpretation and independent verification can serve the enlarged calling allowance. Its existing usage counters are retained. Guest workspace limits remain 20 analyses per tenant and 100 per day; the overall lifetime limit remains 500. This is a usage allowance, not prepaid AWS credit or a billing cap.

Completed runs no longer lock the authorization checkbox. Before starting another sequence, save a fresh task, then explicitly authorize calls. Each disabled start button shows the required next action. Editing participants, shift hours or inquiry time clears the previous checkbox selection.
