import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleRegister, handleLogin, TRIAL_MS } from './routes.js';
import { hashPassword, signToken } from './crypto.js';
import { handleActivate, handleContentKey, handleRequestCode } from './routes.js';
import { hashCode } from './codes.js';

function req(body, ip = '1.1.1.1') {
  return new Request('https://api.test/x', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip },
    body: JSON.stringify(body),
  });
}

// 内存版假 D1：够跑通路由逻辑
function memDb() {
  const accounts = [];
  const codes = [];
  const attempts = [];
  const db = {
    accounts, codes, attempts,
    prepare(sql) {
      const stmt = { sql, args: [] };
      return {
        bind(...args) { stmt.args = args; return this; },
        async first() {
          if (/FROM accounts WHERE email/.test(sql)) {
            return accounts.find((a) => a.email === stmt.args[0]) ?? null;
          }
          if (/FROM accounts WHERE id/.test(sql)) {
            return accounts.find((a) => a.id === stmt.args[0]) ?? null;
          }
          if (/FROM codes/.test(sql)) {
            return codes.find((c) => c.code_hash === stmt.args[0]) ?? null;
          }
          if (/COUNT\(\*\)/.test(sql)) {
            const [ip, endpoint, since] = stmt.args;
            return { n: attempts.filter((a) => a.ip === ip && a.endpoint === endpoint && a.ts > since).length };
          }
          if (/FROM content_keys/.test(sql)) {
            return db.contentKey ?? null;
          }
          return null;
        },
        async run() {
          if (/INSERT INTO accounts/.test(sql)) {
            const [email, password_hash, salt, status, trial_ends_at, created_at] = stmt.args;
            const id = accounts.length + 1;
            accounts.push({
              id, email, password_hash, salt, status, trial_ends_at, created_at,
            });
            return { meta: { last_row_id: id } };
          }
          if (/INSERT INTO codes/.test(sql)) {
            codes.push({
              code_hash: stmt.args[0], account_id: stmt.args[1], used_at: null, expires_at: stmt.args[3] ?? null,
            });
          }
          if (/INSERT INTO attempts/.test(sql)) {
            attempts.push({ ip: stmt.args[0], endpoint: stmt.args[1], ts: stmt.args[2] });
          }
          if (/UPDATE accounts/.test(sql)) {
            const acc = accounts.find((a) => a.id === stmt.args[1]);
            if (acc) acc.status = stmt.args[0];
          }
          if (/UPDATE codes SET account_id/.test(sql)) {
            const c = codes.find((cd) => cd.code_hash === stmt.args[2]);
            if (c) { c.account_id = stmt.args[0]; c.used_at = stmt.args[1]; }
          }
          if (/UPDATE codes SET expires_at/.test(sql)) {
            const accountId = stmt.args[0];
            codes.filter((cd) => cd.account_id === accountId && cd.used_at === null)
              .forEach((cd) => { cd.expires_at = 0; });
          }
          return { meta: { last_row_id: 0 } };
        },
      };
    },
  };
  return db;
}

const env = () => ({ DB: memDb(), SESSION_SECRET: 'rahasia', AUTO_ISSUE_CODE: 'true' });

test('注册成功返回激活码（自动发码模式）', async () => {
  const res = await handleRegister(req({ email: 'a@b.com', password: 'rahasia123' }), env());
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.match(body.code, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
});

test('关掉自动发码时不返回码', async () => {
  const e = { ...env(), AUTO_ISSUE_CODE: 'false' };
  const res = await handleRegister(req({ email: 'a@b.com', password: 'rahasia123' }), e);
  const body = await res.json();
  assert.equal(body.code, undefined);
  assert.equal(body.ok, true);
});

test('邮箱重复报 email_taken', async () => {
  const e = env();
  await handleRegister(req({ email: 'a@b.com', password: 'rahasia123' }), e);
  const res = await handleRegister(req({ email: 'a@b.com', password: 'rahasia123' }), e);
  assert.equal(res.status, 409);
  assert.equal((await res.json()).error, 'email_taken');
});

test('密码太短报 weak_password', async () => {
  const res = await handleRegister(req({ email: 'a@b.com', password: '123' }), env());
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'weak_password');
});

test('邮箱格式不对报 invalid_email', async () => {
  const res = await handleRegister(req({ email: 'bukan-email', password: 'rahasia123' }), env());
  assert.equal((await res.json()).error, 'invalid_email');
});

