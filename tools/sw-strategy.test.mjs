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

test('外壳资源走 cache-first', () => {
  assert.equal(chooseStrategy('/index.html'), 'cache-first');
  assert.equal(chooseStrategy('/lib/provider.js'), 'cache-first');
  assert.equal(chooseStrategy('/assets/openmoji/1F34E.svg'), 'cache-first');
});

test('子路径部署（GitHub Pages）下依然正确', () => {
  assert.equal(chooseStrategy('/印尼语学习/data/keys.json'), 'network-first');
  assert.equal(chooseStrategy('/印尼语学习/data/manifest.json'), 'network-first');
  assert.equal(chooseStrategy('/印尼语学习/data/v1/packs.enc'), 'cache-first');
});
