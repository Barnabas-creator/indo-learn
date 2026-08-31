import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderCourseUnits } from '../lib/views/course.js';

// 极小的手写假 DOM：够 render* 函数 innerHTML 赋值后调 querySelector(All) 绑事件即可，
// 不引入 jsdom。断言只看渲染出来的 HTML 字符串。
function fakeRoot() {
  const stub = { addEventListener() {}, classList: { add() {}, remove() {} } };
  return { innerHTML: '', querySelector() { return stub; }, querySelectorAll() { return []; } };
}

// 列表页现在读清单（{ id, tier, title }，title 取自正文的 titleZh）。level/number/goal/
// 课数都是正文字段，清单里没有——传清单条目不该抛错（历史上这里读 u.lessons.length，
// undefined.length 会直接崩），A1/A2 分组、「准备中」占位这些字段没了就该整体消失，
// 不是显示 undefined。
test('清单条目（无 level/number/goal/lessons）渲染不抛错，标题正常显示', () => {
  const root = fakeRoot();
  assert.doesNotThrow(() => {
    renderCourseUnits(root, [{ id: 'u01', tier: 'free', title: '第一课：问候' }], { open() {}, back() {} });
  });
  assert.match(root.innerHTML, /第一课：问候/);
  assert.doesNotMatch(root.innerHTML, /undefined/);
});

test('不再按 A1/A2 分组——清单没有 level 字段', () => {
  const root = fakeRoot();
  renderCourseUnits(root, [{ id: 'u01', title: 'a' }, { id: 'u201', title: 'b' }], { open() {}, back() {} });
  assert.doesNotMatch(root.innerHTML, /level-tag/);
});
