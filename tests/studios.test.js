import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeStudios, safeWebUrl, studioLinkLines, studioSelection } from '../src/studios.js';

test('studio URLs allow web links only and exclude embedded credentials', () => {
  assert.equal(safeWebUrl(' https://studio.example/access?a=1&b=2 '), 'https://studio.example/access?a=1&b=2');
  assert.equal(safeWebUrl('http://studio.example'), 'http://studio.example/');
  for (const value of ['', 'javascript:alert(1)', 'data:text/html,hello', 'file:///etc/passwd', '/relative', 'https://user:secret@studio.example/', null, {}]) {
    assert.equal(safeWebUrl(value), '');
  }
});

test('studio backups are sanitized without duplicate IDs', () => {
  const studios = normalizeStudios([
    { id: 'a', name: ' Studio A ', url: 'https://studio.example', accessUrl: 'javascript:alert(1)' },
    { id: 'a', name: 'duplicate' }, null, { id: 'b', name: '' }
  ]);
  assert.deepEqual(studios, [{ id: 'a', name: 'Studio A', url: 'https://studio.example/', accessUrl: '' }]);
  assert.deepEqual(normalizeStudios(null), []);
});

test('selecting and clearing studios updates name and links together', () => {
  const selected = studioSelection({ id: 'a', name: 'Studio A', url: 'https://studio.example/', accessUrl: 'https://maps.example/a' });
  assert.equal(selected.meetingPlace, 'Studio A');
  assert.equal(selected.studioId, 'a');
  assert.deepEqual(studioLinkLines(selected), ['スタジオ公式サイト: https://studio.example/', 'アクセス・地図: https://maps.example/a']);
  assert.deepEqual(studioSelection(null), { studioId: '', meetingPlace: '', studioUrl: '', studioAccessUrl: '' });
  assert.deepEqual(studioLinkLines({ studioUrl: 'javascript:alert(1)' }), []);
});
