import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parentView } from '../lib/nav.js';

test('每一层都能退回上一层', () => {
  assert.equal(parentView('levels'), 'home');
  assert.equal(parentView('grid'), 'levels');
  assert.equal(parentView('cards'), 'grid');
  assert.equal(parentView('congrats'), 'grid');
  assert.equal(parentView('audioCats'), 'home');
  assert.equal(parentView('dialogDetail'), 'dialogList');
  assert.equal(parentView('dialogList'), 'audioCats');
  assert.equal(parentView('listenList'), 'audioCats');
  assert.equal(parentView('listenDetail'), 'listenList');
  assert.equal(parentView('courseUnits'), 'home');
  assert.equal(parentView('courseLessons'), 'courseUnits');
  assert.equal(parentView('courseLesson'), 'courseLessons');
  assert.equal(parentView('rootList'), 'home');
  assert.equal(parentView('rootCards'), 'rootList');
  assert.equal(parentView('rootCongrats'), 'rootList');
  assert.equal(parentView('grammarList'), 'home');
  assert.equal(parentView('grammarModule'), 'grammarList');
  assert.equal(parentView('grammarLesson'), 'grammarModule');
});

test('首页没有上一层（返回不退出应用）', () => {
  assert.equal(parentView('home'), null);
  assert.equal(parentView('不存在的层'), null);
});

// 每一层都必须能一路退到 home，不然会有退不出去的死角。
test('任何一层都能沿父链走回首页', () => {
  const views = [
    'levels', 'grid', 'cards', 'congrats',
    'audioCats', 'dialogList', 'dialogDetail', 'listenList', 'listenDetail',
    'courseUnits', 'courseLessons', 'courseLesson',
    'rootList', 'rootCards', 'rootCongrats',
    'grammarList', 'grammarModule', 'grammarLesson',
  ];
  for (const v of views) {
    let cur = v;
    let steps = 0;
    while (cur !== 'home' && steps < 10) { cur = parentView(cur); steps++; }
    assert.equal(cur, 'home', `${v} 退不回首页`);
  }
});
