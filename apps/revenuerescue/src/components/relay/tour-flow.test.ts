import assert from "node:assert/strict";
import { test } from "node:test";
import { tourLayout, tourSteps } from "./tour-flow";

test("mobile guide and spotlight stay in the viewport without obscuring each other", () => {
  const { card, spotlight } = tourLayout(
    { left: 20, top: 24, width: 335, height: 650 },
    { width: 375, height: 667 },
    320,
  );
  assert.ok(card.left >= 0 && card.left + card.width <= 375);
  assert.ok(card.top >= 0 && card.top + 320 <= 667);
  assert.ok(spotlight);
  assert.ok(spotlight.top + spotlight.height < card.top);
});

test("missing and offscreen targets leave a usable guide instead of an invalid spotlight", () => {
  assert.equal(
    tourLayout(null, { width: 1280, height: 720 }, 300).spotlight,
    null,
  );
  assert.equal(
    tourLayout(
      { left: 0, top: 900, width: 300, height: 100 },
      { width: 375, height: 667 },
      320,
    ).spotlight,
    null,
  );
});

test("the guide visits all workflow areas through presentation-only navigation", () => {
  assert.deepEqual(
    tourSteps.map((step) => step.id),
    ["schedule", "volunteers", "calls", "approval", "pause", "activity"],
  );
  assert.deepEqual(
    tourSteps.map((step) => step.tab),
    ["schedule", "volunteers", "calls", "schedule", "schedule", "schedule"],
  );
  assert.ok(tourSteps.every((step) => step.target && step.fallback));
});
