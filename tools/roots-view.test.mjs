import { test } from 'node:test';
import assert from 'node:assert/strict';
import { derivedItems } from '../lib/views/roots.js';

test('派生词按中点拆成一条一条', () => {
  assert.deepEqual(
    derivedItems('melihat 看见 · dilihat 被看 · terlihat 看得见'),
    ['melihat 看见', 'dilihat 被看', 'terlihat 看得见'],
  );
});

test('空 derived 不产生空条目', () => {
  assert.deepEqual(derivedItems(''), []);
  assert.deepEqual(derivedItems(undefined), []);
  assert.deepEqual(derivedItems('a · · b'), ['a', 'b']);
});
