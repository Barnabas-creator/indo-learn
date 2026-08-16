// 按映射表从 jsdelivr 拉取用到的 OpenMoji SVG 子集。
// 不安装 npm 全量包（几百 MB），只下载实际引用到的码位。
//
// OpenMoji 17.0.0，授权 CC-BY-SA-4.0 —— 应用内必须署名。
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { codepointsInUse, coverage } from '../lib/icons.js';

const CDN = 'https://cdn.jsdelivr.net/npm/openmoji@17.0.0/color/svg';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'assets/openmoji');
mkdirSync(outDir, { recursive: true });

const packs = JSON.parse(
  readFileSync(join(root, 'content-src/packs.json'), 'utf8'),
);
const cps = codepointsInUse(packs);

let downloaded = 0;
let skipped = 0;
const missing = [];

for (const cp of cps) {
  const dest = join(outDir, `${cp}.svg`);
  if (existsSync(dest)) {
    skipped++;
    continue;
  }
  const res = await fetch(`${CDN}/${cp}.svg`);
  if (!res.ok) {
    missing.push(cp);
    continue;
  }
  writeFileSync(dest, await res.text());
  downloaded++;
}

const cov = coverage(packs);
console.log(
  `OpenMoji：需要 ${cps.length} 个，新下载 ${downloaded}，已存在 ${skipped}，缺失 ${missing.length}`,
);
console.log(`词条专属配图覆盖率：${cov.hit}/${cov.total}（${cov.percent}%）`);
if (missing.length) {
  console.log('缺失码位（需从 lib/emoji-map.js 移除或替换）：');
  console.log('  ' + missing.join(', '));
  process.exit(1);
}
