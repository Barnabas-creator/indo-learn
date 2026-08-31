import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitIntoUnits } from './content-units.mjs';

// 假内容：结构跟真内容一致，字数刻意压到最小——仓库是公开的，不放真词条。
const content = {
  packs: { 'p-1': [{ id: 'w1', word: 'satu' }], 'p-2': [{ id: 'w2', word: 'dua' }] },
  roots: [{ id: 'r-1', words: [] }],
  dialogs: [{ id: 'sapaan', sceneZh: '打招呼', lines: [] }],
  grammar: [{ id: 'phonetic', title: '发音篇', lessons: [{ id: 'l1' }] }],
  course: [{ id: 'u01', titleZh: '打招呼', lessons: [{ id: 'u01l1' }] }],
  listening: [{ id: 'a', unit: 'unit-01' }],
};

test('每个词包一个单元，body 是词条数组', () => {
  const units = splitIntoUnits(content, {});
  const p1 = units.find((u) => u.module === 'packs' && u.unitId === 'p-1');
  assert.deepEqual(p1.body, [{ id: 'w1', word: 'satu' }]);
});

test('listening 整块存成一个 all 单元', () => {
  const units = splitIntoUnits(content, {});
  const l = units.filter((u) => u.module === 'listening');
  assert.equal(l.length, 1);
  assert.equal(l[0].unitId, 'all');
  assert.equal(l[0].body.length, 1);
});

test('语法与教材按模块切，课跟着模块走不单独成单元', () => {
  const units = splitIntoUnits(content, {});
  assert.deepEqual(
    units.filter((u) => u.module === 'grammar').map((u) => u.unitId), ['phonetic'],
  );
  assert.equal(units.find((u) => u.module === 'grammar').body.lessons.length, 1);
});

test('清单里的 id 标成 free，其余 paid', () => {
  const units = splitIntoUnits(content, { packs: ['p-1'], dialogs: ['sapaan'] });
  assert.equal(units.find((u) => u.unitId === 'p-1').tier, 'free');
  assert.equal(units.find((u) => u.unitId === 'p-2').tier, 'paid');
  assert.equal(units.find((u) => u.module === 'dialogs').tier, 'free');
});

test('标题：对话取 sceneZh、语法取 title、教材取 titleZh，词包留空', () => {
  const units = splitIntoUnits(content, {});
  assert.equal(units.find((u) => u.module === 'dialogs').title, '打招呼');
  assert.equal(units.find((u) => u.module === 'grammar').title, '发音篇');
  assert.equal(units.find((u) => u.module === 'course').title, '打招呼');
  assert.equal(units.find((u) => u.unitId === 'p-1').title, null);
});

test('切出来的单元数 = 各模块单元数之和', () => {
  assert.equal(splitIntoUnits(content, {}).length, 2 + 1 + 1 + 1 + 1 + 1);
});
