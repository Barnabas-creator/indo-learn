import { test } from 'node:test';
import assert from 'node:assert/strict';
import { derivedItems, renderRootList } from '../lib/views/roots.js';

// 极小的手写假 DOM：够 render* 函数 innerHTML 赋值后调 querySelector(All) 绑事件即可，
// 不引入 jsdom。断言只看渲染出来的 HTML 字符串。
function fakeRoot() {
  const stub = { addEventListener() {}, classList: { add() {}, remove() {} } };
  return { innerHTML: '', querySelector() { return stub; }, querySelectorAll() { return []; } };
}

test('派生词按中点拆成一条一条', () => {
  assert.deepEqual(
    derivedItems('melihat 看见 · dilihat 被看 · terlihat 看得见'),
    ['melihat 看见', 'dilihat 被看', 'terlihat 看得见'],
  );
});

test('空 derived 不产生空条目', () => {
  assert.deepEqual(derivedItems(''), []);
  assert.deepEqual(derivedItems(undefined), []);
  assert.deepEqual(derivedItems('a · · b'), ['a', 'b']);
});

// 列表页现在读清单（{ id, tier, title }），title 在清单里恒为 null（词根标题算正文，
// 没解锁不该看到），subtitle/words 更没有——传清单条目不该抛错（历史上这里读
// p.words.length，undefined.length 会直接崩），也不该显示 undefined 或猜一个词数。
test('清单条目（title 为 null，无 subtitle/words）渲染不抛错、不显示 undefined、不猜词数', () => {
  const root = fakeRoot();
  assert.doesNotThrow(() => {
    renderRootList(root, [{ id: 'root-01', tier: 'free', title: null }], { open() {}, back() {} });
  });
  assert.doesNotMatch(root.innerHTML, /undefined/);
  assert.doesNotMatch(root.innerHTML, /\d+\s*词根/);
});

// 10.5B：subtitle/count 从清单 meta 摊平回来（见 app.js rootList 分支），
// 恢复 Task 10 删掉的两处显示：副标题、以及包列表页顶部「共 N 包 / M 个词根」的总数。
test('meta 摊平后的 subtitle/count 摆出来，总词根数按 count 求和', () => {
  const root = fakeRoot();
  renderRootList(root, [
    { id: 'root-01', title: '身体部位', subtitle: '常见身体部位词根', count: 12 },
    { id: 'root-02', title: '动作动词', subtitle: '高频动作词根', count: 8 },
  ], { open() {}, back() {} });
  assert.match(root.innerHTML, /身体部位/);
  assert.match(root.innerHTML, /常见身体部位词根/);
  assert.match(root.innerHTML, /12\s*词根/);
  assert.match(root.innerHTML, /20\s*个词根/); // 12 + 8 求和
  assert.doesNotMatch(root.innerHTML, /undefined/);
});

// count/subtitle 为 null（坏数据兜底、新模块没给 meta）时不崩、不猜、不显示 undefined，
// 跟「title 也是 null」那条测试是同一类问题，但这条专测「title 有了、meta 没有」的情形——
// 10.5A 之后 title 已经不再恒为 null，需要单独盯住 meta 那半边。
test('title 有了但 meta 为 null（subtitle/count 缺席）时不崩、不猜、不显示 undefined', () => {
  const root = fakeRoot();
  assert.doesNotThrow(() => {
    renderRootList(root, [{ id: 'root-01', title: '身体部位' }], { open() {}, back() {} });
  });
  assert.match(root.innerHTML, /身体部位/);
  assert.doesNotMatch(root.innerHTML, /undefined/);
  assert.doesNotMatch(root.innerHTML, /\d+\s*词根/);
  assert.doesNotMatch(root.innerHTML, /个词根/); // 顶部总数也该省略，不是显示 0 个词根
});

// 11.5：词根包列表也要挂锁——tier 从清单摊平回来（见 app.js rootList 分支），
// 判定跟 packs.js 用同一个 needsUnlock，锁标复用同一个 pack-lock 类
// （renderRootList 本来就在借 packs 那套 .pack-card/.pack-no 样式）。
test('paid 且账号看不了付费内容的词根包带锁标', () => {
  const root = fakeRoot();
  renderRootList(root, [{ id: 'root-01', title: '身体部位', tier: 'paid' }], {
    open() {}, back() {},
  });
  assert.match(root.innerHTML, /pack-lock/);
});

test('free 词根包不带锁标', () => {
  const root = fakeRoot();
  renderRootList(root, [{ id: 'root-01', title: '身体部位', tier: 'free' }], {
    open() {}, back() {},
  });
  assert.doesNotMatch(root.innerHTML, /pack-lock/);
});

test('paid 词根包但账号 active：不带锁标', () => {
  const root = fakeRoot();
  renderRootList(root, [{ id: 'root-01', title: '身体部位', tier: 'paid' }], {
    open() {}, back() {}, account: { status: 'active', trialEndsAt: null },
  });
  assert.doesNotMatch(root.innerHTML, /pack-lock/);
});

test('点开卡片按 id 而不是下标（rootId 现在按 id 取单元）', () => {
  const clicked = [];
  const root = {
    innerHTML: '',
    querySelector() { return { addEventListener() {} }; },
    querySelectorAll() {
      return [{ dataset: { id: 'root-02' }, addEventListener: (_, fn) => clicked.push(fn) }];
    },
  };
  renderRootList(root, [{ id: 'root-01', title: null }, { id: 'root-02', title: null }], {
    open: (id) => clicked.push(id),
    back() {},
  });
  clicked[0](); // 触发绑定的 click 回调
  assert.equal(clicked[1], 'root-02');
});
