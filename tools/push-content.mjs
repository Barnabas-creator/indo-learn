// 把 content-src/ 的内容切成单元灌进 D1。
//
// 用法：
//   node tools/push-content.mjs --version c2            # 真推
//   node tools/push-content.mjs --version c2 --dry-run  # 只打印将要写入的单元数与字节数
//
// 只在个人开发机手动跑：SQL 里带全部内容明文，经 wrangler 子进程走文件传递
// （不走 --command，250 个单元约 1.5MB，命令行放不下）。
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { splitIntoUnits } from './content-units.mjs';

export const sqlQuote = (s) => `'${String(s).replace(/'/g, "''")}'`;

// list 型模块（roots/dialogs/grammar/course）的源数据 id 如果重名，splitIntoUnits
// 不报错——它只管切分，不管撞车。真正炸的地方是 D1 的 (module, unit_id) 主键，
// 那时候错误信息指向 SQL 约束，跟数据源哪个文件的哪条记录重名对不上号，排查很费劲。
// 所以在拼 SQL 之前就查一遍，报错直接带上 module 和重复的 id，方便回头改数据源。
function assertNoDuplicateUnitIds(units) {
  const seen = new Set();
  for (const u of units) {
    const key = `${u.module}\0${u.unitId}`;
    if (seen.has(key)) {
      throw new Error(`内容单元 id 重复：module=${u.module} unitId=${u.unitId}`);
    }
    seen.add(key);
  }
}

// sqlQuote 对 SQLite 是正确且够用的：单引号翻倍是唯一需要的转义，SQLite 不认反斜杠转义。
// 风险在下游——wrangler d1 execute --file= 怎么把整份 SQL 切成多条语句去执行，历史上
// 有已知 bug（cloudflare/workers-sdk #2366 #2329 #3892）：字符串字面量里的半角 `;` 会被
// 误当成语句结束符切断。今天 content-src/*.json 里没有半角 `;`（中文标点用的是全角 `；`），
// 所以现在不会踩，但内容是自由文本，将来出现是合理的。如果哪次推送失败且报错位置诡异，
// 先怀疑这个，别先怀疑这里的 SQL 拼装逻辑。
export function buildSql(units, version, builtAt) {
  assertNoDuplicateUnitIds(units);
  const lines = units.map((u) => {
    const title = u.title === null || u.title === undefined ? 'NULL' : sqlQuote(u.title);
    // meta 为 null 要写裸 SQL NULL，不能写成字符串 'null'——查询函数按「解析失败/为
    // null 就给 null」处理，字符串 'null' 会被 JSON.parse 出一个合法的 null 值，
    // 跟真正没有 meta 混在一起分不清（虽然结果凑巧一样，但语义上是两回事）。
    const meta = u.meta === null || u.meta === undefined ? 'NULL' : sqlQuote(JSON.stringify(u.meta));
    return 'INSERT OR REPLACE INTO content (module, unit_id, tier, version, title, meta, body) VALUES ('
      + `${sqlQuote(u.module)}, ${sqlQuote(u.unitId)}, ${sqlQuote(u.tier)}, ${sqlQuote(version)}, `
      + `${title}, ${meta}, ${sqlQuote(JSON.stringify(u.body))});`;
  });
  // 先写全部单元，再删旧版本残留，最后落版本号：中途失败最坏是「有新单元但版本号还是旧的」，
  // 前端看到版本没变会继续用缓存，不会拿到半套内容。
  lines.push(`DELETE FROM content WHERE version != ${sqlQuote(version)};`);
  lines.push(
    'INSERT OR REPLACE INTO content_meta (id, version, built_at) VALUES (1, '
    + `${sqlQuote(version)}, ${builtAt});`,
  );
  return lines.join('\n');
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const arg = (name) => {
    const i = process.argv.indexOf(`--${name}`);
    return i >= 0 ? process.argv[i + 1] : null;
  };
  const version = arg('version');
  if (!version) {
    console.error('缺少版本号。用法：node tools/push-content.mjs --version c2');
    process.exit(1);
  }
  const dryRun = process.argv.includes('--dry-run');

  const read = (f) => JSON.parse(readFileSync(join(root, 'content-src', f), 'utf8'));
  const content = {
    packs: read('words.json'),
    roots: read('roots.json'),
    dialogs: read('dialogs.json'),
    grammar: read('grammar.json'),
    course: read('course.json'),
    listening: read('listening.json'),
  };
  const freeIds = JSON.parse(readFileSync(join(root, 'content-src/free-units.json'), 'utf8'));

  const units = splitIntoUnits(content, freeIds);
  const sql = buildSql(units, version, Date.now());
  const freeCount = units.filter((u) => u.tier === 'free').length;
  console.log(`单元 ${units.length} 个（free ${freeCount}），SQL ${Math.round(sql.length / 1024)} KB`);
  if (dryRun) process.exit(0);

  const file = join(mkdtempSync(join(tmpdir(), 'indo-push-')), 'content.sql');
  writeFileSync(file, sql);
  execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', 'indo-learn', '--remote', `--file=${file}`],
    { cwd: join(root, 'server'), stdio: 'inherit' },
  );
  console.log('已推送。');
}
