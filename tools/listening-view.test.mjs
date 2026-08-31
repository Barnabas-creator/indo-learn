import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupByUnit, mmss, renderAudioCats } from '../lib/views/listening.js';

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

test('同一单元的几段归到一起，单元按首次出现排序', () => {
  const units = groupByUnit([
    { id: 'a', unit: 'unit-01', unitZh: '第 1 课' },
    { id: 'b', unit: 'unit-02', unitZh: '第 2 课' },
    { id: 'c', unit: 'unit-01', unitZh: '第 1 课' },
  ]);
  assert.deepEqual(units.map((u) => u.id), ['unit-01', 'unit-02']);
  assert.deepEqual(units[0].items.map((i) => i.id), ['a', 'c']);
});

test('分类页不再显示条数——按需取之后这一层没有数字可给，不猜假数', () => {
  const root = fakeRoot();
  renderAudioCats(root, { open() {}, back() {} });
  assert.doesNotMatch(root.innerHTML, /\d+\s*组/);
  assert.doesNotMatch(root.innerHTML, /\d+\s*段/);
  assert.match(root.innerHTML, /情境对话/);
  assert.match(root.innerHTML, /教材听力/);
});
