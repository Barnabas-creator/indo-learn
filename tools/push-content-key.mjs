// 把当前内容密钥（CEK）灌进 D1，远程模式下服务器要直接持有它。
// 用法：node tools/push-content-key.mjs --password "$(cat ~/.indo-pass)"
// 注意：明文 CEK 会经由 wrangler 子进程的命令行参数传递，同机其他进程能在 ps 里看到，
// 所以这个脚本只应在个人开发机上手动跑，不要放进 CI 或共享机器。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { deriveKek, unwrapCek, exportCek } from '../lib/crypto.js';

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

// 先插入新行再把旧行置为非当前：中途失败最坏是「两行都当前」，
// 而不是 UPDATE 先跑会导致的「一行都没有」（D1 的 --command 不支持事务）。
export function buildInsertSql({ version, cek }) {
  return [
    'INSERT OR REPLACE INTO content_keys (version, cek, is_current, created_at)',
    `VALUES (${q(version)}, ${q(cek)}, 1, ${Date.now()});`,
    `UPDATE content_keys SET is_current = 0 WHERE version != ${q(version)};`,
  ].join(' ');
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const i = process.argv.indexOf('--password');
  const password = i >= 0 ? process.argv[i + 1] : process.env.CONTENT_PASSWORD;
  if (!password) {
    console.error('缺少密码。用法：node tools/push-content-key.mjs --password <密码>');
    process.exit(1);
  }

  const keys = JSON.parse(readFileSync(join(root, 'data/keys.json'), 'utf8'));
  const manifest = JSON.parse(readFileSync(join(root, 'data/manifest.json'), 'utf8'));
  const kek = await deriveKek(password, keys.kdf.salt, keys.kdf.iterations);
  const cek = await exportCek(await unwrapCek(keys.wrapped, keys.iv, kek));

  const sql = buildInsertSql({ version: manifest.contentVersion, cek });
  execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', 'indo-learn', '--remote', '--command', sql],
    { cwd: join(root, 'server'), stdio: 'inherit' },
  );
  console.log(`内容密钥 ${manifest.contentVersion} 已写入 D1`);
}
