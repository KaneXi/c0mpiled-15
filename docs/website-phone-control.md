# Website-controlled telephone demonstration

The presenter sets the roster, shift and inquiry time. AWS executes the saved sequence without an open browser or an operator manually advancing it.

## Presenter workflow

Open `https://rescue.kanexi.me/?phone-test=1` and enter the private presenter code. The page is publicly readable; changing real-call settings requires the code.

1. Select **Ask first** and **Ask as replacement** from the two consenting, allowlisted participants.
2. Enter the dated shift start and end in America/New_York time. Click **Save roster & shift**. Saving prepares availability but does not schedule or start calls.
3. Review **Saved calling plan**, including the exact time question. Select an inquiry time or click **Use two minutes from now**.
4. Confirm authorization and click **Schedule automatic inquiry**. Each run permits at most two outgoing calls. The displayed $2 budget is not a hard AWS billing cap.
5. Watch automatic updates. An explicit, confidently interpreted refusal triggers the eligible replacement. Only acceptance covering the complete shift confirms attendance.
6. **Cancel / stop calling** cancels pending outreach or requests stopping an active contact on the next worker pass. Keep the presenter code available after reloading.

AWS reserves a caller number after authorization, displays it when ready, and releases it when the run ends. Previous run results remain visible. Canceled runs consume the three-run demo allowance. The authorized service window and participant quiet hours remain enforced. No payment integration is involved.

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