test('登录成功返回令牌与状态（注册即送试用，新账号状态是 trial）', async () => {
  const e = env();
  await handleRegister(req({ email: 'a@b.com', password: 'rahasia123' }), e, 1000);
  const res = await handleLogin(req({ email: 'a@b.com', password: 'rahasia123' }), e, 1000);
  const body = await res.json();
  assert.ok(body.token);
  assert.equal(body.status, 'trial');
  assert.equal(body.trialEndsAt, 1000 + TRIAL_MS);
});

test('试用已过期的账号登录仍应成功（不该被误导成密码不对，过期与否由 /content-key 判定）', async () => {
  const e = env();
  await handleRegister(req({ email: 'a@b.com', password: 'rahasia123' }), e, 1000);
  e.DB.accounts[0].trial_ends_at = 500; // 手动改成过去的时间戳，模拟试用已过期
  const res = await handleLogin(req({ email: 'a@b.com', password: 'rahasia123' }), e, 999999);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.token);
  assert.equal(body.status, 'trial');
});

test('密码错报 bad_credentials', async () => {
  const e = env();
  await handleRegister(req({ email: 'a@b.com', password: 'rahasia123' }), e);
  const res = await handleLogin(req({ email: 'a@b.com', password: 'salah-sekali' }), e);
  assert.equal(res.status, 401);
  assert.equal((await res.json()).error, 'bad_credentials');
});

test('账号不存在也报 bad_credentials（不泄露账号是否存在）', async () => {
  const res = await handleLogin(req({ email: 'nobody@b.com', password: 'rahasia123' }), env());
  assert.equal((await res.json()).error, 'bad_credentials');
});

test('同一 IP 一分钟内登录超过 10 次被限流', async () => {
  const e = env();
  await handleRegister(req({ email: 'a@b.com', password: 'rahasia123' }), e);
  for (let i = 0; i < 10; i++) {
    await handleLogin(req({ email: 'a@b.com', password: 'salah-sekali' }), e, 1000);
  }
  const res = await handleLogin(req({ email: 'a@b.com', password: 'rahasia123' }), e, 1000);
  assert.equal(res.status, 429);
  assert.equal((await res.json()).error, 'too_many_attempts');
});

test('同一 IP 一小时内注册超过 3 次被限流（比登录更严）', async () => {
  const e = env();
  for (let i = 0; i < 3; i++) {
    await handleRegister(req({ email: `u${i}@b.com`, password: 'rahasia123' }), e, 1000);
  }
  const res = await handleRegister(req({ email: 'u3@b.com', password: 'rahasia123' }), e, 1000);
  assert.equal(res.status, 429);
  assert.equal((await res.json()).error, 'too_many_attempts');
});

test('disabled 账号登录被拒', async () => {
  const e = env();
  await handleRegister(req({ email: 'a@b.com', password: 'rahasia123' }), e);
  e.DB.accounts[0].status = 'disabled';
  const res = await handleLogin(req({ email: 'a@b.com', password: 'rahasia123' }), e);
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, 'account_disabled');
});

test('disabled 账号取内容密钥被拒', async () => {
  const e = env();
  const { code, token } = await registerAndLogin(e);
  await handleActivate(authReq(token, { code }), e);
  e.DB.accounts[0].status = 'disabled';
  e.DB.contentKey = { version: 'v5', cek: 'KUNCI' };
  const res = await handleContentKey(authReq(token), e);
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, 'account_disabled');
});

function authReq(token, body = {}) {
  return new Request('https://api.test/x', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'cf-connecting-ip': '1.1.1.1',
    },
    body: JSON.stringify(body),
  });
}

async function registerAndLogin(e) {
  const reg = await (await handleRegister(req({ email: 'a@b.com', password: 'rahasia123' }), e)).json();
  const log = await (await handleLogin(req({ email: 'a@b.com', password: 'rahasia123' }), e)).json();
  return { code: reg.code, token: log.token };
}

test('用正确的码激活后账号变 active', async () => {
  const e = env();
  const { code, token } = await registerAndLogin(e);
  const res = await handleActivate(authReq(token, { code }), e);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).status, 'active');
  assert.equal(e.DB.accounts[0].status, 'active');
});

test('错误的码报 bad_code', async () => {
  const e = env();
  const { token } = await registerAndLogin(e);
  const res = await handleActivate(authReq(token, { code: 'ZZZZ-ZZZZ-ZZZZ-ZZZZ' }), e);
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'bad_code');
});

