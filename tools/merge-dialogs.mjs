// 把 content-src/dialogs/*.json 合并成 content-src/dialogs.json。
// 分文件写，是为了能一批批打磨，不用每次重写整份。
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export function mergeDialogs(files) {
  const out = [];
  const seen = new Map();
  for (const [name, list] of files) {
    for (const d of list) {
      if (seen.has(d.id)) {
        console.error(`警告：对话 ${d.id} 在 ${seen.get(d.id)} 与 ${name} 中重复`);
      }
      seen.set(d.id, name);
      out.push(d);
    }
  }
  return out;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const dir = join(root, 'content-src/dialogs');
  const files = [];
  if (existsSync(dir)) {
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
      files.push([f, JSON.parse(readFileSync(join(dir, f), 'utf8'))]);
    }
  }
  const dialogs = mergeDialogs(files);
  writeFileSync(
    join(root, 'content-src/dialogs.json'),
    JSON.stringify(dialogs, null, 2),
  );
  const lines = dialogs.reduce((n, d) => n + d.lines.length, 0);
  console.log(`合并 ${dialogs.length} 组对话 / ${lines} 轮 -> content-src/dialogs.json`);
}
