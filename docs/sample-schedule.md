# Four-person sample schedule

Open **Sample schedules**, choose **Four-person test**, then **Replace with sample**. This replaces only the current guest workspace after confirmation. Every load generates future dates, pauses calls and leaves all shifts unpublished. All numbers and permission flags are fictional test fixtures.

Let T be the displayed meal-packing start, rounded to a quarter-hour 45–60 minutes after loading. The website displays complete dates and the browser timezone.

| Shift                                 | Time                     | Assignee      | Purpose                                                          |
| ------------------------------------- | ------------------------ | ------------- | ---------------------------------------------------------------- |
| Sample · Meal packing                 | T to T + 60 minutes      | Kane (sample) | Main confirmation and replacement demonstration                  |
| Sample · Welcome desk (conflict)      | T − 15 to T + 75 minutes | Riley Chen    | Existing assignment excludes Riley from meal-packing replacement |
| Sample · Supply lead (no replacement) | T + 60 to T + 90 minutes | Kane (sample) | Only Kane has the required role; a refusal must remain uncovered |

Avery Lopez and Samira Khan are available, qualified meal-packing replacements, ranked in that order. Casey Morris is the manager, excluded from automatic outreach. The four test participants are Kane, Avery, Samira and Riley; replace names and numbers only in a separately authorized real-call setup.

Publish only **Meal packing**, then **Resume AI Calls**. Enter the original volunteer's answer in Calls. For the main demonstration, let Kane decline, approve the replacement plan with **Yes**, let Avery decline, and let Samira accept the entire shift. The real domain workflow must assign Samira once and stop; no response is automatically scripted. Calling is simulated, while semantic interpretation uses Bedrock when enabled.

Reload before each independent case:

- Original volunteer confirms: no replacement calls.
- Original volunteer is unsure, late or only partly available: do not invent confirmed full coverage.
- Both eligible replacements decline: leave the shift uncovered and stop outreach.
- Publish only Supply lead, resume, and decline: do not recommend unqualified volunteers.
- Pause before publication: no simulated call starts until resumed.

Keep the welcome assignment as a draft during the main test; publishing it would intentionally create a separate check-in. Existing draft assignments reserve availability. Calling hours remain 08:00–22:00 America/New_York; tests outside those hours will wait. Reload to refresh expired dates. Loading this sample never authorizes or initiates real phone calls.
