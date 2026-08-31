import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderDialogList } from '../lib/views/dialogs.js';

// 极小的手写假 DOM：够 render* 函数 innerHTML 赋值后调 querySelector(All) 绑事件即可，
// 不引入 jsdom。断言只看渲染出来的 HTML 字符串。
function fakeRoot() {
  const stub = { addEventListener() {}, classList: { add() {}, remove() {} } };
  return { innerHTML: '', querySelector() { return stub; }, querySelectorAll() { return []; } };
}

// 列表页现在读清单（{ id, sceneZh }，见 app.js dialogList 分支）——scene（印尼语原名，
// 本来就跟标题重复）和 lines（详情才有）清单里都没有。没有 lines 时不该抛错，
// 也不该画出「undefined 轮」。
test('清单条目没有 lines 时不画「N 轮」，也不再画 scene 那行', () => {
  const root = fakeRoot();
  renderDialogList(root, [{ id: 'd-1', sceneZh: '点餐' }], { open() {}, back() {} });
  assert.match(root.innerHTML, /点餐/);
  assert.doesNotMatch(root.innerHTML, /轮/);
  assert.doesNotMatch(root.innerHTML, /class="dialog-id"/);
  assert.doesNotMatch(root.innerHTML, /undefined/);
});

test('传了 lines 时仍然画「N 轮」', () => {
  const root = fakeRoot();
  renderDialogList(root, [{ id: 'd-1', sceneZh: '点餐', lines: [{}, {}] }], { open() {}, back() {} });
  assert.match(root.innerHTML, /2 轮/);
});
