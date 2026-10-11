'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { shift, candidates, isEligible, initialState, transition, coverage, draftMessage } = require('./app.js');

test('eligibility requires the qualification and availability for the entire shift', () => {
  assert.deepEqual(candidates.filter(person => isEligible(person)).map(person => person.id), ['jamie', 'morgan']);
  const jamie = candidates[0];
  assert.equal(isEligible({ ...jamie, qualifications: [] }), false);
  assert.equal(isEligible({ ...jamie, availability: [{ date: shift.date, startMinutes: 601, endMinutes: 720 }] }), false);
  assert.equal(isEligible({ ...jamie, availability: [{ date: shift.date, startMinutes: 600, endMinutes: 719 }] }), false);
  assert.equal(isEligible({ ...jamie, availability: [{ date: '2026-10-18', startMinutes: 600, endMinutes: 720 }] }), false);
  assert.equal(isEligible(undefined), false);
});

test('outreach approval, acceptance, and final confirmation remain separate', () => {
  let state = initialState();
  assert.deepEqual(coverage(state), { assigned: 2, needed: 3 });
  state = transition(state, { type: 'APPROVE_OUTREACH' });
  assert.equal(state.stage, 1);
  assert.deepEqual(coverage(state), { assigned: 2, needed: 3 });
  state = transition(state, { type: 'SIMULATE_ACCEPTANCE' });
  assert.equal(state.stage, 2);
  assert.deepEqual(coverage(state), { assigned: 2, needed: 3 });
  state = transition(state, { type: 'CONFIRM_REPLACEMENT' });
  assert.equal(state.stage, 3);
  assert.deepEqual(coverage(state), { assigned: 3, needed: 3 });
});

test('stages cannot be skipped, repeated, or reversed with unrelated actions', () => {
  const orderedActions = ['APPROVE_OUTREACH', 'SIMULATE_ACCEPTANCE', 'CONFIRM_REPLACEMENT'];
  let state = initialState();
  for (let stage = 0; stage <= 3; stage++) {
    for (const action of [...orderedActions, 'UNKNOWN']) {
      if (action !== orderedActions[stage]) assert.strictEqual(transition(state, { type: action }), state);
    }
    if (stage < 3) state = transition(state, { type: orderedActions[stage] });
  }
});

test('only eligible candidates can be selected and choices lock after approval', () => {
  const initial = initialState();
  for (const id of ['sam', 'missing']) {
    assert.strictEqual(transition(initial, { type: 'SELECT_CANDIDATE', candidateId: id }), initial);
  }
  let state = transition(initial, { type: 'SELECT_CANDIDATE', candidateId: 'morgan' });
  assert.equal(state.candidateId, 'morgan');
  assert.equal(initial.candidateId, 'jamie');
  state = transition(state, { type: 'APPROVE_OUTREACH' });
  assert.strictEqual(transition(state, { type: 'SELECT_CANDIDATE', candidateId: 'jamie' }), state);
  for (const type of ['APPROVE_OUTREACH', 'SIMULATE_ACCEPTANCE', 'CONFIRM_REPLACEMENT']) {
    const invalid = { stage: 0, candidateId: 'sam' };
    assert.strictEqual(transition(invalid, { type }), invalid);
  }
});

test('reset restores the initial stage, selected candidate, and coverage from every stage', () => {
  let state = transition(initialState(), { type: 'SELECT_CANDIDATE', candidateId: 'morgan' });
  for (const type of [null, 'APPROVE_OUTREACH', 'SIMULATE_ACCEPTANCE', 'CONFIRM_REPLACEMENT']) {
    if (type) state = transition(state, { type });
    const reset = transition(state, { type: 'RESET' });
    assert.deepEqual(reset, initialState());
    assert.deepEqual(coverage(reset), { assigned: 2, needed: 3 });
  }
});

test('draft identifies the selected candidate, shift time, and location before approval', () => {
  const draft = draftMessage(candidates[1]);
  assert.match(draft, /^Hi Morgan,/);
  assert.match(draft, /Sat, Oct 17, 10 am–12 pm/);
  assert.match(draft, /Oak Street Center/);
  assert.doesNotMatch(draft, /Jamie/);
});
