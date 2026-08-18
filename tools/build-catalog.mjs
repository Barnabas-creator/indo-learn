// 由 content-src/skeleton.json 生成 lib/catalog.js（明文骨架，App 直接 import）。
// 骨架不加密：主题名不敏感，且「准备中」的包也要在 UI 上列出来。
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const LEVELS = [
  { id: 'beginner', title: '初级', subtitle: '日常高频词，看图背单词' },
  { id: 'intermediate', title: '中级', subtitle: '人际、职场、生活场景' },
  { id: 'advanced', title: '高级', subtitle: '社会、专业与抽象话题' },
];

export function buildCatalogSource(skeleton) {
  const byLevel = {};
  for (const p of skeleton) (byLevel[p.level] ??= []).push(p);

  const levels = LEVELS.map(
    (l) => `  { id: ${JSON.stringify(l.id)}, title: ${JSON.stringify(l.title)}, `
      + `subtitle: ${JSON.stringify(l.subtitle)} },`,
  ).join('\n');

  const packs = LEVELS.map((l) => {
    const rows = (byLevel[l.id] ?? [])
      .map(
        (p) => `    { id: ${JSON.stringify(p.id)}, title: ${JSON.stringify(p.title)}, `
          + `subtitle: ${JSON.stringify(p.subtitle)} },`,
      )
      .join('\n');
    return `  ${l.id}: [\n${rows}\n  ],`;
  }).join('\n');

  return `// 由 tools/build-catalog.mjs 生成，勿手改。
// 三级主题骨架。哪个包已开放由词条表决定（词条在加密包里），这里只管顺序和标题。

export const LEVELS = [
${levels}
];

export const PACKS = {
${packs}
};
`;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const skeleton = JSON.parse(
    readFileSync(join(root, 'content-src/skeleton.json'), 'utf8'),
  );
  writeFileSync(join(root, 'lib/catalog.js'), buildCatalogSource(skeleton));
  console.log(`生成 lib/catalog.js（${skeleton.length} 个包）`);
}