test('码已被别的账号用过报 code_used', async () => {
  const e = env();
  const { code, token } = await registerAndLogin(e);
  await handleActivate(authReq(token, { code }), e);
  e.DB.accounts.push({ id: 2, email: 'c@d.com', status: 'pending' });
  const token2 = await signToken(2, e.SESSION_SECRET);
  const res = await handleActivate(authReq(token2, { code }), e);
  assert.equal(res.status, 409);
  assert.equal((await res.json()).error, 'code_used');
});

test('没令牌取密钥报 unauthorized', async () => {
  const res = await handleContentKey(new Request('https://api.test/content-key'), env());
  assert.equal(res.status, 401);
  assert.equal((await res.json()).error, 'unauthorized');
});

// pending 账号（老式 issue-code.mjs 散码流程，或试用到期后管理员手动改回）取密钥仍报 not_activated。
// 注册流程本身不再产出 pending 账号（新账号一律 trial），这里手动把状态改回 pending 来测这条分支。
test('pending 账号取密钥报 not_activated', async () => {
  const e = env();
  const { token } = await registerAndLogin(e);
  e.DB.accounts[0].status = 'pending';
  e.DB.accounts[0].trial_ends_at = null;
  const res = await handleContentKey(authReq(token), e);
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, 'not_activated');
});

test('已激活账号能取到内容密钥，expiresAt 是 30 天后（不受试用限制）', async () => {
  const e = env();
  const { code, token } = await registerAndLogin(e);
  await handleActivate(authReq(token, { code }), e);
  e.DB.contentKey = { version: 'v5', cek: 'KUNCI' };
  const res = await handleContentKey(authReq(token), e, 1000);
  const body = await res.json();
  assert.equal(body.cek, 'KUNCI');
  assert.equal(body.contentVersion, 'v5');
  assert.equal(body.expiresAt, 1000 + 30 * 86400_000);
  assert.equal(body.trialEndsAt, null);
});

// --- 注册即送 7 天试用：/content-key 对 trial 状态的放行/拦截 ---

test('试用未过期能取到密钥，expiresAt 截断到 trial_ends_at（不是 30 天后）', async () => {
  const e = env();
  const reg = await (await handleRegister(req({ email: 'a@b.com', password: 'rahasia123' }), e, 1000)).json();
  const log = await (await handleLogin(req({ email: 'a@b.com', password: 'rahasia123' }), e, 1000)).json();
  e.DB.contentKey = { version: 'v5', cek: 'KUNCI' };
  const res = await handleContentKey(authReq(log.token), e, 2000);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.cek, 'KUNCI');
  assert.equal(body.trialEndsAt, reg.trialEndsAt);
  // 关键：截断到试用到期时间，不是 now + 30 天——否则缓存一把 30 天的钥匙就能离线用满 30 天。
  assert.equal(body.expiresAt, reg.trialEndsAt);
  assert.ok(body.expiresAt < 2000 + 30 * 86400_000);
});

test('试用已过期取密钥返回 403 trial_expired', async () => {
  const e = env();
  const { token } = await registerAndLogin(e);
  e.DB.accounts[0].trial_ends_at = 500; // 手动改成过去的时间戳
  const res = await handleContentKey(authReq(token), e, 999999);
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, 'trial_expired');
});

test('disabled 的试用账号取密钥仍报 account_disabled，不是 trial_expired', async () => {
  const e = env();
  const { token } = await registerAndLogin(e);
  e.DB.accounts[0].trial_ends_at = 500; // 试用也已过期
  e.DB.accounts[0].status = 'disabled';
  const res = await handleContentKey(authReq(token), e, 999999);
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, 'account_disabled');
});

test('试用账号用码激活后变 active，此后取密钥不再受试用期限制', async () => {
  const e = env();
  const { code, token } = await registerAndLogin(e);
  e.DB.accounts[0].trial_ends_at = 500; // 试用早就过期了
  const activateRes = await handleActivate(authReq(token, { code }), e, 999999);
  assert.equal(activateRes.status, 200);
  assert.equal((await activateRes.json()).status, 'active');
  assert.equal(e.DB.accounts[0].status, 'active');

  e.DB.contentKey = { version: 'v5', cek: 'KUNCI' };
  const res = await handleContentKey(authReq(token), e, 999999);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.cek, 'KUNCI');
  assert.equal(body.expiresAt, 999999 + 30 * 86400_000); // 不再截断到早已过期的 trial_ends_at
});

