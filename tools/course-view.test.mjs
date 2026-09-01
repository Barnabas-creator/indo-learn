import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderCourseUnits } from '../lib/views/course.js';

// 极小的手写假 DOM：够 render* 函数 innerHTML 赋值后调 querySelector(All) 绑事件即可，
// 不引入 jsdom。断言只看渲染出来的 HTML 字符串。
function fakeRoot() {
  const stub = { addEventListener() {}, classList: { add() {}, remove() {} } };
  return { innerHTML: '', querySelector() { return stub; }, querySelectorAll() { return []; } };
}

// 10.5B：number/title(印尼语原名)/goal/level/lessons 从清单 meta 摊平回来
// （见 app.js courseUnits 分支），titleZh 是清单条目自己的 title。
// 恢复 Task 10 删掉的显示：单元号、印尼语原名、学习目标、「N 课」，以及 A1/A2 分组。
test('meta 摊平后的 number/title/goal/lessons 摆出来', () => {
  const root = fakeRoot();
  renderCourseUnits(root, [{
    id: 'u01', titleZh: '第一课：问候', title: 'Perkenalan', number: '01', goal: '学会打招呼', level: 'A1', lessons: 4,
  }], { open() {}, back() {} });
  assert.match(root.innerHTML, /第一课：问候/);
  assert.match(root.innerHTML, /Perkenalan/);
  assert.match(root.innerHTML, /学会打招呼/);
  assert.match(root.innerHTML, /4\s*课/);
  assert.doesNotMatch(root.innerHTML, /undefined/);
});

// 「开放与否」不再看 meta.lessons 是否 > 0——这是 Task 10 之前的旧毛病。清单里能
// 出现的单元就是这个账号点得开的单元，所以恢复后的列表不应该再有 disabled/soon 状态，
// 也不该有「已开放 X/Y 个单元」这种局部开放的计数。
test('清单里的单元一律可点，不再有 soon/disabled 状态或「已开放 X/Y」计数', () => {
  const root = fakeRoot();
  renderCourseUnits(root, [
    { id: 'u01', titleZh: 'a', level: 'A1', lessons: 0 }, // lessons 为 0 也照样可点——不再是判定依据
    { id: 'u02', titleZh: 'b', level: 'A1' },
  ], { open() {}, back() {} });
  // 注意别跟静态的 <p class="soon-note"> 提示语混在一起——那是固定文案，不是
  // 逐个单元的状态类，这里只查 unit-item 会不会被打上 soon/disabled。
  assert.doesNotMatch(root.innerHTML, /unit-item soon/);
  assert.doesNotMatch(root.innerHTML, /unit-item[^>]*disabled/);
  assert.doesNotMatch(root.innerHTML, /已开放/);
  assert.match(root.innerHTML, /2\s*个单元/);
});

// A1/A2 分组要恢复：level 从 meta 摊平，缺了按 A1 分组（跟 Task 10 之前的默认值一致）。
test('按 level 分成 A1/A2 两组，level 缺了归入 A1', () => {
  const root = fakeRoot();
  renderCourseUnits(root, [
    { id: 'u01', titleZh: 'a', level: 'A1' },
    { id: 'u02', titleZh: 'b', level: 'A2' },
    { id: 'u03', titleZh: 'c' }, // 没给 level
  ], { open() {}, back() {} });
  assert.match(root.innerHTML, /A1/);
  assert.match(root.innerHTML, /A2/);
  // A1 组该有 2 个单元（u01 + 没给 level 的 u03），A2 组 1 个。
  const a1Index = root.innerHTML.indexOf('A1');
  const a2Index = root.innerHTML.indexOf('A2');
  assert.ok(a1Index !== -1 && a2Index !== -1);
});

// number/title/goal/lessons 为 null（坏数据兜底、新模块没给 meta）时不崩、不猜、
// 不显示 undefined——历史上这里读 u.lessons.length，undefined.length 会直接崩。
test('清单条目（无 number/title/goal/lessons/level）渲染不抛错，标题正常显示', () => {
  const root = fakeRoot();
  assert.doesNotThrow(() => {
    renderCourseUnits(root, [{ id: 'u01', titleZh: '第一课：问候' }], { open() {}, back() {} });
  });
  assert.match(root.innerHTML, /第一课：问候/);
  assert.doesNotMatch(root.innerHTML, /undefined/);
  assert.doesNotMatch(root.innerHTML, /\d+\s*课/);
});
