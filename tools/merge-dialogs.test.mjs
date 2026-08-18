import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeDialogs } from './merge-dialogs.mjs';

test('多个文件按文件名顺序合并', () => {
  const out = mergeDialogs([
    ['01.json', [{ id: 'a', lines: [] }]],
    ['02.json', [{ id: 'b', lines: [] }]],
  ]);
  assert.deepEqual(out.map((d) => d.id), ['a', 'b']);
});

test('id 重复时两份都保留，交给校验去报错', () => {
  const out = mergeDialogs([
    ['01.json', [{ id: 'a', lines: [] }]],
    ['02.json', [{ id: 'a', lines: [] }]],
  ]);
  assert.equal(out.length, 2);
});
