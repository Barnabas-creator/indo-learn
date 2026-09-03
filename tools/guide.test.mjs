import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guideSeen, markGuideSeen, GUIDE_SEEN_KEY, cycleArcAngles, renderGuide } from '../lib/views/guide.js';

// 够 renderGuide 塞 innerHTML、调两次 querySelector(...).addEventListener 用，
// 不引入 jsdom，断言只看渲染出来的 HTML 字符串。
function fakeGuideRoot() {
  return { innerHTML: '', querySelector: () => ({ addEventListener() {} }) };
}

const memStore = () => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
};

test('没看过手册时返回 false，标记后返回 true', () => {
  const s = memStore();
  assert.equal(guideSeen(s), false);
  markGuideSeen(s);
  assert.equal(guideSeen(s), true);
  assert.equal(s.getItem(GUIDE_SEEN_KEY), '1');
});

// 隐私模式下 localStorage 的读写会直接抛。手册弹不弹是小事，
// 整个界面因此崩掉才是大事。
test('storage 抛错时不崩：当作没看过，写入失败也不抛', () => {
  const bad = {
    getItem() { throw new Error('denied'); },
    setItem() { throw new Error('denied'); },
    removeItem() { throw new Error('denied'); },
  };
  assert.equal(guideSeen(bad), false);
  assert.doesNotThrow(() => markGuideSeen(bad));
});

// —— BUG1：环形图四条箭头弧要对称 ——
// 旧版是四条手敲坐标的二次贝塞尔（M214 52q46 20 50 66 之类），起点/控制点/
// 长度各不相同，弧长和箭头位置自然对不上。改成按角度在同一个圆上生成，
// 四条弧只是起始角依次 +90°，半径、跨角必须完全一样。

test('cycleArcAngles：四条弧跨角一样、起始角依次均分 360 度（每条 +90°）', () => {
  const arcs = cycleArcAngles();
  assert.equal(arcs.length, 4);

  const spans = arcs.map((a) => a.end - a.start);
  assert.ok(spans.every((s) => s === spans[0]), '四条弧跨角必须一样，弧长才会一样');
  assert.ok(spans[0] > 0 && spans[0] < 90, '跨角要落在一个象限里，不能重叠到下一个节点');

  for (let i = 1; i < arcs.length; i += 1) {
    assert.equal(arcs[i].start - arcs[i - 1].start, 90, `第 ${i} 条弧的起始角没有比上一条正好多 90 度`);
  }
  // 四个起始角均分一整圈
  assert.equal(arcs[3].start - arcs[0].start, 270);
});

test('渲染出的四条弧路径半径统一，且不再是手写的二次贝塞尔（q 命令）', () => {
  const root = fakeGuideRoot();
  renderGuide(root, { onClose() {} });

  // 旧版四条路径的手写坐标——改完不该再出现
  for (const old of ['M214 52q', 'M262 194q', 'M118 264q', 'M58 148q']) {
    assert.ok(!root.innerHTML.includes(old), `还留着旧的手写坐标 ${old}`);
  }

  const radii = [...root.innerHTML.matchAll(/ A([\d.]+) ([\d.]+) 0 0 1 /g)];
  assert.equal(radii.length, 4, '应该有四条用 A（圆弧）命令画的路径');
  const rx = radii.map((m) => m[1]);
  const ry = radii.map((m) => m[2]);
  assert.ok(rx.every((r) => r === rx[0]) && ry.every((r) => r === ry[0]), '四条弧的半径必须完全一样');
  assert.equal(rx[0], ry[0], '同一条弧的 rx/ry 应该相等，画的是正圆弧不是椭圆');
});

test('长标签「对话与听力」的节点框比短标签宽，不再贴着序号圆圈', () => {
  const root = fakeGuideRoot();
  renderGuide(root, { onClose() {} });

  const widths = [...root.innerHTML.matchAll(/<rect x="-?[\d.]+" y="-19" width="([\d.]+)" height="38"/g)]
    .map((m) => Number(m[1]));
  assert.equal(widths.length, 4);

  // 节点顺序：单词包(0)、语法(1)、对话与听力(2)、课程学习(3)——第三个最宽
  const [wWord, wGrammar, wDialog, wCourse] = widths;
  assert.ok(wDialog > wWord, '「对话与听力」应该比「单词包」宽');
  assert.ok(wDialog > wGrammar, '「对话与听力」应该比「语法」宽');
  assert.ok(wDialog > wCourse, '「对话与听力」应该比「课程学习」宽');
  // 短标签不该被这次改动连带跟着变宽
  assert.equal(wWord, 112);
  assert.equal(wGrammar, 112);
  assert.equal(wCourse, 112);
});
