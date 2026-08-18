// 把 content-src/batches/batch-*.json 合并成词条表 content-src/words.json。
// 批次文件格式：{ "<包 id>": [ { word, pos, zh, example, exampleZh }, … ] }
// 词条 id 在这里统一生成，格式 <包 id>-<序号>，不用手写。
// 词条表按包 id 索引，与骨架（lib/catalog.js）分开：补词条只重打加密包。
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export function mergeBatches(batches) {
  const words = {};
  for (const [file, batch] of batches) {
    for (const [packId, list] of Object.entries(batch)) {
      if (words[packId]) {
        console.error(`警告：包 ${packId} 在多个批次中出现（${file}），后者覆盖前者`);
      }
      words[packId] = list.map((w, i) => ({ id: `${packId}-${i + 1}`, ...w }));
    }
  }
  return words;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const batchDir = join(root, 'content-src/batches');
  const batches = [];
  if (existsSync(batchDir)) {
    for (const f of readdirSync(batchDir).filter((x) => x.endsWith('.json')).sort()) {
      batches.push([f, JSON.parse(readFileSync(join(batchDir, f), 'utf8'))]);
    }
  }
  const words = mergeBatches(batches);
  writeFileSync(
    join(root, 'content-src/words.json'),
    JSON.stringify(words, null, 2),
  );
  const total = Object.values(words).reduce((n, l) => n + l.length, 0);
  console.log(`合并 ${Object.keys(words).length} 个包 / ${total} 词 -> content-src/words.json`);
}
