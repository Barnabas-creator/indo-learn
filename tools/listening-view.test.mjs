import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  groupByUnit, mmss, renderAudioCats, renderListenList,
} from '../lib/views/listening.js';

// 极小的手写假 DOM：够 render* 函数 innerHTML 赋值后调 querySelector(All) 绑事件即可，
// 不引入 jsdom。断言只看渲染出来的 HTML 字符串。
function fakeRoot() {
  const stub = { addEventListener() {}, classList: { add() {}, remove() {} } };
  return { innerHTML: '', querySelector() { return stub; }, querySelectorAll() { return []; } };
}

test('时长显示成 分:秒', () => {
  assert.equal(mmss(23), '0:23');
  assert.equal(mmss(110), '1:50');
  assert.equal(mmss(0), '0:00');
  assert.equal(mmss(undefined), '0:00');
});

// 听力从「整块一个 all 单元」改成「一段一个单元」后，清单摊平给列表页的每一
// 条只剩 meta 里的 unitZh（没有单独的「课 id」字段了，见 tools/content-units.mjs
// 的 listening 分支），分组直接按 unitZh 这个字符串本身，不再靠额外的 unit id。
test('同一单元的几段归到一起，单元按首次出现排序', () => {
  const units = groupByUnit([
    { id: 'a', unitZh: '第 1 课' },
    { id: 'b', unitZh: '第 2 课' },
    { id: 'c', unitZh: '第 1 课' },
  ]);
  assert.deepEqual(units.map((u) => u.title), ['第 1 课', '第 2 课']);
  assert.deepEqual(units[0].items.map((i) => i.id), ['a', 'c']);
});

// 10.5B：条数从清单摊平的 counts 拿回来（见 app.js audioCats 分支：对话数 =
// modules.dialogs 条目个数，听力数 = modules.listening 那个唯一单元的 meta.count）。
test('counts 给了具体数字时，两块分类卡都画出条数', () => {
  const root = fakeRoot();
  renderAudioCats(root, { counts: { dialogs: 5, listening: 9 }, open() {}, back() {} });
  assert.match(root.innerHTML, /5\s*组/);
  assert.match(root.innerHTML, /9\s*段/);
  assert.match(root.innerHTML, /情境对话/);
  assert.match(root.innerHTML, /教材听力/);
  assert.doesNotMatch(root.innerHTML, /undefined/);
});

// counts 为 null（坏数据兜底、清单里模块压根没出现过）时不猜假数，整块徽标省略，
// 也不该被误判成「soon」——null 不是「真的数出来是 0」。
test('counts 为 null 时不显示条数、不崩、不误判成 soon', () => {
  const root = fakeRoot();
  assert.doesNotThrow(() => {
    renderAudioCats(root, { counts: { dialogs: null, listening: null }, open() {}, back() {} });
  });
  assert.doesNotMatch(root.innerHTML, /\d+\s*组/);
  assert.doesNotMatch(root.innerHTML, /\d+\s*段/);
  assert.doesNotMatch(root.innerHTML, /undefined/);
  assert.doesNotMatch(root.innerHTML, /soon/);
});

// 不传 counts 参数（历史调用方式、或调用方压根没算清单）也要一样扛住。
test('不传 counts 也不崩、不显示 undefined', () => {
  const root = fakeRoot();
  assert.doesNotThrow(() => {
    renderAudioCats(root, { open() {}, back() {} });
  });
  assert.doesNotMatch(root.innerHTML, /undefined/);
});

// 真的数出来是 0（这个账号完全看不到 dialogs/listening 任何一条）时才标灰成
// 「soon」，跟旧逻辑「meta.startsWith('0')」是同一个「真零才灰」的意思。
test('counts 真的是 0 时该分类标灰成 soon', () => {
  const root = fakeRoot();
  renderAudioCats(root, { counts: { dialogs: 0, listening: 3 }, open() {}, back() {} });
  const dialogsCard = root.innerHTML.split('教材听力')[0];
  assert.match(dialogsCard, /soon/);
});

