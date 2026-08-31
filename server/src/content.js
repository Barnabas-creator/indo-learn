// 内容下发：清单与单元。授权判定复用 routes.js 里那套（requireAccount + 试用期），
// 不另起一套——两套判定迟早会跑偏。
import { listContentUnits, currentContentVersion, getContentUnit } from './db.js';
import { requireAccount, json } from './routes.js';

// 六个模块名写死在这——路径里的 module 段是用户可控输入，不核对白名单就
// 直接拼进 SQL 参数，虽然是走 bind() 不会注入，但非法模块名也不该白白
// 查一次库，404 更快也更干净。
const MODULES = new Set(['packs', 'roots', 'dialogs', 'grammar', 'course', 'listening']);

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
  const [, , module, unitId] = pathname.split('/');
  if (!MODULES.has(module) || !unitId) return json({ error: 'not_found' }, 404);

  const row = await getContentUnit(env.DB, module, unitId);
  if (!row) return json({ error: 'not_found' }, 404);

  if (row.tier !== 'free') {
    const account = await requireAccount(request, env, now);
    if (!account) return json({ error: 'unauthorized' }, 401);
    if (account.status === 'disabled') return json({ error: 'account_disabled' }, 403);
    const inTrial = account.status === 'trial' && account.trial_ends_at > now;
    if (account.status === 'trial' && !inTrial) return json({ error: 'trial_expired' }, 403);
    if (account.status !== 'active' && !inTrial) return json({ error: 'not_activated' }, 403);
  }

  return json({ version: row.version, body: JSON.parse(row.body) });
}
