// 远程内容提供者：账号 + 激活码模式。
// 与 provider.js 同签名（init / lock / getPacks / getDialogs / getGrammar），
// 另有 register / login / activate 供新视图调用。
//
// 内容仍是 Pages 上的静态加密文件；服务器只下发内容密钥（CEK）。
// 会话与密钥存 localStorage，30 天内离线可用。
import { decryptJson, importCek } from './crypto.js';

export const REMOTE_STORAGE_KEY = 'indo-learn-session';

// 服务器明确拒绝的错误码：账号被吊销 / 令牌失效 / 未激活 / 试用已结束，必须清会话强制重新登录。
// 其余错误（服务器自身故障 no_content_key/server_error、网络不通）不清会话——
// 离线可用是核心设计，不能被服务器一时故障或断网打断。
const REVOKE_ERRORS = new Set(['unauthorized', 'account_disabled', 'not_activated', 'trial_expired']);

// 试用剩余天数：向上取整（哪怕还剩几小时也算 1 天），已过期返回 0。UI 用它渲染横幅文案。
export function trialDaysLeft(trialEndsAt, now = Date.now()) {
  if (!trialEndsAt) return 0;
  const diff = trialEndsAt - now;
  if (diff <= 0) return 0;
  return Math.ceil(diff / 86400_000);
}

// 跟服务端（server/src/routes.js）同一套邮箱归一化规则：大小写、首尾空格
// 服务端不敏感，前端存下来的 email 也要按这套规则处理，否则「注册用大写、
// 登录用小写」这种正常操作会被前端误判成换了账号。
export function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

