// 从小程序解包所得的 packs.js 中提取初级 100 个单词包的骨架。
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const FIELD = String.raw`id: "([^"]+)",\s*title: "([^"]+)",\s*subtitle: "([^"]*)",\s*total: (\d+),\s*added: \d+,\s*icon: "[^"]*",\s*theme: "([^"]*)",\s*category: "[^"]*",\s*level: "([^"]*)",\s*stage: (\d+)`;

export function parsePackSkeleton(source) {
  const re = new RegExp(FIELD, 'g');
  const out = [];
  for (const m of source.matchAll(re)) {
    const [, id, title, subtitle, total, theme, level, stage] = m;
    if (level !== 'beginner') continue;
    out.push({
      id,
      title,
      subtitle,
      theme,
      stage: Number(stage),
      total: Number(total),
      words: [],
    });
  }
  out.sort((a, b) => a.stage - b.stage);
  return out;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const src = readFileSync(join(root, 'reference/packs.js'), 'utf8');
  const packs = parsePackSkeleton(src);
  mkdirSync(join(root, 'content-src'), { recursive: true });
  writeFileSync(
    join(root, 'content-src/pack-skeleton.json'),
    JSON.stringify(packs, null, 2),
  );
  console.log(`提取 ${packs.length} 个初级包 -> content-src/pack-skeleton.json`);
}
