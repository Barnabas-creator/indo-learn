// 词 → 配图路径。四级回退：自绘图 → 词映射 → 主题映射 → 默认图。
//
// 自绘图排在最前：那些词之所以要自己画，正是因为 OpenMoji 里找不到贴切的图形，
// 让它被别的东西盖掉就白画了。
import { WORD_EMOJI, THEME_EMOJI } from './emoji-map.js';
import { WORD_SVG } from './word-svg.js';

const DIR = 'assets/openmoji';
const SVG_DIR = 'assets/word-svg';
const FALLBACK = '默认';

function key(s) {
  return String(s ?? '').trim().toLowerCase();
}

export function svgFor(word) {
  return WORD_SVG[key(word)] ?? null;
}

export function codepointFor(word, themeTitle) {
  return (
    WORD_EMOJI[key(word)] ??
    THEME_EMOJI[String(themeTitle ?? '').trim()] ??
    THEME_EMOJI[FALLBACK]
  );
}

export function iconFor(word, themeTitle) {
  const drawn = svgFor(word);
  if (drawn) return `${SVG_DIR}/${drawn}.svg`;
  return `${DIR}/${codepointFor(word, themeTitle)}.svg`;
}

export function codepointsInUse(packs) {
  const set = new Set([THEME_EMOJI[FALLBACK]]);
  for (const pack of packs ?? []) {
    const theme = THEME_EMOJI[String(pack.title ?? '').trim()];
    if (theme) set.add(theme);
    for (const w of pack.words ?? []) {
      const cp = WORD_EMOJI[key(w.word)];
      if (cp) set.add(cp);
    }
  }
  return [...set];
}

// 词表中已配到专属图的比例，用于产出覆盖率报告。
// 自绘图与 OpenMoji 同样算「专属」——它就是为这个词画的。
export function coverage(packs) {
  let total = 0;
  let hit = 0;
  for (const pack of packs ?? []) {
    for (const w of pack.words ?? []) {
      total++;
      if (WORD_SVG[key(w.word)] || WORD_EMOJI[key(w.word)]) hit++;
    }
  }
  return { total, hit, percent: total ? Math.round((100 * hit) / total) : 0 };
}
