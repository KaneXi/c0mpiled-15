# Integrated deliveries

The primary product is the [online AWS application](https://rescue.kanexi.me).

## Offline preview

Open `revenuerescue-demo.html` in a current browser. This secondary preview includes the interface, fictional scheduling logic and local fonts. The live AWS assistant is explicitly unavailable; no analysis or provider request is made. Navigation to the online product is an explicit link.

All examples are fictional. Refreshing resets operational records. No external message or payment is processed.

## AWS release package

`aws-release.zip` contains the generated static website, bundled Lambda code, infrastructure template and release manifest. It contains no AWS credentials, origin-verification secret, guest session or private onboarding material. The readable source remains in `../apps/revenuerescue/` and `../infra/`. Deployment instructions are in `../docs/deployment.md`.

Regenerate from the app directory using `npm run build`, `npm run build:lambda`, `npm run bundle:demo` and `npm run package:release`. Do not edit generated artifacts manually. `SHA256SUMS` identifies the generated deliverables.

The offline file bundles React, React DOM, Luxon, Lucide and DM Sans. License notices are retained in bundled code and the readable packages. DM Sans licensing is in the app's `public/fonts/OFL.txt`.
