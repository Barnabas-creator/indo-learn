import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePacks, validateDialogs } from './check-content.mjs';

const good = [
  {
    id: 'freq-beginner-001',
    title: '数字',
    subtitle: '1到10',
    theme: 'blue',
    stage: 1,
    words: Array.from({ length: 10 }, (_, i) => ({
      id: `freq-beginner-001-${i + 1}`,
      word: `kata${i}`,
      pos: '名词',
      zh: '词',
      example: `Ini kata${i} baru.`,
      exampleZh: '这是新词。',
    })),
  },
];

test('合格内容无问题', () => {
  assert.deepEqual(validatePacks(good), []);
});

test('词数不等于 10 报错', () => {
  const bad = structuredClone(good);
  bad[0].words.pop();
  assert.match(validatePacks(bad)[0], /freq-beginner-001.*9 词/);
});

test('缺字段报错', () => {
  const bad = structuredClone(good);
  delete bad[0].words[3].exampleZh;
  assert.match(validatePacks(bad)[0], /exampleZh/);
});

test('包内重复词报错', () => {
  const bad = structuredClone(good);
  bad[0].words[1].word = bad[0].words[0].word;
  assert.ok(validatePacks(bad).some((p) => /重复词/.test(p)));
});

test('例句必须包含该词', () => {
  const bad = structuredClone(good);
  bad[0].words[0].example = 'Kalimat lain sama sekali.';
  assert.ok(validatePacks(bad).some((p) => /例句未包含/.test(p)));
});

test('包 id 重复报错', () => {
  const bad = [...structuredClone(good), ...structuredClone(good)];
  assert.ok(validatePacks(bad).some((p) => /重复出现/.test(p)));
});

const goodDialog = [
  {
    id: 'sapaan',
    scene: 'Sapaan',
    sceneZh: '打招呼',
    lines: Array.from({ length: 8 }, (_, i) => ({
      speaker: i % 2 === 0 ? 'A' : 'B',
      id_text: `Baris ${i}.`,
      zh: `第 ${i} 句。`,
    })),
    keyPhrases: [{ id_text: 'Selamat pagi', zh: '早上好' }],
    vocab: [{ word: 'pagi', zh: '早晨' }],
  },
];

test('合格对话无问题', () => {
  assert.deepEqual(validateDialogs(goodDialog), []);
});

test('轮次少于 8 报错', () => {
  const bad = structuredClone(goodDialog);
  bad[0].lines = bad[0].lines.slice(0, 5);
  assert.match(validateDialogs(bad)[0], /5 轮/);
});

test('说话人必须交替', () => {
  const bad = structuredClone(goodDialog);
  bad[0].lines[1].speaker = 'A';
  assert.ok(validateDialogs(bad).some((p) => /说话人未交替/.test(p)));
});

test('缺关键句报错', () => {
  const bad = structuredClone(goodDialog);
  bad[0].keyPhrases = [];
  assert.ok(validateDialogs(bad).some((p) => /关键句/.test(p)));
});

test('缺生词报错', () => {
  const bad = structuredClone(goodDialog);
  bad[0].vocab = [];
  assert.ok(validateDialogs(bad).some((p) => /生词/.test(p)));
});
