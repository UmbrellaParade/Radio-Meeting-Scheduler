import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateCandidates, getBandSelectedDates, getDefaultCandidateRange, normalizeSelectedDates, summarizeCandidateDates, updateBandSelectedDates, weekendDatesInMonth } from '../src/scheduling.js';

const band = { mode: 'band', broadcastDate: '2026-09-27', timeSlots: ['18:00', '20:00'], durationMinutes: 180, includeWeekends: false };

test('band generates only explicitly selected days across months, including weekends', () => {
  const candidates = generateCandidates({ ...band, selectedDates: ['2026-10-04', '2026-09-27', '2026-09-27'] });
  assert.deepEqual(candidates.map((candidate) => [candidate.date, candidate.start, candidate.end]), [
    ['2026-09-27', '18:00', '21:00'], ['2026-09-27', '20:00', '23:00'],
    ['2026-10-04', '18:00', '21:00'], ['2026-10-04', '20:00', '23:00']
  ]);
});

test('empty selection stays empty despite old ranges or an old studio date', () => {
  assert.deepEqual(generateCandidates({ ...band, selectedDates: [], candidateStartDate: '2026-09-27', candidateEndDate: '2026-10-03' }), []);
});

test('legacy data derives selected days from actual candidates, not the old one-week range', () => {
  assert.deepEqual(getBandSelectedDates({ ...band, candidates: [{ date: '2026-10-04', enabled: false }, { date: '2026-09-27' }, { date: '2026-10-04' }] }), ['2026-09-27', '2026-10-04']);
  assert.deepEqual(getBandSelectedDates({ ...band, candidates: [] }), []);
});

test('selection changes preserve existing disabled slots and removed time slots', () => {
  const settings = { ...band, selectedDates: ['2026-09-27', '2026-10-04'] };
  settings.candidates = generateCandidates(settings).filter((candidate) => !(candidate.date === '2026-09-27' && candidate.start === '20:00'));
  settings.candidates[0].enabled = false;
  const next = updateBandSelectedDates(settings, ['2026-09-27', '2026-10-10']);
  assert.deepEqual(next.selectedDates, ['2026-09-27', '2026-10-10']);
  assert.equal(next.candidates.length, 3);
  assert.equal(next.candidates[0].enabled, false);
  assert.equal(next.candidates.filter((candidate) => candidate.date === '2026-10-04').length, 0);
  assert.deepEqual(updateBandSelectedDates({ ...settings, ...next }, []).candidates, []);
});

test('invalid dates and duplicates are excluded, with leap years validated', () => {
  assert.deepEqual(normalizeSelectedDates(['2026-02-29', '2028-02-29', '2026-13-01', '2026-09-31', '2028-02-29', '', null]), ['2028-02-29']);
});

test('shared band copy summarizes the actual candidate days without duplicates', () => {
  assert.equal(summarizeCandidateDates([
    { date: '2026-10-17' },
    { date: '2026-10-18' },
    { date: '2026-10-17' },
    { date: '2026-11-01' }
  ]), '10/17（土）、10/18（日）、11/1（日）');
});

test('weekend shortcut targets only the displayed month', () => {
  assert.deepEqual(weekendDatesInMonth(new Date(2026, 8, 1)), ['2026-09-05', '2026-09-06', '2026-09-12', '2026-09-13', '2026-09-19', '2026-09-20', '2026-09-26', '2026-09-27']);
  assert.ok(weekendDatesInMonth(new Date(2026, 11, 1)).every((date) => date.startsWith('2026-12-')));
});

test('radio retains its existing date-range and weekend filtering', () => {
  const range = getDefaultCandidateRange('2026-09-27');
  assert.deepEqual(range, { candidateStartDate: '2026-09-20', candidateEndDate: '2026-09-26' });
  const candidates = generateCandidates({ ...band, ...range, mode: 'radio', selectedDates: ['2026-10-04'], durationMinutes: 30, timeSlots: ['21:30'] });
  assert.deepEqual(candidates.map((candidate) => candidate.date), ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25']);
  assert.equal(candidates[0].end, '22:00');
});

test('live schedules create one date-only candidate for each selected day', () => {
  const live = {
    ...band,
    mode: 'live',
    selectedDates: ['2026-10-17', '2026-10-18'],
    durationMinutes: 0,
    timeSlots: []
  };
  assert.deepEqual(getDefaultCandidateRange('2026-10-17', 'live'), {
    candidateStartDate: '2026-10-17',
    candidateEndDate: '2026-10-23'
  });
  assert.deepEqual(generateCandidates(live), [
    { id: '2026-10-17-live', date: '2026-10-17', start: '', end: '', enabled: true },
    { id: '2026-10-18-live', date: '2026-10-18', start: '', end: '', enabled: true }
  ]);
});

test('live date changes preserve answers-disabled state on dates that remain selected', () => {
  const live = {
    ...band,
    mode: 'live',
    selectedDates: ['2026-10-17', '2026-10-18'],
    durationMinutes: 0,
    timeSlots: []
  };
  live.candidates = generateCandidates(live);
  live.candidates[0].enabled = false;
  const next = updateBandSelectedDates(live, ['2026-10-17', '2026-10-24']);
  assert.deepEqual(next.candidates, [
    { id: '2026-10-17-live', date: '2026-10-17', start: '', end: '', enabled: false },
    { id: '2026-10-24-live', date: '2026-10-24', start: '', end: '', enabled: true }
  ]);
});
