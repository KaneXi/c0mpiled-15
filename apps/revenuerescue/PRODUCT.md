# Relay manager workspace

Relay is nonprofit volunteer coordination. The active app is an English manager dashboard, with Schedule, Volunteers and Calls. It replaces the active commercial prototype; preserved legacy files are not reachable from the application routes.

Managers create draft shifts, assign volunteers and publish the initial schedule. A server worker monitors published schedules, checks permission and calling windows, and starts due simulated calls. The browser reads state every three seconds and never initiates routine calls or advances the workflow clock.

The central workflow is gap → ranked eligible candidates → manager approval → sequential contact → validated replacement. Yes approves the bounded candidate list. No stops the plan. Assign myself opens a separate confirmation before server validation and assignment. Pause AI Calls is always visible and prevents new calls on the server.

Calling is explicitly simulated. Conversation interpretation uses the provider reported by the server. Only when the server reports AWS AI is off may the manager explicitly choose a manual interpretation outcome. Configured or temporarily unavailable Bedrock keeps the real submission path. A separate simulated no-answer action records a transport outcome without claiming AI interpretation. Every call has a result and activity history. Phone, calling consent, recording consent, opt-out, availability and quiet hours remain distinct fields.

All operational mutations use the shared Relay API with a request UUID and expected revision. The server owns validation, scheduling, ranking and persistence. Conflict errors refresh the current state and preserve unfinished form data. Refresh restores the existing guest session and its saved fictional tenant.

Help is optional and concise. No marketing surface, chart, automatic tour, live phone controls, independent payment checkout or commercial feature is part of this UI delivery. Authentication and AWS payment readiness must be represented truthfully by their owners and provider status.
