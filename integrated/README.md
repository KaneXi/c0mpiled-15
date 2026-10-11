# Integrated demonstration

Open `revenuerescue-demo.html` in a current browser. The file includes the interface, application logic, and fonts, and works without an internet connection. No account is needed.

All examples are fictional. Actions change only the current page session. No customer is contacted and no payment is processed. Refreshing the page starts over.

The readable source is in `../apps/revenuerescue/`. From that directory, run `npm ci` and `npm run bundle:demo` to regenerate this file. Do not edit the integrated HTML manually. `SHA256SUMS` identifies the generated artifact.

The file bundles React, React DOM, Luxon, Lucide icons, and DM Sans. Their license notices are included in the generated JavaScript or the readable app’s dependency packages; the DM Sans font license is at `../apps/revenuerescue/public/fonts/OFL.txt`.
