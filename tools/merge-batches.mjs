// 把 content-src/batches/batch-*.json 合并进包骨架，产出 content-src/packs.json。
// 批次文件格式：{ "<包 id>": [ { word, pos, zh, example, exampleZh }, … ] }
// 词条 id 在这里统一生成，格式 <包 id>-<序号>，不用手写。
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const batchDir = join(root, 'content-src/batches');

const skeleton = JSON.parse(
  readFileSync(join(root, 'content-src/pack-skeleton.json'), 'utf8'),
);

const words = {};
if (existsSync(batchDir)) {
  for (const f of readdirSync(batchDir).filter((f) => f.endsWith('.json')).sort()) {
    const batch = JSON.parse(readFileSync(join(batchDir, f), 'utf8'));
    for (const [packId, list] of Object.entries(batch)) {
      if (words[packId]) {
        console.error(`警告：包 ${packId} 在多个批次中出现，后者覆盖前者`);
      }
      words[packId] = list;
    }
  }
}

const packs = skeleton.map((p) => ({
  ...p,
  words: (words[p.id] ?? []).map((w, i) => ({
    id: `${p.id}-${i + 1}`,
    ...w,
  })),
}));

writeFileSync(
  join(root, 'content-src/packs.json'),
  JSON.stringify(packs, null, 2),
);

const filled = packs.filter((p) => p.words.length).length;
const total = packs.reduce((n, p) => n + p.words.length, 0);
console.log(`合并完成：${filled}/${packs.length} 个包已填词，共 ${total} 词`);
