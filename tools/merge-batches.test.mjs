import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeBatches } from './merge-batches.mjs';

test('词条 id 按包 id 加序号生成', () => {
  const out = mergeBatches([['batch-01.json', { p1: [{ word: 'satu' }, { word: 'dua' }] }]]);
  assert.deepEqual(out.p1.map((w) => w.id), ['p1-1', 'p1-2']);
  assert.equal(out.p1[0].word, 'satu');
});

test('多个批次合并成一张词条表', () => {
  const out = mergeBatches([
    ['batch-01.json', { p1: [{ word: 'satu' }] }],
    ['batch-02.json', { p2: [{ word: 'tiga' }] }],
  ]);
  assert.deepEqual(Object.keys(out).sort(), ['p1', 'p2']);
});
