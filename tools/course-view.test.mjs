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
//
// 修复轮次 1：原来这条测试只查了 /A1/、/A2/ 两个字符串在不在，group() 就算把
// 所有单元都塞进每一组，这条测试照样绿——没有真的验证「归属」。改成按
// <h3 class="level-head"> 把渲染结果切成一组一组，再断言每组里到底有哪些
// 标题，确保 u01/u03 真的落在 A1 组、u02 真的落在 A2 组，互不串组。
test('按 level 分成 A1/A2 两组，level 缺了归入 A1，且组员不串组', () => {
  const root = fakeRoot();
  renderCourseUnits(root, [
    { id: 'u01', titleZh: 'a', level: 'A1' },
    { id: 'u02', titleZh: 'b', level: 'A2' },
    { id: 'u03', titleZh: 'c' }, // 没给 level
  ], { open() {}, back() {} });

  const groups = root.innerHTML.split('<h3 class="level-head">').slice(1);
  const a1Group = groups.find((g) => g.includes('level-tag">A1<'));
  const a2Group = groups.find((g) => g.includes('level-tag">A2<'));
  assert.ok(a1Group, 'A1 分组头没找到');
  assert.ok(a2Group, 'A2 分组头没找到');

  // A1 组该有 2 个单元（u01 + 没给 level 的 u03），A2 组 1 个——数字和实际
  // 标题都要对得上，不能只看数字（数字对但塞错组，这条测试也要能抓出来）。
  assert.match(a1Group, /2\s*个单元/);
  assert.match(a2Group, /1\s*个单元/);
  assert.match(a1Group, /class="unit-title">a</);
  assert.match(a1Group, /class="unit-title">c</);
  assert.doesNotMatch(a1Group, /class="unit-title">b</);
  assert.match(a2Group, /class="unit-title">b</);
  assert.doesNotMatch(a2Group, /class="unit-title">a</);
  assert.doesNotMatch(a2Group, /class="unit-title">c</);
});

// 11.5：课程单元列表挂锁——tier 从清单摊平回来（见 app.js courseUnits 分支），
// 判定跟 packs.js 用同一个 needsUnlock，点击仍然触发 open(id)，是否跳登录
// 由 app.js 的 open 回调判定。
test('paid 且账号看不了付费内容的单元带锁标', () => {
  const root = fakeRoot();
  renderCourseUnits(root, [{ id: 'u01', titleZh: '第一课', level: 'A1', tier: 'paid' }], {
    open() {}, back() {},
  });
  assert.match(root.innerHTML, /unit-lock/);
});

test('free 单元不带锁标', () => {
  const root = fakeRoot();
  renderCourseUnits(root, [{ id: 'u01', titleZh: '第一课', level: 'A1', tier: 'free' }], {
    open() {}, back() {},
  });
  assert.doesNotMatch(root.innerHTML, /unit-lock/);
});

test('paid 单元但账号 active：不带锁标', () => {
  const root = fakeRoot();
  renderCourseUnits(root, [{ id: 'u01', titleZh: '第一课', level: 'A1', tier: 'paid' }], {
    open() {}, back() {}, account: { status: 'active', trialEndsAt: null },
  });
  assert.doesNotMatch(root.innerHTML, /unit-lock/);
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
