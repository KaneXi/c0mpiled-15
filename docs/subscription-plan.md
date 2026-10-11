# Subscription offer and sponsor entry

The public offer is at `https://rescue.kanexi.me/?plan=1`. Both the guest workspace and real-phone demonstration link to it.

- First month: $0.
- From month two: $4.99 USD per month.
- Ordinary subscription's first charge: one month after activation.
- A sponsor can copy and share this plan link without creating a guest workspace.

## Current boundary

This is the pricing interface, not a connected billing service. **Continue to payment** is disabled and explicitly explains that checkout is unavailable. No card data is collected, no subscription or trial is created, and no payment success can be inferred from a query parameter or a button click.

The organizer's supplied service access is evaluation-only, and its official integration package is not installed. Production collection is not enabled. Do not substitute a sandbox transaction, free-trial enrollment or promised purchase for a paid invoice.

The owner must still distinguish between sponsor enrollment in the ordinary free-first-month plan, advance payment for month two, and an organizer-approved test purchase. Do not enable immediate collection under the free-first-month offer without clearly disclosing that difference.

## Verification

Type checking, lint and the static website build passed. A rendered component check confirmed the advertised amount, one-month activation wording, disabled checkout and truthful unavailable status, without a card form or a fabricated payment receipt. The existing calling backend is unchanged. No real or test payment was attempted.
