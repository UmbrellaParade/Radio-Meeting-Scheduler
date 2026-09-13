import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatCandidateLabel, formatCandidateTime } from '../src/lib.js';

test('date-only live candidates do not render an empty time suffix', () => {
  const candidate = { date: '2026-10-17', start: '', end: '' };
  assert.equal(formatCandidateTime(candidate), '');
  assert.equal(formatCandidateLabel(candidate), '10/17（土）');
});

test('timed rehearsal and radio candidates retain their existing labels', () => {
  const candidate = { date: '2026-10-17', start: '22:00', end: '01:00' };
  assert.equal(formatCandidateTime(candidate), '22:00-翌01:00');
  assert.equal(formatCandidateLabel(candidate), '10/17（土） 22:00-翌01:00');
});
