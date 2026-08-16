// 词 → 配图路径。三级回退：词映射 → 主题映射 → 默认图。
import { WORD_EMOJI, THEME_EMOJI } from './emoji-map.js';

const DIR = 'assets/openmoji';
const FALLBACK = '默认';

function key(s) {
  return String(s ?? '').trim().toLowerCase();
}

export function codepointFor(word, themeTitle) {
  return (
    WORD_EMOJI[key(word)] ??
    THEME_EMOJI[String(themeTitle ?? '').trim()] ??
    THEME_EMOJI[FALLBACK]
  );
}

export function iconFor(word, themeTitle) {
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
export function coverage(packs) {
  let total = 0;
  let hit = 0;
  for (const pack of packs ?? []) {
    for (const w of pack.words ?? []) {
      total++;
      if (WORD_EMOJI[key(w.word)]) hit++;
    }
  }
  return { total, hit, percent: total ? Math.round((100 * hit) / total) : 0 };
}
