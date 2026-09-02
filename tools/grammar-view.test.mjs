import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  lessonPages, parseTip, parseNote, visualFor, renderGrammarList,
} from '../lib/views/grammar.js';

// 极小的手写假 DOM：够 render* 函数 innerHTML 赋值后调 querySelector(All) 绑事件即可，
// 不引入 jsdom。断言只看渲染出来的 HTML 字符串。
function fakeRoot() {
  const stub = { addEventListener() {}, classList: { add() {}, remove() {} } };
  return { innerHTML: '', querySelector() { return stub; }, querySelectorAll() { return []; } };
}

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

// 10.5B：visualFor 优先认 meta.visual 摊平来的 mod.visual，认不出（不在 VISUALS
// 里，或压根没给）才退回 mod.id——四篇现有内容的 visual 字段值（sound/frame/morph）
// 都不在 VISUALS 里，所以退回 id 是现有内容的实际路径，必须验证这条不受影响。
test('visualFor 优先认 mod.visual，认不出时退回 mod.id', () => {
  assert.match(visualFor({ id: 'affix', visual: 'syntax' }), /syntax\.svg$/); // visual 命中优先
  assert.match(visualFor({ id: 'phonetic', visual: 'sound' }), /phonetic\.svg$/); // visual 不认得，退回 id
  assert.match(visualFor({ id: 'phonetic', visual: null }), /phonetic\.svg$/); // meta 为 null 同样退回 id
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

// 10.5B：number/subtitle/lessons 从清单 meta 摊平回来（见 app.js grammarList 分支）。
// 恢复 Task 10 删掉的三处显示：课号、副标题、以及「N 课」。
test('meta 摊平后的 number/subtitle/lessons 摆出来', () => {
  const root = fakeRoot();
  renderGrammarList(root, [{
    id: 'affix', title: '词缀篇', number: '03', subtitle: '前后缀怎么变词', lessons: 12,
  }], { open() {}, back() {} });
  assert.match(root.innerHTML, /词缀篇/);
  assert.match(root.innerHTML, /03/);
  assert.match(root.innerHTML, /前后缀怎么变词/);
  assert.match(root.innerHTML, /12\s*课/);
  assert.doesNotMatch(root.innerHTML, /undefined/);
});

// 11.5：语法篇列表挂锁——tier 从清单摊平回来（见 app.js grammarList 分支），
// 判定跟 packs.js 用同一个 needsUnlock，点击仍然触发 open(id)，是否跳登录
// 由 app.js 的 open 回调判定。
test('paid 且账号看不了付费内容的篇带锁标', () => {
  const root = fakeRoot();
  renderGrammarList(root, [{ id: 'affix', title: '词缀篇', tier: 'paid' }], { open() {}, back() {} });
  assert.match(root.innerHTML, /grammar-lock/);
});

test('free 篇不带锁标', () => {
  const root = fakeRoot();
  renderGrammarList(root, [{ id: 'phonetic', title: '发音篇', tier: 'free' }], { open() {}, back() {} });
  assert.doesNotMatch(root.innerHTML, /grammar-lock/);
});

test('paid 篇但账号 active：不带锁标', () => {
  const root = fakeRoot();
  renderGrammarList(root, [{ id: 'affix', title: '词缀篇', tier: 'paid' }], {
    open() {}, back() {}, account: { status: 'active', trialEndsAt: null },
  });
  assert.doesNotMatch(root.innerHTML, /grammar-lock/);
});

// number/subtitle/lessons 为 null（坏数据兜底、新模块没给 meta）时不崩、不猜、
// 不显示 undefined——标题照常显示。
test('清单条目 meta 为 null（无 number/subtitle/lessons）渲染不抛错，标题正常显示', () => {
  const root = fakeRoot();
  assert.doesNotThrow(() => {
    renderGrammarList(root, [{ id: 'affix', title: '词缀篇' }], { open() {}, back() {} });
  });
  assert.match(root.innerHTML, /词缀篇/);
  assert.doesNotMatch(root.innerHTML, /undefined/);
  assert.doesNotMatch(root.innerHTML, /\d+\s*课/);
});
