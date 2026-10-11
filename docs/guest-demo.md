# Guest demonstration guide

The primary delivery is the public AWS-backed website. The integrated HTML is a secondary offline preview. Both use fictional business and volunteer records; refreshing resets operational records.

## Business

Create a fictional inquiry or simulate an incoming request. The AWS assistant analyzes it automatically, checks the available sample schedule, and posts an internal notification. Confirm a current proposed time to update the sample booking. The original booking survives an invalid replacement.

The separate sample follow-up flow is draft, edit, approve, then simulate sending. Editing invalidates approval. No external message is sent. Outcomes and sales amounts are manually reported demo values, not payment evidence.

## Volunteers

Switch to Volunteers to register interest, record availability, and coordinate a sample shift. Confirming an assignment checks role, availability, remaining places and overlap. Moving a volunteer checks the replacement before changing the original. Completion is possible only after a shift has ended on the fixed demo clock. Only recorded completed minutes contribute to hours.

A voice example creates an unassigned registration with unknown availability and contact permission off. Its text can be analyzed by AWS outside the guided tour, but it is not a real recording or transcription.

## What makes the assistant real

The public backend uses Amazon Bedrock Nova Lite with read-only business availability or volunteer shift tools. It requires a real tool result before accepting a proposal, and reconstructs actionable values from server-issued options. It cannot book, assign, complete, approve, send or charge on its own. The notification shows the actual provider and tool provenance.

The assistant is automatic on committed intake, not on every render or edit. Tours, switching modes and ordinary edits do not invoke the model. Analysis errors and limits remain visible; a timeout is never replaced by a fake successful response.

## Limits

The demonstration allows 10 analyses per two-hour anonymous session, 100 per UTC day globally, and 500 over the deployment lifetime. Each analysis permits at most two model calls. Failed attempts consume their reservation; an identical retry reuses the stored job. The limits control inference work, not all hosting costs.

Guest records are not authenticated customer accounts. Use fictional details only. Real email, phone, speech recognition, customer authentication, calendar synchronization and production payment collection are deferred. The available billing Beta does not authorize production customer charges.
