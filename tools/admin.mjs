// 运维脚本：查账号、停用/启用账号、重置密码、查激活码绑定情况。
//
// ⚠️ 只在个人开发机手动跑——直接改生产 D1（indo-learn），不接 CI、不接共享机器。
// 跟 tools/push-content-key.mjs 一样，密码明文会经由 wrangler 子进程的命令行
// 参数传递（reset-password 时是密码算出来的哈希/盐，不是明文密码本身，
// 但同机其他进程仍能在 ps 里看到这条命令的参数），所以别在别人能看到你屏幕/
// 进程列表的机器上跑。
//
// 激活码取消过期机制之后（见 server/src/routes.js），僵尸码（已绑定账号但
// 从未激活）不会再自动失效，只能靠这个脚本定期人工清理：先 `codes --stale`
// 看一眼有哪些，确认之后 `prune-codes --yes` 删掉。
//
// 用法：
//   node tools/admin.mjs list [--email 关键字]
//   node tools/admin.mjs disable <email>
//   node tools/admin.mjs enable <email>
//   node tools/admin.mjs reset-password <email> --password <新密码>
//   node tools/admin.mjs codes [--unused] [--stale]
//   node tools/admin.mjs prune-codes [--yes]
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
// 取消过期机制后 expires_at 这一列继续保留——库里还有一批取消之前发出的旧码
// 带真实过期时间，负责人偶尔还要看它们；新码都是 NULL，一眼能分清新旧。
export function buildCodesSql(unusedOnly, staleOnly = false) {
  const cols = 'SUBSTR(code_hash, 1, 8) AS hash_prefix, account_id, used_at, expires_at';
  // 僵尸码：已经绑定了账号、但从来没被激活用掉——这是取消过期之后唯一会
  // 无限堆积的码，负责人要定期看一眼、决定要不要用 prune-codes 清掉。
  if (staleOnly) {
    return `SELECT ${cols} FROM codes WHERE account_id IS NOT NULL AND used_at IS NULL ORDER BY issued_at;`;
  }
  if (unusedOnly) {
    return `SELECT ${cols} FROM codes WHERE account_id IS NULL ORDER BY issued_at;`;
  }
  return `SELECT ${cols} FROM codes ORDER BY issued_at;`;
}

// prune-codes：删掉僵尸码（已绑账号但从未激活）。跟 --stale 用同一条筛选条件，
// 保证「看到的」和「删掉的」是同一批。
export function buildPruneCodesSql() {
  return 'DELETE FROM codes WHERE account_id IS NOT NULL AND used_at IS NULL;';
}

export function buildStaleCountSql() {
  return 'SELECT COUNT(*) AS n FROM codes WHERE account_id IS NOT NULL AND used_at IS NULL;';
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
    run(buildCodesSql(process.argv.includes('--unused'), process.argv.includes('--stale')), root);
  } else if (cmd === 'prune-codes') {
    if (process.argv.includes('--yes')) {
      run(buildPruneCodesSql(), root);
      console.log('已删除僵尸码（已绑定账号但从未激活的码）。');
    } else {
      // 不带 --yes 只查数、不删——取消过期机制后僵尸码只能靠人工清理，
      // 误删一条就是误伤一个还没激活的真实用户，必须让负责人先看到数字再确认。
      run(buildStaleCountSql(), root);
      console.log('以上是将要删除的僵尸码条数（未真正删除）。确认无误后加 --yes 才会执行：');
      console.log('  node tools/admin.mjs prune-codes --yes');
    }
  } else {
    console.error([
      '用法：',
      '  node tools/admin.mjs list [--email 关键字]',
      '  node tools/admin.mjs disable <email>',
      '  node tools/admin.mjs enable <email>',
      '  node tools/admin.mjs reset-password <email> --password <新密码>',
      '  node tools/admin.mjs codes [--unused] [--stale]',
      '  node tools/admin.mjs prune-codes [--yes]   # --stale 列表默认只查数，加 --yes 才真删',
    ].join('\n'));
    process.exit(1);
  }
}
