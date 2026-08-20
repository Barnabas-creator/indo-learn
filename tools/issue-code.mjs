// 本地批量生成激活码：只把哈希灌进 D1，明文只打印到终端。
// 用于 AUTO_ISSUE_CODE=false（卖码模式）——注册不再自动发码，
// 负责人要先用这个脚本批量备好码，再手动发给买家（微信/邮件等）。
//
// 用法：node tools/issue-code.mjs --count 5
//
// SQL 走 wrangler d1 execute --remote --command，与 tools/push-content-key.mjs
// 同样的做法：手写字符串拼接 + 单引号转义（D1 的 --command 不支持传参绑定）。
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { generateCode, hashCode } from '../server/src/codes.js';

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

// 纯函数、不碰网络，方便单测：给定一批已经算好的哈希，拼出一条批量 INSERT。
export function buildInsertSql(codeHashes, now) {
  const rows = codeHashes.map((h) => `(${q(h)}, NULL, ${now})`).join(', ');
  return `INSERT INTO codes (code_hash, account_id, issued_at) VALUES ${rows};`;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const i = process.argv.indexOf('--count');
  const count = i >= 0 ? Number(process.argv[i + 1]) : 1;
  if (!Number.isInteger(count) || count < 1) {
    console.error('数量不对。用法：node tools/issue-code.mjs --count <正整数>');
    process.exit(1);
  }

  const now = Date.now();
  const codes = Array.from({ length: count }, () => generateCode());
  const hashes = await Promise.all(codes.map((c) => hashCode(c)));

  const sql = buildInsertSql(hashes, now);
  execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', 'indo-learn', '--remote', '--command', sql],
    { cwd: join(root, 'server'), stdio: 'inherit' },
  );

  console.log(`已生成并写入 ${count} 张激活码（哈希已入库，明文只打印这一次，请立刻保存/发放）：`);
  for (const code of codes) console.log(code);
}
