// D1 查询封装。每个函数一句 SQL，路由层不写 SQL。
export async function createAccount(db, { email, hash, salt, now }) {
  const res = await db
    .prepare('INSERT INTO accounts (email, password_hash, salt, status, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(email, hash, salt, 'pending', now)
    .run();
  return res.meta.last_row_id;
}

export function findAccountByEmail(db, email) {
  return db
    .prepare('SELECT id, email, password_hash, salt, status FROM accounts WHERE email = ?')
    .bind(email)
    .first();
}

export function findAccountById(db, id) {
  return db.prepare('SELECT id, email, status FROM accounts WHERE id = ?').bind(id).first();
}

export async function setAccountStatus(db, id, status) {
  await db.prepare('UPDATE accounts SET status = ? WHERE id = ?').bind(status, id).run();
}

export async function insertCode(db, {
  codeHash, accountId, now, expiresAt = null,
}) {
  await db
    .prepare('INSERT INTO codes (code_hash, account_id, issued_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(codeHash, accountId, now, expiresAt)
    .run();
}

export function findCode(db, codeHash) {
  return db
    .prepare('SELECT code_hash, account_id, used_at, expires_at FROM codes WHERE code_hash = ?')
    .bind(codeHash)
    .first();
}

// 重新申请激活码时，把这个账号名下所有还没用过的码作废。
//
// 取消过期机制之后，新码的 expires_at 从 NULL 起步（“NULL = 永不过期”），
// 这里仍然沿用「置成 0」的老办法：0（公元纪元）本身就小于任何 now，
// routes.js 里判断是否过期的那句 `expires_at < now` 原封不动地会命中它——
// 相当于借用了同一条过期校验来表达「已作废」，NULL（未过期）与 0（已作废）
// 是两个不同的状态，不会混淆。没有另开一列（比如 revoked_at）是因为这条
// 判断已经够用、够明确，加列纯属多余。作废后不删行，留痕方便排障。
export async function expireCodesOfAccount(db, { accountId }) {
  await db
    .prepare('UPDATE codes SET expires_at = 0 WHERE account_id = ? AND used_at IS NULL')
    .bind(accountId)
    .run();
}

export async function bindCode(db, { codeHash, accountId, now }) {
  await db
    .prepare('UPDATE codes SET account_id = ?, used_at = ? WHERE code_hash = ?')
    .bind(accountId, now, codeHash)
    .run();
}

export function currentContentKey(db) {
  return db
    .prepare('SELECT version, cek FROM content_keys WHERE is_current = 1 ORDER BY created_at DESC LIMIT 1')
    .first();
}

export async function countAttempts(db, { ip, endpoint, since }) {
  const row = await db
    .prepare('SELECT COUNT(*) AS n FROM attempts WHERE ip = ? AND endpoint = ? AND ts > ?')
    .bind(ip, endpoint, since)
    .first();
  return row ? row.n : 0;
}

export async function recordAttempt(db, { ip, endpoint, now }) {
  await db
    .prepare('INSERT INTO attempts (ip, endpoint, ts) VALUES (?, ?, ?)')
    .bind(ip, endpoint, now)
    .run();
}

export async function recordError(db, {
  ts, method, path, name, message,
}) {
  await db
    .prepare('INSERT INTO error_log (ts, method, path, name, message) VALUES (?, ?, ?, ?, ?)')
    .bind(ts, method, path, name, message)
    .run();
}
