// 骨架（content-src/skeleton.json）+ 词条表（content-src/words.json）拼成完整包列表。
// 骨架和词条分开存放：补词条只重打加密包，骨架变动不必重新加密。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export function joinPacks(skeleton, words) {
  return skeleton.map((p) => ({ ...p, words: words[p.id] ?? [] }));
}

// onlyFilled：只要已填词的包（准备中的包不是错误，多数脚本不该看见它们）
export function loadPacks({ onlyFilled = true } = {}) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const read = (f) => JSON.parse(readFileSync(join(root, 'content-src', f), 'utf8'));
  const packs = joinPacks(read('skeleton.json'), read('words.json'));
  return onlyFilled ? packs.filter((p) => p.words.length) : packs;
}
