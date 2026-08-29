import { test } from 'node:test';
import assert from 'node:assert/strict';
import { iconFor, svgFor, codepointsInUse, coverage } from '../lib/icons.js';
import { WORD_SVG } from '../lib/word-svg.js';
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

// —— 自绘配图 ——
// 这些词之所以要自己画，正是因为 OpenMoji 里没有贴切的图形（介词、连接词，
// 以及榴莲、天贝这类印尼特有的东西）。所以它必须排在 OpenMoji 前面。
test('自绘图优先于 OpenMoji 与主题兜底', () => {
  assert.equal(iconFor('durian', '水果'), `assets/word-svg/${WORD_SVG.durian}.svg`);
  assert.equal(iconFor('di', '介词'), `assets/word-svg/${WORD_SVG.di}.svg`);
});

test('svgFor 只认自绘的那批词', () => {
  assert.equal(svgFor('durian'), WORD_SVG.durian);
  assert.equal(svgFor('apel'), null);
});

test('自绘图也算专属配图', () => {
  const packs = [{ title: '水果', words: [{ word: 'durian' }, { word: 'zzz-unknown' }] }];
  assert.deepEqual(coverage(packs), { total: 2, hit: 1, percent: 50 });
});

// 图上出现中文释义等于把答案写在词卡正面——正面只给图和印尼语，翻面才看中文。
test('自绘图里不带中文（aria-label 除外）', async () => {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const dir = join(dirname(fileURLToPath(import.meta.url)), '../assets/word-svg');
  for (const name of Object.values(WORD_SVG)) {
    const svg = readFileSync(join(dir, `${name}.svg`), 'utf8');
    const body = svg.replace(/aria-label="[^"]*"/, '');
    assert.ok(!/[一-鿿]/.test(body), `${name}.svg 图形里有中文`);
  }
});

// 映射里的每个文件都得真的存在，否则词卡上就是个断链的 <img>。
test('WORD_SVG 里的文件都存在', async () => {
  const { existsSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const dir = join(dirname(fileURLToPath(import.meta.url)), '../assets/word-svg');
  for (const name of Object.values(WORD_SVG)) {
    assert.ok(existsSync(join(dir, `${name}.svg`)), `缺文件 ${name}.svg`);
  }
});
