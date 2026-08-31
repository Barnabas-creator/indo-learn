// 按单元取内容的服务端提供者：账号 + 激活码模式，缓存优先。
// 与 remote-provider.js 同属会话管理那一套（init/register/login/activate/requestCode/lock），
// 区别在内容侧：不再整包下发密文再解密，而是按 module/id 单独问服务端要，服务端已经做完鉴权，
// 前端只管把结果缓存进 IndexedDB（lib/idb-cache.js），下次优先用缓存、离线也能用。
//
// 服务器不再下发内容密钥：内容本身按单元下发，鉴权在服务端做完了。
// 会话里只剩 token / status / email / expiresAt / trialEndsAt，没有 cek/contentVersion。
export const SERVER_STORAGE_KEY = 'indo-learn-session';

const OFFLINE = 'offline_uncached';
// 明确的拒绝：会话该清。网络故障和限流不算——前者是暂时的，后者是用户自己刷太快。
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

export function createServerProvider({ apiFetch, storage, cache, now = () => Date.now() }) {
  let session = null; // { token, status, email, expiresAt, trialEndsAt }
  // 最近一次清会话的具体原因（unauthorized/account_disabled/not_activated/trial_expired）。
  // 只在需要区分文案时（比如试用到期要跟普通登录过期分开提示）由调用方消费一次。
  let revokeReason = null;
  const consumeRevokeReason = () => { const r = revokeReason; revokeReason = null; return r; };

  function save() {
    storage.setItem(SERVER_STORAGE_KEY, JSON.stringify(session));
  }

  function clear() {
    session = null;
    storage.removeItem(SERVER_STORAGE_KEY);
  }

  function read() {
    const raw = storage.getItem(SERVER_STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  // 内容不再靠一把密钥解锁，会话是否有效只看本地存的 expiresAt，不用像
  // remote-provider 那样联网刷新密钥——所以这里是纯本地判断，不发请求。
  async function init() {
    session = read();
    if (!session || (session.expiresAt ?? 0) <= now()) {
      // 本地时钟一过期就地清会话，不用等联网时服务器再拒一次——但这道拦截
      // 靠的是本地存的 expiresAt 没被手改过，不是密码学意义上不可绕过（存在
      // localStorage 里，理论上能被用户改掉，见 README「安全边界」）。这里记下
      // 原因是 trial_expired，好让 UI 提示「试用已结束」而不是普通的「请重新登录」。
      if (session?.status === 'trial') revokeReason = 'trial_expired';
      clear();
      return { unlocked: false, status: 'none', email: null };
    }
    const unlocked = session.status === 'active' || session.status === 'trial';
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
      trialEndsAt: res.trialEndsAt ?? null,
      // 30 天是常规离线上限；trial 账号按 trialEndsAt 截断，免得留一把「30 天有效」的空会话。
      expiresAt: res.status === 'trial' && res.trialEndsAt
        ? Math.min(now() + 30 * 86400_000, res.trialEndsAt)
        : now() + 30 * 86400_000,
    };
    save();
    return { status: session.status, trialEndsAt: session.trialEndsAt ?? null };
  }

  async function activate(code) {
    const res = await apiFetch('/activate', { method: 'POST', token: session.token, body: { code } });
    session.status = res.status;
    session.trialEndsAt = res.trialEndsAt ?? null;
    save();
    return { status: session.status, trialEndsAt: session.trialEndsAt ?? null };
  }

  // 负责人可能在睡觉：待激活用户可以主动作废旧码、申请新码重新推送。
  async function requestCode() {
    return apiFetch('/request-code', { method: 'POST', token: session.token });
  }

  const key = (module, id) => `${module}/${id}`;

  async function getIndex() {
    try {
      const res = await apiFetch('/content/index', { token: session?.token });
      await cache.setMeta(res.version);   // 版本变了会顺手清空旧单元
      await cache.put('__index', res);
      return res;
    } catch (err) {
      if (REVOKE_ERRORS.has(err?.message)) { revokeReason = err.message; clear(); }
      const cached = await cache.get('__index');
      if (cached) return cached;
      throw err;
    }
  }

  async function getUnit(module, id) {
    const cached = await cache.get(key(module, id));
    if (cached !== undefined) return cached;
    try {
      const res = await apiFetch(`/content/${module}/${id}`, { token: session?.token });
      // 先落版本号再写内容：setMeta 在版本变化时会清库，顺序反了会把刚取到的
      // 这个单元一起清掉（见 tools/server-provider.test.mjs 里那条针对顺序的测试）。
      await cache.setMeta(res.version);
      await cache.put(key(module, id), res.body);
      return res.body;
    } catch (err) {
      if (REVOKE_ERRORS.has(err?.message)) { revokeReason = err.message; clear(); throw err; }
      if (err?.message === 'rate_limited' || err?.message === 'not_found') throw err;
      // 剩下的都当网络故障：缓存里没有就明确说「这部分还没下载过」，
      // 别让调用方收到一个看不懂的 fetch 错误。
      throw new Error(OFFLINE);
    }
  }

  return {
    init,
    register,
    login,
    activate,
    requestCode,
    lock: clear,
    lastRevokeReason: consumeRevokeReason,
    getIndex,
    getUnit,
  };
}
