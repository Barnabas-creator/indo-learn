import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeGrammarBook } from './merge-grammar-book.mjs';

const MODULES = [
  { id: 'affix', number: '03', title: '词缀篇', subtitle: 's', visual: 'morph', prefix: 'affix-' },
  { id: 'syntax', number: '04', title: '语法篇', subtitle: 's', visual: 'syntax', prefix: 'syntax-' },
];
const lesson = (id) => ({ id, title: id, options: [] });

test('按文件名前缀分进对应的篇，篇内按文件名排序', () => {
  const out = mergeGrammarBook(MODULES, [
    ['affix-02-men.json', [lesson('men')]],
    ['affix-01-ber.json', [lesson('ber')]],
    ['syntax-01-question.json', [lesson('q')]],
  ].sort((a, b) => a[0].localeCompare(b[0])));
  assert.deepEqual(out.map((m) => m.id), ['affix', 'syntax']);
  assert.deepEqual(out[0].lessons.map((l) => l.id), ['ber', 'men']);
  assert.deepEqual(out[1].lessons.map((l) => l.id), ['q']);
});

test('prefix 不出现在输出里（那只是分文件用的）', () => {
  const out = mergeGrammarBook(MODULES, [['affix-01.json', [lesson('a')]]]);
  assert.equal('prefix' in out[0], false);
  assert.equal(out[0].number, '03');
});

// 转写还没做到的篇不该在 UI 上占一行「0 课」。
test('没有任何课的篇不输出', () => {
  const out = mergeGrammarBook(MODULES, [['affix-01.json', [lesson('a')]]]);
  assert.deepEqual(out.map((m) => m.id), ['affix']);
});

test('前缀对不上的文件被跳过，不会混进别的篇', () => {
  const out = mergeGrammarBook(MODULES, [
    ['affix-01.json', [lesson('a')]],
    ['unknown-01.json', [lesson('x')]],
  ]);
  assert.deepEqual(out[0].lessons.map((l) => l.id), ['a']);
  assert.equal(out.length, 1);
});

// 课号形如 02C：数字取自文件名（书里的节次），字母是这一节里的第几课。
// 这样 meN- 那一族 8 课全是 02x，列表上是连着的一串。
test('课号 = 文件名里的节次 ＋ 节内序号字母', async () => {
  const { lessonCode } = await import('./merge-grammar-book.mjs');
  assert.equal(lessonCode('affix-02-men.json', 0), '02A');
  assert.equal(lessonCode('affix-02-men.json', 7), '02H');
  assert.equal(lessonCode('affix-16-bare-verbs.json', 0), '16A');
  assert.equal(lessonCode('phonetic-1-x.json', 1), '01B');
});

test('文件名里没有节次时退回 00，不产出 undefined', async () => {
  const { lessonCode } = await import('./merge-grammar-book.mjs');
  assert.equal(lessonCode('weird.json', 0), '00A');
});

test('合并后每一课都带上课号', () => {
  const out = mergeGrammarBook(MODULES, [
    ['affix-03-x.json', [lesson('a'), lesson('b')]],
  ]);
  assert.deepEqual(out[0].lessons.map((l) => l.code), ['03A', '03B']);
});
