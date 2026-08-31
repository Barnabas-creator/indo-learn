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
