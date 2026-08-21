// 运维脚本：查账号、停用/启用账号、重置密码、查激活码绑定情况。
//
// ⚠️ 只在个人开发机手动跑——直接改生产 D1（indo-learn），不接 CI、不接共享机器。
// 跟 tools/push-content-key.mjs 一样，密码明文会经由 wrangler 子进程的命令行
// 参数传递（reset-password 时是密码算出来的哈希/盐，不是明文密码本身，
// 但同机其他进程仍能在 ps 里看到这条命令的参数），所以别在别人能看到你屏幕/
// 进程列表的机器上跑。
//
// 激活码取消过期机制之后（见 server/src/routes.js），僵尸码不会再自动失效，
// 只能靠这个脚本定期人工清理：先 `codes --stale` 看一眼有哪些，确认之后
// `prune-codes --yes` 删掉。
//
// 「僵尸码」的判定不能只看「已绑账号但从未激活」——注册即送试用上线后，
// 每个新账号从诞生起就有一张这样的码（等付费后才激活），若不加时间和状态
// 限制，会把所有还在试用期、尚未付费的正常用户也当成僵尸码删掉，删码等于
// 删掉他们付费后唯一能对上的那个码。所以还要求：账号不是 active（已付费的
// 不碰），且已经过了 STALE_GRACE_DAYS 天宽限期（试用到期后，或没有试用记录
// 时码发出后）——给「试用结束后才慢慢决定买」的人留够反应时间。见下面
// buildStaleWhereClause。
//
// 用法：
//   node tools/admin.mjs list [--email 关键字]
//   node tools/admin.mjs disable <email>
//   node tools/admin.mjs enable <email>
//   node tools/admin.mjs reset-password <email> --password <新密码>
//   node tools/admin.mjs codes [--unused] [--stale]       # --stale 见 STALE_GRACE_DAYS 宽限期口径
//   node tools/admin.mjs prune-codes [--yes]
//   node tools/admin.mjs grant-trial <email> --days <N>   # 补/延长试用期，账号变 trial 状态
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { hashPassword } from '../server/src/crypto.js';

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

// 僵尸码宽限期（天）：账号的试用到期时间（或没有试用记录时码的发出时间）过了这么久
// 还没激活，才真正算「不会再转化」的僵尸码。别写魔法数字，改天数只改这一处。
export const STALE_GRACE_DAYS = 30;
const STALE_GRACE_MS = STALE_GRACE_DAYS * 86400_000;

// 僵尸码共用判定：codes --stale 和 prune-codes 必须用同一套条件，「看到的」
// 和「删掉的」才会是同一批。三个条件都要满足：
//   1. account_id IS NOT NULL AND used_at IS NULL —— 已绑定账号但从未激活
//   2. 账号状态不是 active —— 已付费的一律不碰
//   3. 已经过了宽限期 —— 账号有 trial_ends_at 的，按它过期算；没有（老式
//      pending 账号）的，按码的 issued_at 算
// 列名不加表前缀：这段 WHERE 既要能拼进单表的 DELETE FROM codes（没有别名），
// 也要能拼进 SELECT ... FROM codes JOIN accounts a 的查询——accounts 表除了
// 这里显式用 a. 限定的 status/trial_ends_at 之外没有同名列，不会有歧义。
export function buildStaleWhereClause(now = Date.now()) {
  const cutoff = now - STALE_GRACE_MS;
  return `account_id IS NOT NULL AND used_at IS NULL AND EXISTS (
    SELECT 1 FROM accounts a WHERE a.id = account_id AND a.status != 'active'
      AND (
        (a.trial_ends_at IS NOT NULL AND a.trial_ends_at < ${cutoff})
        OR (a.trial_ends_at IS NULL AND issued_at < ${cutoff})
      )
  )`;
}

// list：只选 id/email/status/trial_ends_at/created_at，绝不选 password_hash / salt。
export function buildListSql(emailLike) {
  const cols = 'id, email, status, trial_ends_at, created_at';
  if (emailLike) {
    return `SELECT ${cols} FROM accounts WHERE email LIKE ${q(`%${emailLike}%`)} ORDER BY id;`;
  }
  return `SELECT ${cols} FROM accounts ORDER BY id;`;
}