test('已激活账号重复用自己的码仍成功（幂等）', async () => {
  const e = env();
  const { code, token } = await registerAndLogin(e);
  await handleActivate(authReq(token, { code }), e);
  const res = await handleActivate(authReq(token, { code }), e);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).status, 'active');
});

test('已激活账号提交另一张未使用的码不会吞掉它', async () => {
  const e = env();
  const { code, token } = await registerAndLogin(e);
  await handleActivate(authReq(token, { code }), e);
  const otherCode = 'ABCD-EFGH-JKMN-PQRS';
  const otherHash = await hashCode(otherCode);
  e.DB.codes.push({ code_hash: otherHash, account_id: null, used_at: null });
  const res = await handleActivate(authReq(token, { code: otherCode }), e);
  assert.equal(res.status, 200);
  const row = e.DB.codes.find((c) => c.code_hash === otherHash);
  assert.equal(row.account_id, null);
});

test('disabled 账号提交合法未用码报 account_disabled 且码未被标记已用', async () => {
  const e = env();
  const { code, token } = await registerAndLogin(e);
  e.DB.accounts[0].status = 'disabled';
  const res = await handleActivate(authReq(token, { code }), e);
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, 'account_disabled');
  // 码从注册起就已经绑定到这个账号本身（不再是 null），但 disabled 账号
  // 走不到 bindCode 那一步，used_at 应该仍是 null。
  const codeHash = await hashCode(code);
  const row = e.DB.codes.find((c) => c.code_hash === codeHash);
  assert.equal(row.used_at, null);
});

// --- 卖码模式：注册当场绑定码到新账号，码不设过期时间 ---

test('注册当场生成码并绑定到刚建的账号，不设过期时间', async () => {
  const e = env();
  const res = await handleRegister(req({ email: 'a@b.com', password: 'rahasia123' }), e, 1000);
  const body = await res.json();
  assert.equal(e.DB.codes.length, 1);
  assert.equal(e.DB.codes[0].account_id, body.accountId);
  assert.equal(e.DB.codes[0].expires_at, null);
});

test('卖码模式（AUTO_ISSUE_CODE=false）注册也生成并绑定码，但不把明文返回给注册者', async () => {
  const e = { ...env(), AUTO_ISSUE_CODE: 'false' };
  const res = await handleRegister(req({ email: 'a@b.com', password: 'rahasia123' }), e);
  const body = await res.json();
  assert.equal(body.code, undefined);
  assert.equal(body.ok, true);
  assert.equal(body.codeIssued, true);
  assert.equal(e.DB.codes.length, 1);
  assert.equal(e.DB.codes[0].account_id, body.accountId);
});

test('过期的码激活报 code_expired', async () => {
  const e = env();
  const { code, token } = await registerAndLogin(e);
  const codeHash = await hashCode(code);
  const row = e.DB.codes.find((c) => c.code_hash === codeHash);
  row.expires_at = 500; // 手动改成过去的时间戳
  const res = await handleActivate(authReq(token, { code }), e, 999999);
  assert.equal(res.status, 410);
  assert.equal((await res.json()).error, 'code_expired');
});

test('新码没有过期时间，久置也能正常激活', async () => {
  const e = env();
  const { code, token } = await registerAndLogin(e);
  // 隔了很久才激活（模拟负责人半夜没看到通知，用户第二天早上才拿到码）：
  // 换算成很大的 now，老的 3 小时 TTL 早就会报 code_expired，新逻辑下应正常成功。
  const res = await handleActivate(authReq(token, { code }), e, 999 * 3600_000);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).status, 'active');
});

test('未绑定的码（issue-code.mjs 预生成的散码，无过期时间）仍可正常激活', async () => {
  const e = env();
  const { token } = await registerAndLogin(e);
  const freeCode = 'ABCD-EFGH-JKMN-PQRS';
  const freeHash = await hashCode(freeCode);
  e.DB.codes.push({
    code_hash: freeHash, account_id: null, used_at: null, expires_at: null,
  });
  const res = await handleActivate(authReq(token, { code: freeCode }), e);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).status, 'active');
});

