// 把 content-src/course/*.json 合并成 content-src/course.json。
//
// 00-units.json 是十个单元的元信息；其余每个文件是一个单元的课，
// 靠课里的 unit 字段归位（不像语法篇那样靠文件名前缀——课程的文件名带印尼语
// 单元名，前缀匹配会脆）。
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export function mergeCourse(units, files) {
  const byUnit = new Map(units.map((u) => [u.id, []]));
  const seen = new Map();
  const orphans = [];

  for (const [name, lessons] of files) {
    for (const l of lessons) {
      if (!byUnit.has(l?.unit)) {
        orphans.push(`${l?.id ?? '?'}（unit=${l?.unit ?? '空'}，来自 ${name}）`);
        continue;
      }
      if (seen.has(l.id)) {
        console.error(`警告：课 ${l.id} 在 ${seen.get(l.id)} 与 ${name} 中重复`);
      }
      seen.set(l.id, name);
      byUnit.get(l.unit).push(l);
    }
  }
  if (orphans.length) {
    console.error(`警告：这些课的 unit 对不上任何单元，已跳过：${orphans.join('、')}`);
  }

  // 课在单元内按 order 排；空单元不输出——还没写的单元不该在 UI 上占一行「0 课」
  return units
    .map((u) => ({
      ...u,
      lessons: byUnit.get(u.id).sort((a, b) => String(a.order).localeCompare(String(b.order))),
    }))
    .filter((u) => u.lessons.length);
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const dir = join(root, 'content-src/course');
  if (!existsSync(dir)) {
    console.error(`找不到 ${dir}`);
    process.exit(1);
  }
  const units = JSON.parse(readFileSync(join(dir, '00-units.json'), 'utf8'));
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.json') && f !== '00-units.json')
    .sort()
    .map((f) => [f, JSON.parse(readFileSync(join(dir, f), 'utf8'))]);

  const course = mergeCourse(units, files);
  writeFileSync(join(root, 'content-src/course.json'), JSON.stringify(course, null, 2));

  const lessons = course.reduce((n, u) => n + u.lessons.length, 0);
  console.log(`合并 ${course.length} / ${units.length} 单元 / ${lessons} 课 -> content-src/course.json`);
  for (const u of course) console.log(`  ${u.number} ${u.title} ${u.titleZh}：${u.lessons.length} 课`);
}
