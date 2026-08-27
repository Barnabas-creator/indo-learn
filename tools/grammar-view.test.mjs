import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lessonPages, splitTip, visualFor } from '../lib/views/grammar.js';

const opt = (label) => ({
  label, result: 'r', meaning: 'm', example: 'e', translation: 't',
});

test('一课的分页：概览 + 记法 + 每个用法一页', () => {
  const pages = lessonPages({
    title: '前缀 ber-', base: 'b', instruction: 'i', tip: 'A；B',
    options: [opt('x'), opt('y')],
  });
  assert.deepEqual(pages.map((p) => p.label), ['概览', '记法', 'x', 'y']);
});

test('没有记法时不插那一页', () => {
  const pages = lessonPages({ title: 't', options: [opt('x')] });
  assert.deepEqual(pages.map((p) => p.label), ['概览', 'x']);
});

// tip 常写成「A；B；C」这种一串对照，拆成节点比一整段好记。
test('分号能把记法拆成多个节点', () => {
  assert.deepEqual(splitTip('甲；乙；丙'), ['甲', '乙', '丙']);
  assert.deepEqual(splitTip('甲;乙'), ['甲', '乙']);
});

test('没有分号的记法不拆，整段照原样显示', () => {
  assert.deepEqual(splitTip('就一句话没有分号'), []);
  assert.deepEqual(splitTip(''), []);
  assert.deepEqual(splitTip(undefined), []);
});

test('认不出的篇退回默认图，不挂断链', () => {
  assert.match(visualFor({ id: 'syntax' }), /syntax\.svg$/);
  assert.match(visualFor({ id: '不存在' }), /affix\.svg$/);
  assert.match(visualFor(undefined), /affix\.svg$/);
});
