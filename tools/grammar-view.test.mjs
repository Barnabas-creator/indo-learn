import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lessonPages, parseTip, parseNote, visualFor } from '../lib/views/grammar.js';

const opt = (label) => ({
  label, result: 'r', meaning: 'm', example: 'e', translation: 't',
});

test('一课的分页：概览 + 记法 + 每个用法一页', () => {
  const pages = lessonPages({
    title: 'ber-', base: 'b', instruction: 'i', tip: 'A；B',
    options: [opt('x'), opt('y')],
  });
  assert.deepEqual(pages.map((p) => p.label), ['概览', '记法', 'x', 'y']);
});

test('没有记法时不插那一页', () => {
  const pages = lessonPages({ title: 't', options: [opt('x')] });
  assert.deepEqual(pages.map((p) => p.label), ['概览', 'x']);
});

// tip 常写成「总原则：甲；乙；丙。补充。」总原则管着后面每一条，
// 混进第一条里就成了「① 总原则：甲」——这正是用户报的那个 bug。
test('总原则被提出来，不混进第一条', () => {
  const { lead, nodes } = parseTip('词根类别决定意思：能得到的→拥有；能做的→做');
  assert.equal(lead, '词根类别决定意思');
  assert.deepEqual(nodes, ['能得到的→拥有', '能做的→做']);
});

// 最后一条句号后面的话是另一条独立规则，不该粘在最后一项上。
test('末尾的补充说明被拆到 foot', () => {
  const { nodes, foot } = parseTip('甲；乙；丙。另外还有一条规则。');
  assert.deepEqual(nodes, ['甲', '乙', '丙']);
  assert.equal(foot, '另外还有一条规则。');
});

test('没有总原则和补充时两者为空', () => {
  const { lead, nodes, foot } = parseTip('甲；乙；丙');
  assert.equal(lead, '');
  assert.deepEqual(nodes, ['甲', '乙', '丙']);
  assert.equal(foot, '');
});

test('没有分号的整段不拆，原样当 lead', () => {
  assert.deepEqual(parseTip('就一句话没有分号'), { lead: '就一句话没有分号', nodes: [], foot: '' });
  assert.deepEqual(parseTip(''), { lead: '', nodes: [], foot: '' });
  assert.deepEqual(parseTip(undefined), { lead: '', nodes: [], foot: '' });
});

test('认不出的篇退回默认图，不挂断链', () => {
  assert.match(visualFor({ id: 'syntax' }), /syntax\.svg$/);
  assert.match(visualFor({ id: '不存在' }), /affix\.svg$/);
  assert.match(visualFor(undefined), /affix\.svg$/);
});

// 书里的注释是一整段挤在一起的：生词、对话的另外半句、又例，全用「·」「｜」串成一行。
// 更糟的是引来的对话只留了一句当例句，另外半句藏在「对话：」后面混在生词堆里——
// 于是注释里出现的词在页面上找不到出处。拆开才看得见。
test('注释按「｜」拆块，带标签的成引文，「·」串的成生词表', () => {
  const parts = parseNote('lihat 看 · capai 累 ｜ 同型：Kamu kelihatan pucat. 你看起来苍白。');
  assert.deepEqual(parts.map((p) => p.kind), ['quote', 'vocab']);
  assert.equal(parts[0].label, '同型');
  assert.deepEqual(parts[1].items, ['lihat 看', 'capai 累']);
});

// 生词表沉到底：对话和又例是内容，词表是查阅。
test('生词表排在引文后面', () => {
  const parts = parseNote('a 甲 · b 乙 ｜ 回答：Bisa. 会。 ｜ 又例：Halo. 你好。');
  assert.deepEqual(parts.map((p) => p.kind), ['quote', 'quote', 'vocab']);
  assert.deepEqual(parts.slice(0, 2).map((p) => p.label), ['回答', '又例']);
});

test('没有注释时返回空数组', () => {
  assert.deepEqual(parseNote(''), []);
  assert.deepEqual(parseNote(undefined), []);
});
