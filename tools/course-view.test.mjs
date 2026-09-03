import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderCourseUnits } from '../lib/views/course.js';

// 极小的手写假 DOM：够 render* 函数 innerHTML 赋值后调 querySelector(All) 绑事件即可，
// 不引入 jsdom。断言只看渲染出来的 HTML 字符串。
function fakeRoot() {
  const stub = { addEventListener() {}, classList: { add() {}, remove() {} } };
  return { innerHTML: '', querySelector() { return stub; }, querySelectorAll() { return []; } };
}

// 比 fakeRoot 多一层：把 addEventListener 挂上去的回调真的记下来，测试才能
// 「点一下」折叠开关，验证它确实会重渲染、确实会展开——不然折叠开关能不能用
// 就只能靠传参数模拟，测不到真正接线的那一步。
// 仍然不引入 jsdom：选择器靠正则从当前 innerHTML 里抠，只认这个文件用到的
// 几个 class，不是通用 DOM 实现。
function fakeRootWithCapture() {
  const state = { html: '', handlers: { toggle: [], unitItem: [], back: null } };
  return {
    get innerHTML() { return state.html; },
    set innerHTML(v) {
      state.html = v;
      state.handlers = { toggle: [], unitItem: [], back: null };
    },
    querySelector(sel) {
      if (sel === '.back') {
        return { addEventListener: (evt, fn) => { state.handlers.back = fn; } };
      }
      return { addEventListener() {}, classList: { add() {}, remove() {} } };
    },
    querySelectorAll(sel) {
      if (sel === '.level-toggle') {
        return [...state.html.matchAll(/class="level-toggle"[^>]*data-level="([^"]+)"/g)]
          .map(([, level]) => ({
            dataset: { level },
            addEventListener: (evt, fn) => state.handlers.toggle.push({ level, fn }),
          }));
      }
      if (sel === '.unit-item') {
        return [...state.html.matchAll(/class="unit-item" data-id="([^"]+)"/g)]
          .map(([, id]) => ({
            dataset: { id },
            addEventListener: (evt, fn) => state.handlers.unitItem.push({ id, fn }),
          }));
      }
      return [];
    },
    get _handlers() { return state.handlers; },
  };
}

// 10.5B：number/title(印尼语原名)/goal/level/lessons 从清单 meta 摊平回来
// （见 app.js courseUnits 分支），titleZh 是清单条目自己的 title。
// 恢复 Task 10 删掉的显示：单元号、印尼语原名、学习目标、「N 课」，以及 A1/A2 分组。
//
// 折叠功能上线后默认全折叠，unit-item 不再直接出现在 HTML 里——这条测试要看
// 这些字段，所以显式传一个已展开的 Set，跳过折叠这一层，专测字段摊平对不对。
test('meta 摊平后的 number/title/goal/lessons 摆出来', () => {
  const root = fakeRoot();
  renderCourseUnits(root, [{
    id: 'u01', titleZh: '第一课：问候', title: 'Perkenalan', number: '01', goal: '学会打招呼', level: 'A1', lessons: 4,
  }], { open() {}, back() {} }, new Set(['A1']));
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
  ], { open() {}, back() {} }, new Set(['A1']));
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
  ], { open() {}, back() {} }, new Set(['A1', 'A2']));

  const groups = root.innerHTML.split('<h3 class="level-head">').slice(1);
  const a1Group = groups.find((g) => g.includes('level-tag">A1 初级<'));
  const a2Group = groups.find((g) => g.includes('level-tag">A2 初中级<'));
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
  }, new Set(['A1']));
  assert.match(root.innerHTML, /unit-lock/);
});

test('free 单元不带锁标', () => {
  const root = fakeRoot();
  renderCourseUnits(root, [{ id: 'u01', titleZh: '第一课', level: 'A1', tier: 'free' }], {
    open() {}, back() {},
  }, new Set(['A1']));
  assert.doesNotMatch(root.innerHTML, /unit-lock/);
});

test('paid 单元但账号 active：不带锁标', () => {
  const root = fakeRoot();
  renderCourseUnits(root, [{ id: 'u01', titleZh: '第一课', level: 'A1', tier: 'paid' }], {
    open() {}, back() {}, account: { status: 'active', trialEndsAt: null },
  }, new Set(['A1']));
  assert.doesNotMatch(root.innerHTML, /unit-lock/);
});

// number/title/goal/lessons 为 null（坏数据兜底、新模块没给 meta）时不崩、不猜、
// 不显示 undefined——历史上这里读 u.lessons.length，undefined.length 会直接崩。
test('清单条目（无 number/title/goal/lessons/level）渲染不抛错，标题正常显示', () => {
  const root = fakeRoot();
  assert.doesNotThrow(() => {
    renderCourseUnits(root, [{ id: 'u01', titleZh: '第一课：问候' }], { open() {}, back() {} }, new Set(['A1']));
  });
  assert.match(root.innerHTML, /第一课：问候/);
  assert.doesNotMatch(root.innerHTML, /undefined/);
  assert.doesNotMatch(root.innerHTML, /\d+\s*课/);
});