test('注册推送文案：新用户试用中，带邮箱、激活码（先攥着）、试用到期时间（雅加达时区）', async () => {
  const e = { ...env(), TELEGRAM_BOT_TOKEN: 'T', TELEGRAM_CHAT_ID: 'C' };
  let pushedText = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    pushedText = JSON.parse(options.body).text;
    return new Response('{"ok":true}', { status: 200 });
  };
  try {
    await handleRegister(req({ email: 'a@b.com', password: 'rahasia123' }), e, 1000);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.match(pushedText, /^🔑 新用户试用中/);
  assert.match(pushedText, /邮箱：a@b\.com/);
  assert.match(pushedText, /激活码：[A-Z2-9-]+（付费后发给他）/);
  assert.match(pushedText, /试用到期：\d+月\d+日 \d{2}:\d{2}/);
});

// --- POST /request-code ---

test('request-code：trial 账号作废旧码、生成新码', async () => {
  const e = env();
  const { token } = await registerAndLogin(e);
  assert.equal(e.DB.codes.length, 1);
  const oldHash = e.DB.codes[0].code_hash;
  assert.equal(e.DB.codes[0].expires_at, null); // 作废前：新码本来就没有过期时间
  const res = await handleRequestCode(authReq(token, {}), e, 5000);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(e.DB.codes.length, 2);
  const oldRow = e.DB.codes.find((c) => c.code_hash === oldHash);
  assert.equal(oldRow.expires_at, 0); // 旧码作废：NULL（未过期）→ 0（已作废）
  const newRow = e.DB.codes.find((c) => c.code_hash !== oldHash);
  assert.equal(newRow.account_id, e.DB.accounts[0].id);
  assert.equal(newRow.expires_at, null); // 新码同样不设过期时间
});

test('request-code 推送文案：trial 账号带上试用到期时间', async () => {
  const e = { ...env(), TELEGRAM_BOT_TOKEN: 'T', TELEGRAM_CHAT_ID: 'C' };
  const { token } = await registerAndLogin(e);
  let pushedText = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    pushedText = JSON.parse(options.body).text;
    return new Response('{"ok":true}', { status: 200 });
  };
  try {
    await handleRequestCode(authReq(token, {}), e, 5000);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.match(pushedText, /^🔄 重新申请激活码/);
  assert.match(pushedText, /此码长期有效，直到被使用。/);
  assert.match(pushedText, /试用到期：\d+月\d+日 \d{2}:\d{2}/);
});

test('request-code 推送文案：pending 账号（trial_ends_at 为空）不带试用到期行', async () => {
  const e = { ...env(), TELEGRAM_BOT_TOKEN: 'T', TELEGRAM_CHAT_ID: 'C' };
  const { token } = await registerAndLogin(e);
  e.DB.accounts[0].status = 'pending';
  e.DB.accounts[0].trial_ends_at = null;
  let pushedText = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    pushedText = JSON.parse(options.body).text;
    return new Response('{"ok":true}', { status: 200 });
  };
  try {
    await handleRequestCode(authReq(token, {}), e, 5000);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.doesNotMatch(pushedText, /试用到期/);
});

// 这是取消过期机制之后最容易出错的地方：新码 expires_at 默认是 NULL，
// 重新申请时必须确认「作废」这个动作对 NULL 起点的码仍然有效——
// 不能只看 db.js 层面的 UPDATE 有没有执行，要跑一遍真实的「作废后再激活」
// 全流程，确认旧码激活失败、新码激活成功。
test('重新申请后，旧码（原本 expires_at 为 NULL）激活必须失败，新码必须成功', async () => {
  // handleRequestCode 的 JSON 响应不带明文码（卖码模式的常态：明文只进 Telegram
  // 推送）。这里配上 Telegram 凭据、假 fetch 拦截推送请求体，把新码的明文从
  // 消息文本里抠出来，才能真正走一遍「用新码激活」这条链路，而不是只看 DB 行。
  const e = { ...env(), TELEGRAM_BOT_TOKEN: 'T', TELEGRAM_CHAT_ID: 'C' };
  const { code: oldCode, token } = await registerAndLogin(e);

  let pushedText = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    pushedText = JSON.parse(options.body).text;
    return new Response('{"ok":true}', { status: 200 });
  };
  let reqRes;
  try {
    reqRes = await handleRequestCode(authReq(token, {}), e, 5000);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(reqRes.status, 200);
  const newCode = pushedText.match(/激活码：([A-Z0-9-]+)/)[1];
  assert.notEqual(newCode, oldCode);

  // 旧码：绑定关系还在（account_id 没变），但已被作废，激活必须报 code_expired。
  const oldRes = await handleActivate(authReq(token, { code: oldCode }), e, 6000);
  assert.equal(oldRes.status, 410);
  assert.equal((await oldRes.json()).error, 'code_expired');
  assert.equal(e.DB.accounts[0].status, 'trial'); // 没有被旧码误激活

  // 新码：expires_at 从 NULL 起步，激活必须成功。
  const newRes = await handleActivate(authReq(token, { code: newCode }), e, 6000);
  assert.equal(newRes.status, 200);
  assert.equal((await newRes.json()).status, 'active');
});

