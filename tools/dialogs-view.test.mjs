import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderDialogList } from '../lib/views/dialogs.js';

// 极小的手写假 DOM：够 render* 函数 innerHTML 赋值后调 querySelector(All) 绑事件即可，
// 不引入 jsdom。断言只看渲染出来的 HTML 字符串。
function fakeRoot() {
  const stub = { addEventListener() {}, classList: { add() {}, remove() {} } };
  return { innerHTML: '', querySelector() { return stub; }, querySelectorAll() { return []; } };
}

// 10.5B：scene/rounds 从清单 meta 摊平回来（见 app.js dialogList 分支：
// meta.scene → scene，meta.rounds → rounds，rounds 是数字不是数组）。
// 恢复 Task 10 删掉的两处显示：印尼语场景名、以及「N 轮」。
test('meta 摊平后的 scene/rounds 摆出来', () => {
  const root = fakeRoot();
  renderDialogList(root, [{ id: 'd-1', sceneZh: '点餐', scene: 'Memesan Makanan', rounds: 6 }], {
    open() {}, back() {},
  });
  assert.match(root.innerHTML, /点餐/);
  assert.match(root.innerHTML, /Memesan Makanan/);
  assert.match(root.innerHTML, /6\s*轮/);
  assert.doesNotMatch(root.innerHTML, /undefined/);
});

// scene/rounds 为 null（坏数据兜底、新模块没给 meta）时不崩、不猜、不显示 undefined。
test('scene/rounds 为 null 时对应两块整段省略，不画 undefined', () => {
  const root = fakeRoot();
  assert.doesNotThrow(() => {
    renderDialogList(root, [{ id: 'd-1', sceneZh: '点餐', scene: null, rounds: null }], {
      open() {}, back() {},
    });
  });
  assert.match(root.innerHTML, /点餐/);
  assert.doesNotMatch(root.innerHTML, /轮/);
  assert.doesNotMatch(root.innerHTML, /class="dialog-id"/);
  assert.doesNotMatch(root.innerHTML, /undefined/);
});

// 清单条目压根没给 scene/rounds 字段（不是显式 null，是 undefined）也要一样扛住——
// 这是清单条目最原始的形状：只有 id/sceneZh 时同样不能崩、不能画 undefined。
test('清单条目没有 scene/rounds 字段时同样不崩、不画 undefined', () => {
  const root = fakeRoot();
  renderDialogList(root, [{ id: 'd-1', sceneZh: '点餐' }], { open() {}, back() {} });
  assert.match(root.innerHTML, /点餐/);
  assert.doesNotMatch(root.innerHTML, /轮/);
  assert.doesNotMatch(root.innerHTML, /undefined/);
});

// 修复轮次 1（Minor）：sceneZh/scene 是历史遗留没走 esc() 的两处，这次整份重写
// 顺手补上——清单条目理论上都是我们自己内容管线出来的，不是用户输入，但列表页
// 拼字符串就该一律过 esc()，不能靠「这个字段来源可信」当例外。
test('sceneZh/scene 里的 HTML 特殊字符被转义，不会当标签解析', () => {
  const root = fakeRoot();
  renderDialogList(root, [{ id: 'd-1', sceneZh: '<b>点餐</b>', scene: '<i>Order</i>' }], {
    open() {}, back() {},
  });
  assert.doesNotMatch(root.innerHTML, /<b>点餐<\/b>/);
  assert.doesNotMatch(root.innerHTML, /<i>Order<\/i>/);
  assert.match(root.innerHTML, /&lt;b&gt;点餐&lt;\/b&gt;/);
  assert.match(root.innerHTML, /&lt;i&gt;Order&lt;\/i&gt;/);
});
