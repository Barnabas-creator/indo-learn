// 四个接口的处理函数。只做参数校验与编排，SQL 在 db.js，算法在 crypto.js / codes.js。
import { hashPassword, verifyPassword, signToken, verifyToken } from './crypto.js';
import { generateCode, hashCode } from './codes.js';
import {
  createAccount, findAccountByEmail, findAccountById, setAccountStatus,
  insertCode, findCode, bindCode, currentContentKey,
  countAttempts, recordAttempt, expireCodesOfAccount,
} from './db.js';
import { notifyOwner } from './notify.js';

// 注册即送 7 天全量试用：不用等负责人发码就能立刻用全部内容，到期自动锁引导付费。
export const TRIAL_DAYS = 7;
export const TRIAL_MS = TRIAL_DAYS * 86400_000;

export const RATE_LIMIT = 10;
export const RATE_WINDOW_MS = 60000;
// /register 没有会话保护，Worker 地址又是公开的：CORS 挡不住 curl，
// 限流必须比登录严得多，否则谁都能自助批量开号、刷爆 D1 免费写配额。
export const REGISTER_RATE_LIMIT = 3;
export const REGISTER_RATE_WINDOW_MS = 3600000; // 1 小时
// /request-code 同理没有额外保护（只要求已登录），限得比登录更严，
// 防止有人反复点「重新申请」刷爆负责人的 Telegram。
export const REQUEST_CODE_RATE_LIMIT = 3;
export const REQUEST_CODE_RATE_WINDOW_MS = 3600000; // 1 小时
const MIN_PASSWORD = 8;

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function clientIp(request) {
  return request.headers.get('cf-connecting-ip') ?? 'unknown';
}

async function overLimit(env, request, endpoint, now, { limit = RATE_LIMIT, windowMs = RATE_WINDOW_MS } = {}) {
  const ip = clientIp(request);
  const n = await countAttempts(env.DB, { ip, endpoint, since: now - windowMs });
  if (n >= limit) return true;
  await recordAttempt(env.DB, { ip, endpoint, now });
  return false;
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function codeMessage(title, { email, code }) {
  return `${title}\n\n邮箱：${email}\n激活码：${code}\n此码长期有效，直到被使用。`;
}

// 试用到期时间的人类可读文案：固定用雅加达时区（UTC+7）显示，不依赖 Workers 运行时
// 自己的时区设置（那是 UTC）——负责人在印尼看 Telegram 消息，时间要是当地挂钟时间。
function jakartaTimeText(ts) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Jakarta', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(ts);
}

// 注册即送试用：负责人手机收到的推送里带上试用到期时间与「先攥着」的提示，
// 激活码这时候只是预先绑定好、还没交给用户——等对方付费了才手动告知。
function registerTrialMessage({ email, code, trialEndsAt }) {
  return `🔑 新用户试用中\n\n邮箱：${email}\n激活码：${code}（付费后发给他）\n试用到期：${jakartaTimeText(trialEndsAt)}`;
}

// 「重新申请激活码」沿用旧文案格式，只是多带一行试用到期时间；trialEndsAt 为 null
// 时（比如老式 issue-code.mjs 散码流程走出来的 pending 账号，从没进过试用）不显示这行。
function requestCodeMessage({ email, code, trialEndsAt }) {
  const trialLine = trialEndsAt ? `\n试用到期：${jakartaTimeText(trialEndsAt)}` : '';
  return `${codeMessage('🔄 重新申请激活码', { email, code })}${trialLine}`;
}

// notifyOwner 内部有 5 秒超时（见 notify.js），Telegram 慢的时候会原样拖慢调用方。
// ctx 是 Workers 的 ExecutionContext，有 waitUntil 时用它把推送丢到响应之外去发
// （fire-and-forget，不影响这次请求的响应时间，Worker 仍会等它跑完才真正结束）；
// 本地测试没有 ctx（第三方假 env 也不会传），退回原来的 await，行为不变。
function notifyInBackground(env, text, ctx) {
  const p = notifyOwner(env, text);
  if (ctx?.waitUntil) {
    ctx.waitUntil(p);
    return Promise.resolve();
  }
  return p;
}

