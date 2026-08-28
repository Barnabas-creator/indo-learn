// 把 content-src/roots/*.json 合并成 content-src/roots.json。
// 跟对话、课程一样分文件写，一次打磨一批，不用每次重写整份。
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// 词根包在列表里按序号显示，编号取包在合并结果里的位置——
// 跟单词包一个规矩：屏幕上的编号就是「我背到第几包」。
export function mergeRoots(files) {
  const out = [];
  const seen = new Map();
  for (const [name, list] of files) {
    for (const p of list) {
      if (seen.has(p.id)) {
        console.error(`警告：词根包 ${p.id} 在 ${seen.get(p.id)} 与 ${name} 中重复`);
      }
      seen.set(p.id, name);
      out.push({ ...p, no: String(out.length + 1).padStart(2, '0') });
    }
  }
  return out;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const dir = join(root, 'content-src/roots');
  const files = [];
  if (existsSync(dir)) {
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
      files.push([f, JSON.parse(readFileSync(join(dir, f), 'utf8'))]);
    }
  }
  const packs = mergeRoots(files);
  writeFileSync(join(root, 'content-src/roots.json'), JSON.stringify(packs, null, 2));
  const words = packs.reduce((n, p) => n + p.words.length, 0);
  console.log(`合并 ${packs.length} 个词根包 / ${words} 个词根 -> content-src/roots.json`);
}
