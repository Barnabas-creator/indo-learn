import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderPackGrid } from '../lib/views/packs.js';

// 极小的手写假 DOM：够 render* 函数 innerHTML 赋值后调 querySelector(All) 绑事件即可，
// 不引入 jsdom。断言只看渲染出来的 HTML 字符串。
function fakeRoot() {
  const stub = { addEventListener() {}, classList: { add() {}, remove() {} } };
  return { innerHTML: '', querySelector() { return stub; }, querySelectorAll() { return []; } };
}

// packsOfLevel（catalog-view.js）现在给的是 open/tier，不再给 words——这里补的是
// Task 9 留下的缺口：renderPackGrid 曾经读 p.words.length，undefined.length 会直接崩。
test('已开放的包不显示词数——网格层拿不到词条，不该猜一个数字', () => {
  const root = fakeRoot();
  renderPackGrid(root, {
    levelTitle: '初级',
    packs: [{ id: 'p-1', title: '数字', subtitle: '1到10', open: true }],
    open() {},
    back() {},
  });
  assert.doesNotMatch(root.innerHTML, /\d+\s*词/);
  assert.doesNotMatch(root.innerHTML, /disabled/);
});

test('未开放的包显示「准备中」且卡片禁用', () => {
  const root = fakeRoot();
  renderPackGrid(root, {
    levelTitle: '初级',
    packs: [{ id: 'p-1', title: '数字', subtitle: '1到10', open: false }],
    open() {},
    back() {},
  });
  assert.match(root.innerHTML, /准备中/);
  assert.match(root.innerHTML, /disabled/);
});

test('全部开放时不显示「已开放 X / Y」提示', () => {
  const root = fakeRoot();
  renderPackGrid(root, {
    levelTitle: '初级',
    packs: [{ id: 'p-1', title: '数字', subtitle: '1到10', open: true }],
    open() {},
    back() {},
  });
  assert.doesNotMatch(root.innerHTML, /已开放/);
});

test('部分开放时显示「已开放 1 / 2」提示', () => {
  const root = fakeRoot();
  renderPackGrid(root, {
    levelTitle: '初级',
    packs: [
      { id: 'p-1', title: '数字', subtitle: '1到10', open: true },
      { id: 'p-2', title: '饮料', subtitle: '水茶咖啡', open: false },
    ],
    open() {},
    back() {},
  });
  assert.match(root.innerHTML, /已开放 1 \/ 2/);
});

// Task 11：付费单元挂锁——needsUnlock({tier:'paid'}) 为真的包要带锁标，
// 但它仍然是「开放」的（在清单里、可点），点进去才会被 provider 拦下要求登录，
// 所以卡片不能带 disabled。
test('paid 单元带锁标，但卡片仍可点（不带 disabled）——点进去才会被拦下要求登录', () => {
  const root = fakeRoot();
  renderPackGrid(root, {
    levelTitle: '初级',
    packs: [{ id: 'p-1', title: '数字', subtitle: '1到10', open: true, tier: 'paid' }],
    open() {},
    back() {},
  });
  assert.match(root.innerHTML, /pack-lock/);
  assert.doesNotMatch(root.innerHTML, /disabled/);
});

test('free 单元不带锁标', () => {
  const root = fakeRoot();
  renderPackGrid(root, {
    levelTitle: '初级',
    packs: [{ id: 'p-1', title: '数字', subtitle: '1到10', open: true, tier: 'free' }],
    open() {},
    back() {},
  });
  assert.doesNotMatch(root.innerHTML, /pack-lock/);
});

// 清单里没有的包 tier 是 null（见 packsWithStatus 注释），不是 undefined——
// 这里确认 tier 缺失/为 null 时不崩、也不误判成要挂锁。
test('tier 缺失（undefined 或 null）时不崩，也不挂锁', () => {
  const root = fakeRoot();
  assert.doesNotThrow(() => {
    renderPackGrid(root, {
      levelTitle: '初级',
      packs: [{ id: 'p-1', title: '数字', subtitle: '1到10', open: false, tier: null }],
      open() {},
      back() {},
    });
  });
  assert.doesNotMatch(root.innerHTML, /pack-lock/);
});
