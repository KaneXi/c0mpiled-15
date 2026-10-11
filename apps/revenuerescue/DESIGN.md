# Relay visual direction

Surface mode: Operate. A calm, legible tool for nonprofit managers working through staffing interruptions. Task clarity takes priority over decoration.

- Retain locally hosted DM Sans and the established warm ivory canvas, soft olive sidebar, charcoal text and restrained coral action color. Deep coral #a9462e supports readable white button text; sage and warm amber signal states with text labels.
- A compact desktop sidebar holds Schedule, Volunteers and Calls. On small screens it becomes three visible navigation buttons. No hero, marketing sections, decorative KPI cards, charts or animation sequences.
- The header pairs the current task with a prominent Pause / Resume AI Calls control. A flat status strip contains meaningful counts. Attention plans appear before the schedule, and each plan gives one explanation, a ranked list and Yes / No / Assign myself.
- Schedule rows show times, assigned and confirmed counts, draft/published status and relevant server incidents. Forms expand inline. Assign myself and destructive reset use native modal dialogs for protected confirmation and keyboard focus.
- One control vocabulary: thin neutral borders, modest radii, 42–44px targets, visible focus, explicit loading/disabled/error states. Text and forms wrap on mobile. Reduced-motion preferences disable transitions.
- Fictional data and simulated calling remain visible. Actual provider status is available in a small footer disclosure. Errors explain the recovery; no stale optimistic success is shown.

Implementation is isolated in `src/components/relay/Relay.module.css`, using the established global font and reset without altering preserved prototype styling.