export function createRemoteProvider({ fetchJson, apiFetch, storage, now = () => Date.now() }) {
  let session = null; // { token, status, cek, contentVersion, expiresAt, trialEndsAt }
  let cekKey = null; // 导入后的 CryptoKey
  const cache = new Map();
  // 最近一次清会话的具体原因（unauthorized/account_disabled/not_activated/trial_expired）。
  // 只在需要区分文案时（比如试用到期要跟普通登录过期分开提示）由调用方消费一次。
  let revokeReason = null;
  const consumeRevokeReason = () => { const r = revokeReason; revokeReason = null; return r; };

  function save() {
    storage.setItem(REMOTE_STORAGE_KEY, JSON.stringify(session));
  }

  function clear() {
    session = null;
    cekKey = null;
    cache.clear();
    storage.removeItem(REMOTE_STORAGE_KEY);
  }

  function read() {
    const raw = storage.getItem(REMOTE_STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  // 拉最新密钥；服务器明确拒绝（吊销/未激活/令牌失效/试用已结束）才清会话，
  // 网络不通或服务器自身故障（no_content_key/server_error）沿用本地缓存密钥继续可用。
  // 注意：不在这里把 status 强行改成 'active'——trial 账号也能成功走到这一步，
  // status 由 login()/activate() 的响应决定，这里只更新密钥本身与试用到期时间。
  async function refreshKey() {
    try {
      const res = await apiFetch('/content-key', { token: session.token });
      session.cek = res.cek;
      session.contentVersion = res.contentVersion;
      session.expiresAt = res.expiresAt;
      session.trialEndsAt = res.trialEndsAt ?? null;
      cekKey = null;
      cache.clear(); // 密钥/版本变了，内存里的旧明文不能继续用
      save();
    } catch (err) {
      if (REVOKE_ERRORS.has(err?.message)) {
        revokeReason = err.message;
        clear();
      }
      // 否则视为网络故障或服务器自身问题：保留本地缓存密钥，继续离线可用
    }
  }

  async function init() {
    session = read();
    if (!session || (session.expiresAt ?? 0) <= now()) {
      // 试用账号的 expiresAt 从一开始就截断到 trial_ends_at（见 refreshKey），
      // 本地时钟一过这个点就地清会话，不用等联网时服务器再拒一次——但这道拦截
      // 靠的是本地存的 expiresAt 没被手改过，不是密码学意义上不可绕过（存在
      // localStorage 里，理论上能被用户改掉，见 README「安全边界」）。这里记下
      // 原因是 trial_expired，好让 UI 提示「试用已结束」而不是普通的「请重新登录」。
      if (session?.status === 'trial') revokeReason = 'trial_expired';
      clear();
      return { unlocked: false, status: 'none', email: null };
    }
    if (session.status === 'active' || session.status === 'trial') await refreshKey();
    if (!session) return { unlocked: false, status: 'none', email: null }; // 刷新时被吊销
    const unlocked = (session.status === 'active' || session.status === 'trial') && Boolean(session.cek);
    return {
      unlocked, status: session.status, email: session.email ?? null, trialEndsAt: session.trialEndsAt ?? null,
    };
  }

  async function register(email, password) {
    return apiFetch('/register', { method: 'POST', body: { email, password } });
  }

  async function login(email, password) {
    const res = await apiFetch('/login', { method: 'POST', body: { email, password } });
    session = {
      token: res.token,
      status: res.status,
      email: normalizeEmail(email), // 记住登录用的邮箱（归一化）：暂存激活码要靠它校验是不是同一个账号
      cek: null,
      contentVersion: null,
      trialEndsAt: res.trialEndsAt ?? null,
      // 30 天是常规离线上限；trial 账号在拿到真正的密钥前先按 trialEndsAt 兜底，
      // 免得中间万一联不上 /content-key，还留着一把「30 天有效」的空会话。
      // 拿到密钥后 refreshKey 会用服务器算好的截断值覆盖掉这个临时值。
      expiresAt: res.status === 'trial' && res.trialEndsAt
        ? Math.min(now() + 30 * 86400_000, res.trialEndsAt)
        : now() + 30 * 86400_000,
    };
    save();
    if (res.status === 'active' || res.status === 'trial') await refreshKey();
    return { status: session ? session.status : 'none', trialEndsAt: session ? (session.trialEndsAt ?? null) : null };
  }

  async function activate(code) {
    const res = await apiFetch('/activate', { method: 'POST', token: session.token, body: { code } });
    session.status = res.status;
    session.trialEndsAt = res.trialEndsAt ?? null;
    save();
    await refreshKey();
    return { status: session ? session.status : 'none', trialEndsAt: session ? (session.trialEndsAt ?? null) : null };
  }

  // 负责人可能在睡觉：待激活用户可以主动作废旧码、申请新码重新推送。
  async function requestCode() {
    return apiFetch('/request-code', { method: 'POST', token: session.token });
  }

  async function load(name) {
    if (!session?.cek) throw new Error('未解锁');
    if (cache.has(name)) return cache.get(name);

    const manifest = await fetchJson('data/manifest.json');
    if (manifest.contentVersion !== session.contentVersion) {
      // 内容已升级但本地密钥还是旧版本：先刷新，避免用旧 CEK 解新密文
      await refreshKey();
      if (!session) throw new Error('未解锁'); // 刷新时被吊销
      if (manifest.contentVersion !== session.contentVersion) {
        // 刷新后版本仍对不上（比如离线拿不到新密钥）：明确报「内容已过期」，
        // 而不是让调用方收到一个难懂的解密失败
        throw new Error('content_outdated');
      }
    }
    if (!cekKey) cekKey = await importCek(session.cek);
    const payload = await fetchJson(`data/${manifest.contentVersion}/${name}.enc`);
    let value;
    try {
      value = await decryptJson(payload.data, payload.iv, cekKey);
    } catch {
      // 密钥/密文真对不上（不是网络问题）：调用方（app.js）据此判断要不要清会话。
      throw new Error('content_decrypt_failed');
    }
    cache.set(name, value);
    return value;
  }

  return {
    init,
    register,
    login,
    activate,
    requestCode,
    lock: clear,
    lastRevokeReason: consumeRevokeReason,
    getPacks: () => load('packs'),
    getDialogs: () => load('dialogs'),
    getGrammar: () => load('grammar'),
  };
}
