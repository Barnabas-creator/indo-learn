// 把 content-src/grammar-book/*.json 合并成 content-src/grammar.json。
// 分文件写，是为了能一节一节转写，不用每次重开整本书。
//
// 00-modules.json 是四篇的元信息 + 文件名前缀；其余每个文件是一节，
// 内含若干「课」（lesson）。课按文件名排序落进对应的篇里。
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export function mergeGrammarBook(modules, files) {
  const byPrefix = new Map(modules.map((m) => [m.prefix, []]));
  const seen = new Map();
  const orphans = [];

  for (const [name, lessons] of files) {
    const prefix = modules.map((m) => m.prefix).find((p) => name.startsWith(p));
    if (!prefix) {
      orphans.push(name);
      continue;
    }
    for (const l of lessons) {
      if (seen.has(l.id)) {
        console.error(`警告：课 ${l.id} 在 ${seen.get(l.id)} 与 ${name} 中重复`);
      }
      seen.set(l.id, name);
      byPrefix.get(prefix).push(l);
    }
  }
  if (orphans.length) {
    console.error(`警告：这些文件的前缀对不上任何一篇，已跳过：${orphans.join(', ')}`);
  }

  // 空篇不输出——转写还没做到的篇不该在 UI 上占一行
  return modules
    .map(({ prefix, ...meta }) => ({ ...meta, lessons: byPrefix.get(prefix) }))
    .filter((m) => m.lessons.length);
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const dir = join(root, 'content-src/grammar-book');
  if (!existsSync(dir)) {
    console.error(`找不到 ${dir}`);
    process.exit(1);
  }
  const modules = JSON.parse(readFileSync(join(dir, '00-modules.json'), 'utf8'));
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.json') && f !== '00-modules.json')
    .sort()
    .map((f) => [f, JSON.parse(readFileSync(join(dir, f), 'utf8'))]);

  const grammar = mergeGrammarBook(modules, files);
  writeFileSync(join(root, 'content-src/grammar.json'), JSON.stringify(grammar, null, 2));

  const lessons = grammar.reduce((n, m) => n + m.lessons.length, 0);
  const entries = grammar.reduce(
    (n, m) => n + m.lessons.reduce((k, l) => k + l.options.length, 0), 0,
  );
  console.log(`合并 ${grammar.length} 篇 / ${lessons} 课 / ${entries} 条 -> content-src/grammar.json`);
  for (const m of grammar) {
    console.log(`  ${m.number} ${m.title}：${m.lessons.length} 课`);
  }
}
