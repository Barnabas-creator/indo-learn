// 把当前内容密钥（CEK）灌进 D1，远程模式下服务器要直接持有它。
// 用法：node tools/push-content-key.mjs --password "$(cat ~/.indo-pass)"
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { deriveKek, unwrapCek, exportCek } from '../lib/crypto.js';

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

export function buildInsertSql({ version, cek }) {
  return [
    'UPDATE content_keys SET is_current = 0;',
    `INSERT OR REPLACE INTO content_keys (version, cek, is_current, created_at)`,
    `VALUES (${q(version)}, ${q(cek)}, 1, ${Date.now()});`,
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