// —— BUG2：课程页按分级折叠，进入时全折叠（见 bugfix 报告） ——
// 本项目不做任何进度记录：展开状态不写 localStorage，只活在这次调用的闭包里，
// 所以「默认」就是不传第四个参数时的样子，调用方（app.js）也确实是这么调的。

test('默认全折叠：单元标题不出现在 HTML 里，折叠开关 aria-expanded 都是 false', () => {
  const root = fakeRoot();
  renderCourseUnits(root, [
    { id: 'u01', titleZh: '第一课', level: 'A1' },
    { id: 'u02', titleZh: '第二课', level: 'A2' },
  ], { open() {}, back() {} });
  assert.doesNotMatch(root.innerHTML, /class="unit-title">第一课/);
  assert.doesNotMatch(root.innerHTML, /class="unit-title">第二课/);
  assert.doesNotMatch(root.innerHTML, /aria-expanded="true"/);
  const expandedFlags = [...root.innerHTML.matchAll(/aria-expanded="(true|false)"/g)].map((m) => m[1]);
  assert.equal(expandedFlags.length, 2);
  assert.ok(expandedFlags.every((f) => f === 'false'));
});

test('传入展开状态后，对应分级的单元标题才出现，另一分级仍折叠', () => {
  const root = fakeRoot();
  renderCourseUnits(root, [
    { id: 'u01', titleZh: '第一课', level: 'A1' },
    { id: 'u02', titleZh: '第二课', level: 'A2' },
  ], { open() {}, back() {} }, new Set(['A1']));
  assert.match(root.innerHTML, /class="unit-title">第一课/);
  assert.doesNotMatch(root.innerHTML, /class="unit-title">第二课/);
  const a1Btn = root.innerHTML.match(/data-level="A1" aria-expanded="(true|false)"/);
  const a2Btn = root.innerHTML.match(/data-level="A2" aria-expanded="(true|false)"/);
  assert.equal(a1Btn[1], 'true');
  assert.equal(a2Btn[1], 'false');
});

test('折叠开关是 <button> 加 aria-expanded，不是拿 div 加 onclick 凑合（无障碍要求）', () => {
  const root = fakeRoot();
  renderCourseUnits(root, [{ id: 'u01', titleZh: 'a', level: 'A1' }], { open() {}, back() {} });
  assert.match(root.innerHTML, /<button class="level-toggle"[^>]*aria-expanded="false"[^>]*>/);
});

test('分级标题用中文名，且带该级单元数：A1 → “A1 初级”，A2 → “A2 初中级”', () => {
  const root = fakeRoot();
  renderCourseUnits(root, [
    { id: 'u01', titleZh: 'a', level: 'A1' },
    { id: 'u02', titleZh: 'b', level: 'A1' },
    { id: 'u03', titleZh: 'c', level: 'A2' },
  ], { open() {}, back() {} });
  assert.match(root.innerHTML, /level-tag">A1 初级</);
  assert.match(root.innerHTML, /level-tag">A2 初中级</);
  assert.match(root.innerHTML, /2\s*个单元/);
  assert.match(root.innerHTML, /1\s*个单元/);
});

// 光传参数能验证「展开状态该渲染成什么样」，但证明不了折叠开关真的接了线——
// 这条用能记回调的假 DOM，真的「点」一下按钮，看重渲染后的 HTML 变没变。
test('点击折叠开关后重渲染，对应分级展开，单元标题出现', () => {
  const root = fakeRootWithCapture();
  renderCourseUnits(root, [
    { id: 'u01', titleZh: '第一课', level: 'A1' },
  ], { open() {}, back() {} });
  assert.doesNotMatch(root.innerHTML, /第一课/);

  const toggle = root._handlers.toggle.find((h) => h.level === 'A1');
  assert.ok(toggle, '没找到 A1 的折叠开关，说明没绑事件');
  toggle.fn();

  assert.match(root.innerHTML, /第一课/);
  assert.match(root.innerHTML, /data-level="A1" aria-expanded="true"/);
});

// 再点一下应该收回去——折叠开关是开关，不是只能展开的一次性按钮。
test('展开后再点一次折叠开关，收回去', () => {
  const root = fakeRootWithCapture();
  renderCourseUnits(root, [
    { id: 'u01', titleZh: '第一课', level: 'A1' },
  ], { open() {}, back() {} });

  root._handlers.toggle.find((h) => h.level === 'A1').fn();
  assert.match(root.innerHTML, /第一课/);

  root._handlers.toggle.find((h) => h.level === 'A1').fn();
  assert.doesNotMatch(root.innerHTML, /第一课/);
  assert.match(root.innerHTML, /data-level="A1" aria-expanded="false"/);
});
