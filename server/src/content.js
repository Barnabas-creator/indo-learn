// 内容下发：清单与单元。授权判定复用 routes.js 里那套（requireAccount + 试用期），
// 不另起一套——两套判定迟早会跑偏。
import {
  listContentUnits, currentContentVersion, getContentUnit, bumpContentHits, recordError,
} from './db.js';
import { requireAccount, json } from './routes.js';

// 六个模块名写死在这——路径里的 module 段是用户可控输入，不核对白名单就
// 直接拼进 SQL 参数，虽然是走 bind() 不会注入，但非法模块名也不该白白
// 查一次库，404 更快也更干净。
const MODULES = new Set(['packs', 'roots', 'dialogs', 'grammar', 'course', 'listening']);

// 全站单元约 250 个。正常人一天翻不到 400 个，扒全集要连着两天且留痕；
// 匿名只能看 free 那几个，60 次足够试吃。
// 这是计数不是配额：拦不住内容最终要送进浏览器，只把「一次性导出全集」
// 变成看得见、拖得慢的事。
export const ACCOUNT_DAILY_LIMIT = 400;
export const ANON_DAILY_LIMIT = 60;

export const dayKey = (now) => new Date(now).toISOString().slice(0, 10);

// 能看全部内容的账号：active，或还在试用期内的 trial。
// 与 handleContentKey 的判定同源，只是这里不需要区分「过期」和「没激活」——
// 清单页对谁都有内容可给（至少有 free 那几个），退回 free 比报错友好。
export async function canSeePaid(request, env, now) {
  const account = await requireAccount(request, env, now);
  if (!account || account.status === 'disabled') return false;
  if (account.status === 'active') return true;
  return account.status === 'trial' && account.trial_ends_at > now;
}

export async function handleContentIndex(request, env, now = Date.now()) {
  const includePaid = await canSeePaid(request, env, now);
  const [rows, version] = await Promise.all([
    listContentUnits(env.DB, { includePaid }),
    currentContentVersion(env.DB),
  ]);

  const modules = {};
  for (const r of rows) {
    (modules[r.module] ??= []).push({ id: r.unit_id, tier: r.tier, title: r.title ?? null });
  }

  const res = json({ version, modules });
  // 清单是所有页面的入口，五分钟私有缓存能把 Workers 的请求数压下来一大截；
  // private 是必须的——不同账号看到的清单不一样，不能进共享缓存。
  res.headers.set('cache-control', 'private, max-age=300');
  // 响应内容完全由 authorization 头决定（同一 URL，不同 token 返回不同清单）。
  // 浏览器私有缓存默认只按 URL 做 key，不加这个 vary，同一浏览器 300 秒内换账号
  // 会直接吃到上一个账号缓存的清单，看到对方的付费单元 id。
  // index.js 的 CORS 层还会再加一条 vary: origin，两条要在最终响应里都留着
  // （见 index.js 里合并响应头那段），这里只管自己该声明的那一条。
  res.headers.set('vary', 'authorization');
  return res;
}

// 单元正文按 tier 判定权限：free 直接给，paid 复用 requireAccount + 试用期那套
// 判定（与 handleContentKey 同源），错误码也照抄——前端已经在按这几个 error
// 值分支提示用户，这里另起一套字符串只会让同一种状况在两个接口报不同的话。
export async function handleContentUnit(request, env, now = Date.now()) {
  const { pathname } = new URL(request.url);
  // 过滤空段而不是按固定位置解构：直接解构 split('/') 会对多余的尾部分段
  // 来者不拒（/content/packs/p-1/extra 里第 4 段被静默丢弃，照样当合法请求
  // 处理），也没法把 /content/packs/、/content//p-1 这类空段路径统一处理掉。
  // 段数必须恰好是 3（'content' + module + unitId），多一段少一段都是 404。
  const segments = pathname.split('/').filter(Boolean);
  const [, module, unitId] = segments;
  if (segments.length !== 3 || !MODULES.has(module) || !unitId) return json({ error: 'not_found' }, 404);

  const row = await getContentUnit(env.DB, module, unitId);
  if (!row) return json({ error: 'not_found' }, 404);

  // 提到判定之前调用一次：free 分支原本不查账号，但带了有效 token 的匿名
  // 请求应该按账号计数而不是按 IP，两条分支（free/paid）共用这一次查询结果，
  // 不改变下面六条访问规则本身的判定顺序和结果。
  const account = await requireAccount(request, env, now);

  if (row.tier !== 'free') {
    if (!account) return json({ error: 'unauthorized' }, 401);
    if (account.status === 'disabled') return json({ error: 'account_disabled' }, 403);
    const inTrial = account.status === 'trial' && account.trial_ends_at > now;
    if (account.status === 'trial' && !inTrial) return json({ error: 'trial_expired' }, 403);
    if (account.status !== 'active' && !inTrial) return json({ error: 'not_activated' }, 403);
  }

  // 计数放在「取到单元、判完权限」之后：不存在的单元、没权限的请求都不消耗
  // 额度，只数真的换到内容正文这一刻。
  const accountId = account?.id;
  const subject = accountId ? `acct:${accountId}` : `ip:${request.headers.get('cf-connecting-ip') ?? '?'}`;
  const limit = accountId ? ACCOUNT_DAILY_LIMIT : ANON_DAILY_LIMIT;
  const hits = await bumpContentHits(env.DB, { subject, day: dayKey(now) });
  if (hits > limit) {
    // 「有人在扒」是个信号，不是普通错误——记下来，好在 error_log 里查到。
    await recordError(env.DB, {
      ts: now, method: 'GET', path: pathname, name: 'rate_limited', message: subject,
    });
    return json({ error: 'rate_limited' }, 429);
  }

  return json({ version: row.version, body: JSON.parse(row.body) });
}
