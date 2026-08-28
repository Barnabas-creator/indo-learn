import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupByUnit, mmss } from '../lib/views/listening.js';

test('时长显示成 分:秒', () => {
  assert.equal(mmss(23), '0:23');
  assert.equal(mmss(110), '1:50');
  assert.equal(mmss(0), '0:00');
  assert.equal(mmss(undefined), '0:00');
});

test('同一单元的几段归到一起，单元按首次出现排序', () => {
  const units = groupByUnit([
    { id: 'a', unit: 'unit-01', unitZh: '第 1 课' },
    { id: 'b', unit: 'unit-02', unitZh: '第 2 课' },
    { id: 'c', unit: 'unit-01', unitZh: '第 1 课' },
  ]);
  assert.deepEqual(units.map((u) => u.id), ['unit-01', 'unit-02']);
  assert.deepEqual(units[0].items.map((i) => i.id), ['a', 'c']);
});