// 11.5：分类卡也要挂锁——「教材听力」整个模块只有一个单元（tier 单一），
// locked.listening 由 app.js 用 categoryLocked 算出来传进来。锁标跟「soon」
// 是两种不同状态，不能混：soon 是「这类内容压根还没有」，锁是「有，但账号
// 看不了正文」，两者视觉上要能区分（不同 class）。
test('locked.listening 为真时，教材听力带锁标，soon 不带', () => {
  const root = fakeRoot();
  renderAudioCats(root, {
    counts: { dialogs: 5, listening: 9 },
    locked: { dialogs: false, listening: true },
    open() {},
    back() {},
  });
  const listeningCard = root.innerHTML.split('情境对话')[1];
  assert.match(listeningCard, /level-lock/);
  assert.doesNotMatch(listeningCard, /soon/);
});

test('locked 为假时不带锁标', () => {
  const root = fakeRoot();
  renderAudioCats(root, {
    counts: { dialogs: 5, listening: 9 },
    locked: { dialogs: false, listening: false },
    open() {},
    back() {},
  });
  assert.doesNotMatch(root.innerHTML, /level-lock/);
});

// 「soon」（count 为 0，内容压根没有）和「锁」（有内容但要登录）不能撞在一起
// 显示成同一种灰——这里确认两种状态各自的标记互不覆盖：soon 的分类没有锁标，
// 锁住的分类没有 soon 标记。
test('soon 与 locked 是两种可区分的状态，不会被同一个 class 盖住', () => {
  const root = fakeRoot();
  renderAudioCats(root, {
    counts: { dialogs: 0, listening: 9 },
    locked: { dialogs: false, listening: true },
    open() {},
    back() {},
  });
  const dialogsCard = root.innerHTML.split('教材听力')[0];
  const listeningCard = root.innerHTML.split('情境对话')[1];
  assert.match(dialogsCard, /soon/);
  assert.doesNotMatch(dialogsCard, /level-lock/);
  assert.match(listeningCard, /level-lock/);
  assert.doesNotMatch(listeningCard, /\bsoon\b/);
});

// 不传 locked（历史调用方式）也不该崩、不该误判成锁住。
test('不传 locked 也不崩、不误判成锁住', () => {
  const root = fakeRoot();
  assert.doesNotThrow(() => {
    renderAudioCats(root, { counts: { dialogs: 5, listening: 9 }, open() {}, back() {} });
  });
  assert.doesNotMatch(root.innerHTML, /level-lock/);
});

// 听力按段切之后，renderListenList 收到的是清单摊平出来的清单项（{id, tier,
// code, titleZh, unitZh, seconds}），不再是整段正文数组——正文（quiz/lines/
// phrases 等）要点进某一段才现取。所以列表层不该再画「N 题」（题数是正文
// 字段，清单里没有），也不该因为拿不到 quiz 而崩。
test('renderListenList 按 meta.unitZh 分组，显示教材编号/标题/时长，不画题数', () => {
  const root = fakeRoot();
  const items = [
    {
      id: 'bipa-a1-01-1', tier: 'paid', code: 'Simakan 1.1', titleZh: '早上问好：Santi 与 Beni',
      unitZh: '第 1 课　打招呼与问好', seconds: 23,
    },
    {
      id: 'bipa-a1-02-1', tier: 'paid', code: 'Simakan 2.1', titleZh: '自我介绍：Anjini',
      unitZh: '第 2 课　认识新朋友', seconds: 20,
    },
  ];
  assert.doesNotThrow(() => {
    renderListenList(root, items, { open() {}, back() {} });
  });
  assert.match(root.innerHTML, /第 1 课　打招呼与问好/);
  assert.match(root.innerHTML, /第 2 课　认识新朋友/);
  assert.match(root.innerHTML, /Simakan 1\.1/);
  assert.match(root.innerHTML, /早上问好：Santi 与 Beni/);
  assert.match(root.innerHTML, /0:23/);
  // 页面固定文案里本来就有「做题」二字，这里排除的是列表项自己画出来的题数
  // （旧版 "N 题" 那种数字+题的组合），不是把「题」字整体禁掉。
  assert.doesNotMatch(root.innerHTML, /\d+\s*题/);
  assert.doesNotMatch(root.innerHTML, /undefined/);
});
