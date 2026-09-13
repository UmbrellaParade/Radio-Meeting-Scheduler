import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { initialMode, shareUrlFor } from '../src/embedding.js';

afterEach(() => { delete globalThis.window; });

function setLocation(href, pageUrl) {
  const location = new URL(href);
  globalThis.window = { location, frameElement: pageUrl ? { dataset: { umsPageUrl: pageUrl } } : null };
}

test('standalone radio links retain their existing format', () => {
  setLocation('https://example.com/Radio-Meeting-Scheduler/');
  assert.equal(shareUrlFor('event123', 'radio'), 'https://example.com/Radio-Meeting-Scheduler/?e=event123');
  assert.equal(shareUrlFor('event123', 'band'), 'https://example.com/Radio-Meeting-Scheduler/?e=event123&mode=band');
});

test('WordPress shares use the public page instead of the plugin asset path', () => {
  setLocation('https://example.com/wp-content/plugins/scheduler/app/index.html?embed=wordpress', 'https://example.com/meeting-scheduler/');
  assert.equal(shareUrlFor('event123', 'band'), 'https://example.com/meeting-scheduler/?e=event123&mode=band');
});

test('plain WordPress permalinks keep page_id and replace event parameters', () => {
  setLocation('https://example.com/wp-content/plugins/scheduler/app/index.html', 'https://example.com/?page_id=17&e=old&mode=band#old');
  assert.equal(shareUrlFor('new', 'radio'), 'https://example.com/?page_id=17&e=new');
});

test('unrelated or malformed parent addresses do not redirect shared links', () => {
  for (const parent of ['https://other.example/collect/', 'javascript:alert(1)', 'not-a-url']) {
    setLocation('https://example.com/app/index.html', parent);
    assert.equal(shareUrlFor('event123', 'radio'), 'https://example.com/app/index.html?e=event123');
  }
});

test('the embed default does not change the standalone default', () => {
  setLocation('https://example.com/app/index.html?initialMode=band');
  assert.equal(initialMode(), 'band');
  setLocation('https://example.com/app/index.html');
  assert.equal(initialMode(), 'radio');
});
