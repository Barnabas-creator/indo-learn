// 运维脚本：查账号、停用/启用账号、重置密码、查激活码绑定情况。
//
// ⚠️ 只在个人开发机手动跑——直接改生产 D1（indo-learn），不接 CI、不接共享机器。
// 跟 tools/push-content-key.mjs 一样，密码明文会经由 wrangler 子进程的命令行
// 参数传递（reset-password 时是密码算出来的哈希/盐，不是明文密码本身，
// 但同机其他进程仍能在 ps 里看到这条命令的参数），所以别在别人能看到你屏幕/
// 进程列表的机器上跑。
//
// 用法：
//   node tools/admin.mjs list [--email 关键字]
//   node tools/admin.mjs disable <email>
//   node tools/admin.mjs enable <email>
//   node tools/admin.mjs reset-password <email> --password <新密码>
//   node tools/admin.mjs codes [--unused]
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { hashPassword } from '../server/src/crypto.js';

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

// list：只选 id/email/status/created_at，绝不选 password_hash / salt。
export function buildListSql(emailLike) {
  if (emailLike) {
    return `SELECT id, email, status, created_at FROM accounts WHERE email LIKE ${q(`%${emailLike}%`)} ORDER BY id;`;
  }
  return 'SELECT id, email, status, created_at FROM accounts ORDER BY id;';
}

export function buildSetStatusSql(email, status) {
  return `UPDATE accounts SET status = ${q(status)} WHERE email = ${q(email)};`;
}

export function buildResetPasswordSql(email, hash, salt) {
  return `UPDATE accounts SET password_hash = ${q(hash)}, salt = ${q(salt)} WHERE email = ${q(email)};`;
}

// codes：SUBSTR 在 SQL 里就把哈希截断，完整哈希从头到尾不出数据库、不落终端。
export function buildCodesSql(unusedOnly) {
  const cols = 'SUBSTR(code_hash, 1, 8) AS hash_prefix, account_id, used_at';
  if (unusedOnly) {
    return `SELECT ${cols} FROM codes WHERE account_id IS NULL ORDER BY issued_at;`;
  }
  return `SELECT ${cols} FROM codes ORDER BY issued_at;`;
}

function run(sql, root) {
  execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', 'indo-learn', '--remote', '--command', sql],
    { cwd: join(root, 'server'), stdio: 'inherit' },
  );
}

function flag(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function positional(index) {
  // argv: [node, admin.mjs, <subcommand>, <positional...>]，跳过以 -- 开头的选项
  return process.argv.slice(3).filter((a) => !a.startsWith('--'))[index - 1];
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const cmd = process.argv[2];

  if (cmd === 'list') {
    run(buildListSql(flag('--email')), root);
  } else if (cmd === 'disable' || cmd === 'enable') {
    const email = positional(1);
    if (!email) {
      console.error(`缺邮箱。用法：node tools/admin.mjs ${cmd} <email>`);
      process.exit(1);
    }
    run(buildSetStatusSql(email, cmd === 'disable' ? 'disabled' : 'active'), root);
    console.log(`已把 ${email} 设为 ${cmd === 'disable' ? 'disabled' : 'active'}`);
  } else if (cmd === 'reset-password') {
    const email = positional(1);
    const password = flag('--password');
    if (!email || !password) {
      console.error('缺参数。用法：node tools/admin.mjs reset-password <email> --password <新密码>');
      process.exit(1);
    }
    const { hash, salt } = await hashPassword(password);
    run(buildResetPasswordSql(email, hash, salt), root);
    console.log(`已重置 ${email} 的密码`);
  } else if (cmd === 'codes') {
    run(buildCodesSql(process.argv.includes('--unused')), root);
  } else {
    console.error([
      '用法：',
      '  node tools/admin.mjs list [--email 关键字]',
      '  node tools/admin.mjs disable <email>',
      '  node tools/admin.mjs enable <email>',
      '  node tools/admin.mjs reset-password <email> --password <新密码>',
      '  node tools/admin.mjs codes [--unused]',
    ].join('\n'));
    process.exit(1);
  }
}
