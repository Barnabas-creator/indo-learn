import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseStrategy } from '../sw.js';

test('manifest 与 keys 走 network-first', () => {
  assert.equal(chooseStrategy('/data/manifest.json'), 'network-first');
  assert.equal(chooseStrategy('/data/keys.json'), 'network-first');
});

test('带版本号的加密内容走 cache-first', () => {
  assert.equal(chooseStrategy('/data/v1/packs.enc'), 'cache-first');
  assert.equal(chooseStrategy('/data/v2/grammar.enc'), 'cache-first');
});

test('配图等 assets 走 cache-first', () => {
  assert.equal(chooseStrategy('/assets/openmoji/1F34E.svg'), 'cache-first');
});

// 外壳 cache-first 会把装过 PWA 的手机钉死在旧代码上（安卓「不给 7 天试用」就是这么来的），
// 所以外壳一律 network-first，断网时由 networkFirst 内部回落缓存。
test('外壳资源走 network-first', () => {
  assert.equal(chooseStrategy('/'), 'network-first');
  assert.equal(chooseStrategy('/index.html'), 'network-first');
  assert.equal(chooseStrategy('/app.js'), 'network-first');
  assert.equal(chooseStrategy('/styles.css'), 'network-first');
  assert.equal(chooseStrategy('/lib/provider.js'), 'network-first');
  assert.equal(chooseStrategy('/manifest.webmanifest'), 'network-first');
});

test('子路径部署（GitHub Pages）下依然正确', () => {
  assert.equal(chooseStrategy('/indo-learn/data/keys.json'), 'network-first');
  assert.equal(chooseStrategy('/indo-learn/data/manifest.json'), 'network-first');
  assert.equal(chooseStrategy('/indo-learn/data/v1/packs.enc'), 'cache-first');
  assert.equal(chooseStrategy('/indo-learn/assets/openmoji/1F34E.svg'), 'cache-first');
  assert.equal(chooseStrategy('/indo-learn/app.js'), 'network-first');
  assert.equal(chooseStrategy('/indo-learn/'), 'network-first');
});
