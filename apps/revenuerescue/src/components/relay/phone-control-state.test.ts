import assert from "node:assert/strict";
import { test } from "node:test";
import { inquiryStartBlocker } from "./phone-control-state";

const ready = {
  busy: false,
  paused: true,
  hasCode: true,
  waitingForSave: false,
  hasRun: true,
  planChanged: false,
  alreadyStarted: false,
  remainingRuns: 46,
  authorized: true,
};

test("renewed quota cannot reuse an already started task", () => {
  assert.match(
    inquiryStartBlocker({ ...ready, alreadyStarted: true }),
    /Save task/,
  );
});

test("a newly saved plan still requires explicit authorization", () => {
  assert.match(
    inquiryStartBlocker({ ...ready, authorized: false }),
    /authorization box/,
  );
  assert.equal(inquiryStartBlocker(ready), "");
});

test("polling must display the saved plan before a new inquiry can start", () => {
  assert.match(
    inquiryStartBlocker({ ...ready, waitingForSave: true }),
    /Waiting for the saved plan/,
  );
});

test("disabled controls explain the next action for each prerequisite", () => {
  assert.match(
    inquiryStartBlocker({ ...ready, hasCode: false }),
    /access code/,
  );
  assert.match(
    inquiryStartBlocker({ ...ready, paused: false }),
    /already scheduled or running/,
  );
  assert.match(
    inquiryStartBlocker({ ...ready, planChanged: true }),
    /Save task/,
  );
  assert.match(
    inquiryStartBlocker({ ...ready, remainingRuns: 0 }),
    /allowance is used up/,
  );
  assert.match(inquiryStartBlocker({ ...ready, busy: true }), /Please wait/);
});