export async function handleRegister(request, env, now = Date.now(), ctx) {
  if (await overLimit(env, request, '/register', now, {
    limit: REGISTER_RATE_LIMIT, windowMs: REGISTER_RATE_WINDOW_MS,
  })) {
    return json({ error: 'too_many_attempts' }, 429);
  }
  const { email, password } = await readJson(request);
  const mail = String(email ?? '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return json({ error: 'invalid_email' }, 400);
  if (String(password ?? '').length < MIN_PASSWORD) return json({ error: 'weak_password' }, 400);
  if (await findAccountByEmail(env.DB, mail)) return json({ error: 'email_taken' }, 409);

  const { hash, salt } = await hashPassword(password);
  // 注册即送 7 天全量试用：不用等负责人发码、不用输激活码，注册当场就能用全部内容。
  const trialEndsAt = now + TRIAL_MS;
  const accountId = await createAccount(env.DB, {
    email: mail, hash, salt, now, status: 'trial', trialEndsAt,
  });

  // 激活码照样当场生成并直接绑定到这个新账号——不再等激活时才绑，
  // 保证「一张码只能激活它所属的那个账号」。付费转正式时就是靠这张码。
  // 不设过期时间：激活必须先登录（有效令牌）+ 码本身从一开始就绑死这个账号，
  // 过期时间挡不住任何实际威胁（能被它挡住的场景早被这两道锁挡住了），
  // 却会把「负责人半夜没看到 Telegram、码睡一觉就废了」的代价转嫁给用户。
  // 僵尸码（绑了账号但一直没激活）由负责人用 tools/admin.mjs 定期清理，见 README。
  const code = generateCode();
  await insertCode(env.DB, {
    codeHash: await hashCode(code), accountId, now, expiresAt: null,
  });
  // 负责人先攥着这张码：试用期间不发给用户，等对方确认付费了再手动告知。
  await notifyInBackground(env, registerTrialMessage({ email: mail, code, trialEndsAt }), ctx);

  // 自动发码模式（自己人用）：明文码同时也直接返回给前端，方便本地测试/内部使用。
  // 关掉自动发码（卖码模式，线上默认）：不把明文码给注册者本人，只推给负责人。
  if (env.AUTO_ISSUE_CODE === 'true') {
    return json({
      ok: true, accountId, code, trialEndsAt,
    });
  }
  return json({
    ok: true, accountId, codeIssued: true, trialEndsAt,
  });
}

export async function handleLogin(request, env, now = Date.now()) {
  if (await overLimit(env, request, '/login', now)) {
    return json({ error: 'too_many_attempts' }, 429);
  }
  const { email, password } = await readJson(request);
  const mail = String(email ?? '').trim().toLowerCase();
  const account = await findAccountByEmail(env.DB, mail);
  if (!account) return json({ error: 'bad_credentials' }, 401);
  if (!(await verifyPassword(String(password ?? ''), account.password_hash, account.salt))) {
    return json({ error: 'bad_credentials' }, 401);
  }
  if (account.status === 'disabled') return json({ error: 'account_disabled' }, 403);
  // 试用已过期也照样登录成功：过期与否留给 /content-key 判定，这里如果直接拒绝，
  // 用户看到的会是「密码不对」而不是「试用已结束」，误导性更强。
  const token = await signToken(account.id, env.SESSION_SECRET, now);
  return json({ token, status: account.status, trialEndsAt: account.trial_ends_at ?? null });
}

export async function requireAccount(request, env, now) {
  const auth = request.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const accountId = await verifyToken(token, env.SESSION_SECRET, now);
  if (accountId === null) return null;
  return findAccountById(env.DB, accountId);
}

export async function handleActivate(request, env, now = Date.now()) {
  if (await overLimit(env, request, '/activate', now)) {
    return json({ error: 'too_many_attempts' }, 429);
  }
  const account = await requireAccount(request, env, now);
  if (!account) return json({ error: 'unauthorized' }, 401);
  if (account.status === 'disabled') return json({ error: 'account_disabled' }, 403);
  if (account.status === 'active') return json({ ok: true, status: 'active' });

  const { code } = await readJson(request);
  // 试用账号 / pending 账号都走下面这套码校验，成功后统一变 active。
  const codeHash = await hashCode(String(code ?? ''));
  const row = await findCode(env.DB, codeHash);
  if (!row) return json({ error: 'bad_code' }, 400);
  // 码绑定的账号不是当前账号：不管是已被别人用过，还是注册时就直接绑给了
  // 别的账号（卖码模式下的常态），都不允许这里激活。
  if (row.account_id !== null && row.account_id !== account.id) {
    return json({ error: 'code_used' }, 409);
  }
  // 这条校验本身没有删：新码（/register、/request-code 生成的）不再带过期时间
  // （expires_at 为 NULL，直接跳过下面的判断），但库里还留着一批取消过期之前
  // 发出的旧码（30 分钟版、3 小时版），它们的 expires_at 是具体时间戳，到期
  // 后仍应报 code_expired——不然等于悄悄放行了本该失效的旧码。
  // 另外，expireCodesOfAccount 把「重新申请」时作废的旧码 expires_at 置成 0，
  // 0 同样小于 now，会命中这里——这是「作废」赖以生效的机制，见 db.js 里的注释。
  if (row.expires_at !== null && row.expires_at !== undefined && row.expires_at < now) {
    return json({ error: 'code_expired' }, 410);
  }

  await bindCode(env.DB, { codeHash, accountId: account.id, now });
  await setAccountStatus(env.DB, account.id, 'active');
  // trial_ends_at 保留历史值不清空（方便日后统计试用转化），但状态已经是 active，
  // /content-key 不会再拿它做任何限制判断。
  return json({ ok: true, status: 'active', trialEndsAt: account.trial_ends_at ?? null });
}

export async function handleRequestCode(request, env, now = Date.now(), ctx) {
  if (await overLimit(env, request, '/request-code', now, {
    limit: REQUEST_CODE_RATE_LIMIT, windowMs: REQUEST_CODE_RATE_WINDOW_MS,
  })) {
    return json({ error: 'too_many_attempts' }, 429);
  }
  const account = await requireAccount(request, env, now);
  if (!account) return json({ error: 'unauthorized' }, 401);
  if (account.status === 'disabled') return json({ error: 'account_disabled' }, 403);
  if (account.status === 'active') return json({ ok: true, status: 'active' });

  // 负责人可能在睡觉：作废这个账号名下所有还没用过的旧码，生成新码重新推送。
  // 新码同样不设过期时间（理由见 handleRegister 里的注释）。
  await expireCodesOfAccount(env.DB, { accountId: account.id });
  const code = generateCode();
  await insertCode(env.DB, {
    codeHash: await hashCode(code), accountId: account.id, now, expiresAt: null,
  });
  await notifyInBackground(
    env, requestCodeMessage({ email: account.email, code, trialEndsAt: account.trial_ends_at ?? null }), ctx,
  );
  return json({ ok: true });
}

export async function handleContentKey(request, env, now = Date.now()) {
  const account = await requireAccount(request, env, now);
  if (!account) return json({ error: 'unauthorized' }, 401);
  if (account.status === 'disabled') return json({ error: 'account_disabled' }, 403);

  const inTrial = account.status === 'trial' && account.trial_ends_at && now < account.trial_ends_at;
  if (account.status === 'trial' && !inTrial) return json({ error: 'trial_expired' }, 403);
  if (account.status !== 'active' && account.status !== 'trial') return json({ error: 'not_activated' }, 403);

  const key = await currentContentKey(env.DB);
  if (!key) return json({ error: 'no_content_key' }, 503);
  // 试用账号的密钥有效期截断到试用到期时间——否则缓存一把 30 天的钥匙，
  // 断网也能把 7 天试用用满 30 天，试用限制形同虚设。
  const expiresAt = inTrial ? Math.min(now + 30 * 86400_000, account.trial_ends_at) : now + 30 * 86400_000;
  return json({
    cek: key.cek,
    contentVersion: key.version,
    expiresAt,
    trialEndsAt: inTrial ? account.trial_ends_at : null,
  });
}
