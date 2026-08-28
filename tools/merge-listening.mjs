// 把 content-src/listening/*.json 合并成 content-src/listening.json。
// 一个单元一个文件，做一课打磨一课。
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export function mergeListening(files) {
  const out = [];
  const seen = new Map();
  for (const [name, list] of files) {
    for (const item of list) {
      if (seen.has(item.id)) {
        console.error(`警告：听力 ${item.id} 在 ${seen.get(item.id)} 与 ${name} 中重复`);
      }
      seen.set(item.id, name);
      out.push(item);
    }
  }
  return out;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const dir = join(root, 'content-src/listening');
  const files = [];
  if (existsSync(dir)) {
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
      files.push([f, JSON.parse(readFileSync(join(dir, f), 'utf8'))]);
    }
  }
  const items = mergeListening(files);
  writeFileSync(join(root, 'content-src/listening.json'), JSON.stringify(items, null, 2));
  const secs = items.reduce((n, i) => n + (i.seconds ?? 0), 0);
  console.log(
    `合并 ${items.length} 段听力 / ${new Set(items.map((i) => i.unit)).size} 个单元 / `
    + `${Math.round(secs / 60)} 分钟 -> content-src/listening.json`,
  );
}
