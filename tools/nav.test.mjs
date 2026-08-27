import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parentView, isBackSwipe, EDGE_PX, MIN_DX, MAX_DY } from '../lib/nav.js';

test('每一层都能退回上一层', () => {
  assert.equal(parentView('levels'), 'home');
  assert.equal(parentView('grid'), 'levels');
  assert.equal(parentView('cards'), 'grid');
  assert.equal(parentView('congrats'), 'grid');
  assert.equal(parentView('dialogDetail'), 'dialogList');
  assert.equal(parentView('dialogList'), 'home');
  assert.equal(parentView('grammarModule'), 'grammarList');
  assert.equal(parentView('grammarList'), 'home');
  assert.equal(parentView('courseUnits'), 'home');
  assert.equal(parentView('courseLessons'), 'courseUnits');
  assert.equal(parentView('courseLesson'), 'courseLessons');
});

test('首页没有上一层（返回不退出应用）', () => {
  assert.equal(parentView('home'), null);
  assert.equal(parentView('不存在的层'), null);
});

const swipe = (o) => isBackSwipe({ startX: 5, startY: 300, endX: 5 + MIN_DX, endY: 300, ...o });

test('从左边缘向右划够距离算返回', () => {
  assert.equal(swipe({}), true);
  assert.equal(swipe({ startX: EDGE_PX, endX: EDGE_PX + MIN_DX }), true);
});

test('起点不在左边缘不算（要给词卡翻面、横向滚动让路）', () => {
  assert.equal(swipe({ startX: EDGE_PX + 1, endX: EDGE_PX + 1 + MIN_DX }), false);
});

test('划得不够远不算', () => {
  assert.equal(swipe({ endX: 5 + MIN_DX - 1 }), false);
});

test('反方向（向左划）不算', () => {
  assert.equal(swipe({ startX: 5, endX: 0 }), false);
});

test('纵向偏移太大算滚页面，不算返回', () => {
  assert.equal(swipe({ endY: 300 + MAX_DY }), true);
  assert.equal(swipe({ endY: 300 + MAX_DY + 1 }), false);
  assert.equal(swipe({ endY: 300 - MAX_DY - 1 }), false);
});
