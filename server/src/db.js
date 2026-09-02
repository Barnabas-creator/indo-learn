// D1 查询封装。每个函数一句 SQL，路由层不写 SQL。
// status/trialEndsAt 可传：注册即送试用起，新账号不再总是 'pending'
// （见 routes.js 的 handleRegister），旧调用方不传时仍按原样退化成待激活账号。
export async function createAccount(db, {
  email, hash, salt, now, status = 'pending', trialEndsAt = null,
}) {
  const res = await db
    .prepare('INSERT INTO accounts (email, password_hash, salt, status, trial_ends_at, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(email, hash, salt, status, trialEndsAt, now)
    .run();
  return res.meta.last_row_id;
}

export function findAccountByEmail(db, email) {
  return db
    .prepare('SELECT id, email, password_hash, salt, status, trial_ends_at FROM accounts WHERE email = ?')
    .bind(email)
    .first();
}

export function findAccountById(db, id) {
  return db.prepare('SELECT id, email, status, trial_ends_at FROM accounts WHERE id = ?').bind(id).first();
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

// 清单出 id / tier / title / meta，不带 body——正文一次只发一个单元，是这次改造的重点。
// meta 存的是 JSON 字符串，这里原样透出，解析成对象是路由层 handleContentIndex 的事
// （一行坏 JSON 不该由查询函数决定要不要往外抛错）。
// 11.5：清单对所有人一样，一律出全部单元的元数据——「谁能看正文」由
// GET /content/:module/:id 按账号鉴权把关，这里不再按 tier 过滤，也就不再需要
// includePaid 这个参数了（旧调用方全部换掉了，见 content.js handleContentIndex）。
export async function listContentUnits(db) {
  const res = await db
    .prepare('SELECT module, unit_id, tier, title, meta FROM content ORDER BY module, unit_id')
    .all();
  return res.results ?? [];
}

export function getContentUnit(db, module, unitId) {
  return db
    .prepare('SELECT tier, version, body FROM content WHERE module = ? AND unit_id = ?')
    .bind(module, unitId)
    .first();
}

export async function currentContentVersion(db) {
  const row = await db.prepare('SELECT version FROM content_meta WHERE id = 1').first();
  return row?.version ?? null;
}

// 计数与读取分成两句：D1 的 RETURNING 能一次拿到自增后的值，
// 省掉「先读再写」中间那段并发窗口。
export async function bumpContentHits(db, { subject, day }) {
  const row = await db
    .prepare(
      'INSERT INTO content_hits (subject, day, n) VALUES (?, ?, 1) '
      + 'ON CONFLICT (subject, day) DO UPDATE SET n = n + 1 RETURNING n',
    )
    .bind(subject, day)
    .first();
  return row?.n ?? 1;
}

export async function countContentHits(db, { subject, day }) {
  const row = await db
    .prepare('SELECT n FROM content_hits WHERE subject = ? AND day = ?')
    .bind(subject, day)
    .first();
  return row?.n ?? 0;
}
