import { test } from 'node:test';
import assert from 'node:assert/strict';
import { iconFor, codepointsInUse, coverage } from '../lib/icons.js';
import { WORD_EMOJI, THEME_EMOJI } from '../lib/emoji-map.js';

test('词有映射时用词的图', () => {
  assert.equal(iconFor('apel', '水果'), `assets/openmoji/${WORD_EMOJI.apel}.svg`);
});

test('词无映射时退回主题图', () => {
  assert.equal(
    iconFor('kata-yang-tidak-ada', '水果'),
    `assets/openmoji/${THEME_EMOJI['水果']}.svg`,
  );
});

test('词与主题都无映射时退回默认图', () => {
  assert.equal(
    iconFor('zzz', '不存在的主题'),
    `assets/openmoji/${THEME_EMOJI['默认']}.svg`,
  );
});

test('大小写与空白不影响匹配', () => {
  assert.equal(iconFor('  APEL ', '水果'), `assets/openmoji/${WORD_EMOJI.apel}.svg`);
});

test('codepointsInUse 收集词与主题两类码位且去重', () => {
  const packs = [
    { title: '水果', words: [{ word: 'apel' }, { word: 'zzz-unknown' }] },
    { title: '水果', words: [{ word: 'apel' }] },
  ];
  const cps = codepointsInUse(packs);
  assert.ok(cps.includes(WORD_EMOJI.apel));
  assert.ok(cps.includes(THEME_EMOJI['水果']));
  assert.ok(cps.includes(THEME_EMOJI['默认']));
  assert.equal(new Set(cps).size, cps.length);
});

test('coverage 统计专属配图比例', () => {
  const packs = [
    { title: '水果', words: [{ word: 'apel' }, { word: 'zzz-unknown' }] },
  ];
  assert.deepEqual(coverage(packs), { total: 2, hit: 1, percent: 50 });
});

test('THEME_EMOJI 必须有默认项', () => {
  assert.ok(THEME_EMOJI['默认']);
});
