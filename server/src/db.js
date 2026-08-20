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

export async function insertCode(db, { codeHash, accountId, now }) {
  await db
    .prepare('INSERT INTO codes (code_hash, account_id, issued_at) VALUES (?, ?, ?)')
    .bind(codeHash, accountId, now)
    .run();
}

export function findCode(db, codeHash) {
  return db
    .prepare('SELECT code_hash, account_id, used_at FROM codes WHERE code_hash = ?')
    .bind(codeHash)
    .first();
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
