import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pageIndexFrom } from '../lib/views/pager.js';

test('滚到整页边界时落在那一页', () => {
  assert.equal(pageIndexFrom(0, 390, 4), 0);
  assert.equal(pageIndexFrom(390, 390, 4), 1);
  assert.equal(pageIndexFrom(1170, 390, 4), 3);
});

// scroll-snap 停下前会有零头，四舍五入到最近的一页才不会跳来跳去。
test('滚到一半按最近的一页算', () => {
  assert.equal(pageIndexFrom(150, 390, 4), 0);
  assert.equal(pageIndexFrom(240, 390, 4), 1);
});

test('超出范围会被夹回首尾，不会指到不存在的页', () => {
  assert.equal(pageIndexFrom(-80, 390, 4), 0);
  assert.equal(pageIndexFrom(99999, 390, 4), 3);
});

// 首帧渲染时容器还没布局，clientWidth 是 0——不能拿 0 去做除法。
test('宽度或页数为 0 时返回第一页而不是 NaN', () => {
  assert.equal(pageIndexFrom(100, 0, 4), 0);
  assert.equal(pageIndexFrom(100, 390, 0), 0);
});

// 页数多的时候排一地圆点反而找不着北，超过阈值改成紧凑条。
test('DOTS_MAX 决定圆点还是紧凑条', async () => {
  const { DOTS_MAX } = await import('../lib/views/pager.js');
  assert.equal(typeof DOTS_MAX, 'number');
  assert.ok(4 <= DOTS_MAX, '课程一课四块应该还是圆点');
  assert.ok(DOTS_MAX < 37, '语法词缀篇 37 课应该走紧凑条');
});
