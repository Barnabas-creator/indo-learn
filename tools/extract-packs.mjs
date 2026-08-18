// 从小程序解包所得的 packs.js 中提取三级单词包骨架（词条本身不在解包里）。
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const FIELD = String.raw`id: "([^"]+)",\s*title: "([^"]+)",\s*subtitle: "([^"]*)",\s*total: (\d+),\s*added: \d+,\s*icon: "[^"]*",\s*theme: "([^"]*)",\s*category: "[^"]*",\s*level: "([^"]*)",\s*stage: (\d+)`;

// level 省略时提取全部三级；给了就只要那一级。同级内按 stage 升序。
export function parsePackSkeleton(source, level) {
  const re = new RegExp(FIELD, 'g');
  const out = [];
  for (const m of source.matchAll(re)) {
    const [, id, title, subtitle, total, theme, lv, stage] = m;
    if (level && lv !== level) continue;
    out.push({
      id,
      level: lv,
      title,
      subtitle,
      theme,
      stage: Number(stage),
      total: Number(total),
    });
  }
  const order = { beginner: 0, intermediate: 1, advanced: 2 };
  out.sort((a, b) => (order[a.level] ?? 9) - (order[b.level] ?? 9) || a.stage - b.stage);
  return out;
}

// 自定义包按 level + stage 插进骨架，排序规则与解包骨架一致。
export function mergeExtra(skeleton, extra = []) {
  const order = { beginner: 0, intermediate: 1, advanced: 2 };
  return [...skeleton, ...extra].sort(
    (a, b) => (order[a.level] ?? 9) - (order[b.level] ?? 9) || a.stage - b.stage,
  );
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const src = readFileSync(join(root, 'reference/packs.js'), 'utf8');
  // 小程序骨架之外，自己补的包写在 content-src/extra-packs.json（初级词表的洞就靠它补）
  let extra = [];
  try {
    extra = JSON.parse(readFileSync(join(root, 'content-src/extra-packs.json'), 'utf8'));
  } catch {
    extra = [];
  }
  const packs = mergeExtra(parsePackSkeleton(src), extra);
  mkdirSync(join(root, 'content-src'), { recursive: true });
  writeFileSync(
    join(root, 'content-src/skeleton.json'),
    JSON.stringify(packs, null, 2),
  );
  const byLevel = packs.reduce((acc, p) => {
    acc[p.level] = (acc[p.level] ?? 0) + 1;
    return acc;
  }, {});
  console.log(
    `提取 ${packs.length} 个包 -> content-src/skeleton.json（`
    + Object.entries(byLevel).map(([k, v]) => `${k} ${v}`).join(' / ') + '）',
  );
}
