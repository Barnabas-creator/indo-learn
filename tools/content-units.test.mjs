import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitIntoUnits } from './content-units.mjs';

// 假内容：结构跟真内容一致，字数刻意压到最小——仓库是公开的，不放真词条。
// meta 相关字段（subtitle/scene/number/goal/level/visual）也照真实字段名补上，
// 但值都是占位符——meta 测的是「取值对不对」，不是内容本身。
const content = {
  packs: { 'p-1': [{ id: 'w1', word: 'satu' }], 'p-2': [{ id: 'w2', word: 'dua' }] },
  roots: [{ id: 'r-1', title: '词根一', subtitle: '示例词根', words: [{ id: 'rw1' }, { id: 'rw2' }] }],
  dialogs: [{
    id: 'sapaan', scene: 'greeting', sceneZh: '打招呼', lines: [{ a: 1 }, { a: 2 }],
  }],
  grammar: [{
    id: 'phonetic', number: 1, title: '发音篇', subtitle: '入门', visual: 'v1.svg', lessons: [{ id: 'l1' }],
  }],
  course: [{
    id: 'u01', number: 1, title: 'Salam', titleZh: '打招呼', goal: '学会问候', level: 'A1', lessons: [{ id: 'u01l1' }],
  }],
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
  // 补充对完全不在 freeIds 里的模块的断言，确保缺失模块按全 paid 处理
  assert.equal(units.find((u) => u.module === 'roots').tier, 'paid');
  assert.equal(units.find((u) => u.module === 'grammar').tier, 'paid');
  assert.equal(units.find((u) => u.module === 'course').tier, 'paid');
  assert.equal(units.find((u) => u.module === 'listening').tier, 'paid');
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

// 10.5A：清单太瘦丢了信息（词根包标题全空、语法/教材丢课数、对话丢轮数、
// 听力丢条数），用户拍板给每个单元补一个 meta。这组测试锁住每个模块的取值。

test('词根包的 title 不再是 null，取源数据的 title', () => {
  const units = splitIntoUnits(content, {});
  assert.equal(units.find((u) => u.module === 'roots').title, '词根一');
});

test('roots 的 meta 带 subtitle 与 words 条数，不带 words 数组本身', () => {
  const units = splitIntoUnits(content, {});
  const meta = units.find((u) => u.module === 'roots').meta;
  assert.deepEqual(meta, { subtitle: '示例词根', count: 2 });
});

test('dialogs 的 meta.rounds 等于对话行数，meta 里不含 lines 本身', () => {
  const units = splitIntoUnits(content, {});
  const meta = units.find((u) => u.module === 'dialogs').meta;
  assert.equal(meta.rounds, 2);
  assert.equal(meta.lines, undefined);
});

test('grammar 的 meta 带课数（数字），不是 lessons 数组本身', () => {
  const units = splitIntoUnits(content, {});
  const meta = units.find((u) => u.module === 'grammar').meta;
  assert.deepEqual(meta, {
    number: 1, subtitle: '入门', visual: 'v1.svg', lessons: 1,
  });
  assert.equal(typeof meta.lessons, 'number');
});

test('course 的 meta 带课数、印尼语原名（跟 titleZh 区分开）、goal、level', () => {
  const units = splitIntoUnits(content, {});
  const meta = units.find((u) => u.module === 'course').meta;
  assert.deepEqual(meta, {
    number: 1, title: 'Salam', goal: '学会问候', level: 'A1', lessons: 1,
  });
});

test('listening 的 meta.count 等于整个数组长度', () => {
  const units = splitIntoUnits(content, {});
  const meta = units.find((u) => u.module === 'listening').meta;
  assert.deepEqual(meta, { count: 1 });
});

test('packs 的 meta 是 null——标题骨架都在 lib/catalog.js 里，清单不重复', () => {
  const units = splitIntoUnits(content, {});
  assert.equal(units.find((u) => u.unitId === 'p-1').meta, null);
});