test('request-code：active 账号直接返回 active，不生成新码', async () => {
  const e = env();
  const { code, token } = await registerAndLogin(e);
  await handleActivate(authReq(token, { code }), e);
  const before = e.DB.codes.length;
  const res = await handleRequestCode(authReq(token, {}), e);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, status: 'active' });
  assert.equal(e.DB.codes.length, before);
});

test('request-code：disabled 账号报 account_disabled', async () => {
  const e = env();
  const { token } = await registerAndLogin(e);
  e.DB.accounts[0].status = 'disabled';
  const res = await handleRequestCode(authReq(token, {}), e);
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, 'account_disabled');
});

test('request-code：没令牌报 unauthorized', async () => {
  const res = await handleRequestCode(new Request('https://api.test/request-code', {
    method: 'POST', headers: { 'cf-connecting-ip': '1.1.1.1' },
  }), env());
  assert.equal(res.status, 401);
  assert.equal((await res.json()).error, 'unauthorized');
});

// --- ctx.waitUntil：Telegram 推送 fire-and-forget，不拖慢注册/重新申请的响应 ---

test('handleRegister 传入带 waitUntil 的 ctx 时，推送交给 waitUntil，不等待它完成', async () => {
  const e = { ...env(), TELEGRAM_BOT_TOKEN: 'T', TELEGRAM_CHAT_ID: 'C' };
  const originalFetch = globalThis.fetch;
  let notifyFetchCalled = false;
  // 永不 resolve：模拟 Telegram 卡住。如果 handler 还在 await 这个 fetch，
  // 下面的 handleRegister 调用会一直挂着，测试超时失败。
  globalThis.fetch = () => { notifyFetchCalled = true; return new Promise(() => {}); };
  const waited = [];
  const ctx = { waitUntil: (p) => waited.push(p) };
  let res;
  try {
    res = await handleRegister(req({ email: 'a@b.com', password: 'rahasia123' }), e, 1000, ctx);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(res.status, 200);
  assert.equal(notifyFetchCalled, true); // 推送确实发起了……
  assert.equal(waited.length, 1); // ……但交给了 ctx.waitUntil，不是被 handler await
});

test('handleRegister 没有 ctx（本地测试/开发环境）时仍照旧 await 推送', async () => {
  const e = { ...env(), TELEGRAM_BOT_TOKEN: 'T', TELEGRAM_CHAT_ID: 'C' };
  let notifyResolved = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { notifyResolved = true; return new Response('{"ok":true}', { status: 200 }); };
  try {
    await handleRegister(req({ email: 'a@b.com', password: 'rahasia123' }), e, 1000);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(notifyResolved, true); // 没有 ctx 时退回 await：函数返回时推送必然已经跑完
});

test('handleRequestCode 传入带 waitUntil 的 ctx 时，推送交给 waitUntil，不等待它完成', async () => {
  const e = { ...env(), TELEGRAM_BOT_TOKEN: 'T', TELEGRAM_CHAT_ID: 'C' };
  const { token } = await registerAndLogin(e);
  const originalFetch = globalThis.fetch;
  let notifyFetchCalled = false;
  globalThis.fetch = () => { notifyFetchCalled = true; return new Promise(() => {}); };
  const waited = [];
  const ctx = { waitUntil: (p) => waited.push(p) };
  let res;
  try {
    res = await handleRequestCode(authReq(token, {}), e, 5000, ctx);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(res.status, 200);
  assert.equal(notifyFetchCalled, true);
  assert.equal(waited.length, 1);
});

test('request-code：同一 IP 一小时内超过 3 次被限流', async () => {
  const e = env();
  const { token } = await registerAndLogin(e);
  for (let i = 0; i < 3; i++) {
    await handleRequestCode(authReq(token, {}), e, 1000);
  }
  const res = await handleRequestCode(authReq(token, {}), e, 1000);
  assert.equal(res.status, 429);
  assert.equal((await res.json()).error, 'too_many_attempts');
});