export function buildSetStatusSql(email, status) {
  return `UPDATE accounts SET status = ${q(status)} WHERE email = ${q(email)};`;
}

// grant-trial：手动把账号设成 trial 并把到期时间延到 now + days 天——用于给老账号
// 补一段试用，或者负责人想手动延长某个用户的试用期。days 由调用方（CLI 层）校验为正整数，
// 这里只管拼 SQL；trialEndsAt 是算好的绝对时间戳（毫秒），跟服务端 TRIAL_MS 的算法一致。
export function buildGrantTrialSql(email, trialEndsAt) {
  return `UPDATE accounts SET status = 'trial', trial_ends_at = ${Number(trialEndsAt)} WHERE email = ${q(email)};`;
}

export function buildResetPasswordSql(email, hash, salt) {
  return `UPDATE accounts SET password_hash = ${q(hash)}, salt = ${q(salt)} WHERE email = ${q(email)};`;
}

// codes：SUBSTR 在 SQL 里就把哈希截断，完整哈希从头到尾不出数据库、不落终端。
// 取消过期机制后 expires_at 这一列继续保留——库里还有一批取消之前发出的旧码
// 带真实过期时间，负责人偶尔还要看它们；新码都是 NULL，一眼能分清新旧。
export function buildCodesSql(unusedOnly, staleOnly = false, now = Date.now()) {
  // 僵尸码：跟 accounts 表 JOIN 一下，多带出账号状态与试用到期时间——负责人
  // 删之前要能看清删的是谁（还在试用期的正常用户 vs 真正没人要的码）。
  if (staleOnly) {
    const cols = 'SUBSTR(code_hash, 1, 8) AS hash_prefix, account_id, used_at, expires_at, '
      + 'a.status AS account_status, a.trial_ends_at AS account_trial_ends_at';
    return `SELECT ${cols} FROM codes JOIN accounts a ON a.id = account_id `
      + `WHERE ${buildStaleWhereClause(now)} ORDER BY issued_at;`;
  }
  const cols = 'SUBSTR(code_hash, 1, 8) AS hash_prefix, account_id, used_at, expires_at';
  if (unusedOnly) {
    return `SELECT ${cols} FROM codes WHERE account_id IS NULL ORDER BY issued_at;`;
  }
  return `SELECT ${cols} FROM codes ORDER BY issued_at;`;
}

// prune-codes：删掉僵尸码。跟 --stale 用同一个 buildStaleWhereClause，
// 保证「看到的」和「删掉的」是同一批。
export function buildPruneCodesSql(now = Date.now()) {
  return `DELETE FROM codes WHERE ${buildStaleWhereClause(now)};`;
}

export function buildStaleCountSql(now = Date.now()) {
  return `SELECT COUNT(*) AS n FROM codes WHERE ${buildStaleWhereClause(now)};`;
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
  } else if (cmd === 'grant-trial') {
    const email = positional(1);
    const daysArg = flag('--days');
    const days = Number(daysArg);
    if (!email || !daysArg || !Number.isFinite(days) || days <= 0) {
      console.error('缺参数或天数不对。用法：node tools/admin.mjs grant-trial <email> --days <N>');
      process.exit(1);
    }
    const trialEndsAt = Date.now() + days * 86400_000;
    run(buildGrantTrialSql(email, trialEndsAt), root);
    console.log(`已把 ${email} 设为 trial，试用到期时间：${new Date(trialEndsAt).toISOString()}`);
  } else if (cmd === 'prune-codes') {
    if (process.argv.includes('--yes')) {
      run(buildPruneCodesSql(), root);
      console.log(`已删除僵尸码（已绑账号但从未激活、且已过 ${STALE_GRACE_DAYS} 天宽限期、账号未付费的码）。`);
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
      '  node tools/admin.mjs grant-trial <email> --days <N>   # 补/延长试用期',
    ].join('\n'));
    process.exit(1);
  }
}
