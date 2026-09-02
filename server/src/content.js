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

// 11.5 拍板：付费单元的存在要让未登录者也看得见（元数据而已，正文仍然按账号
// 鉴权），所以清单路由不再调用这个函数——但别删：它判的是「这个账号能不能看
// 付费内容」这件事本身没变，用来判「清单要不要过滤」和用来判「单元正文能不能
// 发」是两个不同的问题，handleContentUnit 那边的六条访问规则需要按错误类型
// 分支（401/403 三种），不能简单复用这个只返回布尔值的函数，是就地展开的等价
// 判定（见下面 handleContentUnit 里的注释）。这个函数目前确实没有调用方了，
// 留着是因为「清单按账号定制」这类需求随时可能再回来，删了要重写一遍同样的
// 判定逻辑，风险比留一个没人调的纯函数大。
export async function canSeePaid(request, env, now) {
  const account = await requireAccount(request, env, now);
  if (!account || account.status === 'disabled') return false;
  if (account.status === 'active') return true;
  return account.status === 'trial' && account.trial_ends_at > now;
}

export async function handleContentIndex(request, env, now = Date.now()) {
  // 11.5：清单不再按账号过滤——付费单元的存在要让未登录者也看得见（只发
  // id/tier/title/meta，正文仍然只由 handleContentUnit 按账号鉴权发放）。
  const [rows, version] = await Promise.all([
    listContentUnits(env.DB),
    currentContentVersion(env.DB),
  ]);

  const modules = {};
  for (const r of rows) {
    // meta 存的是 JSON 字符串，这里解析成对象再发给前端。坏 JSON（手改库、
    // 某次推送出岔子）不该让整个清单请求跟着 500——只这一条单元的 meta 退化成
    // null，其余单元照常返回。
    let meta = null;
    if (r.meta) {
      try {
        meta = JSON.parse(r.meta);
      } catch {
        meta = null;
      }
    }
    (modules[r.module] ??= []).push({
      id: r.unit_id, tier: r.tier, title: r.title ?? null, meta,
    });
  }

  const res = json({ version, modules });
  // 11.5 之后清单对谁都一样（不再按账号过滤），这两条头按理已经不必要了——
  // 但留着成本为零（同一份响应，多两行头），去掉的风险不为零（账号状态将来
  // 若再影响清单内容——比如某天又要按账号定制——这两条就得原样加回来，
  // 到时候未必有人记得当初为什么删）。所以照旧留着，只是下面这两句注释的
  // 「为什么」要更新一下：不是「不同账号看到的清单不一样」，是「以防万一
  // 它以后又不一样」。
  //
  // 清单是所有页面的入口，五分钟私有缓存能把 Workers 的请求数压下来一大截；
  // private 是必须的——一旦清单又变回按账号定制，就不能进共享缓存。
  res.headers.set('cache-control', 'private, max-age=300');
  // 浏览器私有缓存默认只按 URL 做 key。现在清单内容不看 authorization，这条
  // vary 暂时是摆设，但留着不影响正确性，删了则要在清单重新按账号定制的那天
  // 记得加回来——容易忘。
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
  // fail open：限流是抬高「一次性导出全集」的成本，不是安全边界——真正兜底权限
  // 的是上面那段判定。content_hits 写不进去（D1 抖动）不该把一次本该放行的
  // 正常请求变成用户可见的 500，所以计数失败当作「这次不计数」处理，直接放行，
  // 跟 index.js 里 recordError 失败「记不下去就算了」是同一条原则。
  let hits = 0;
  try {
    hits = await bumpContentHits(env.DB, { subject, day: dayKey(now) });
  } catch (err) {
    console.error('bumpContentHits failed, failing open', err);
  }
  if (hits > limit) {
    // 「有人在扒」是个信号，不是普通错误——记下来，好在 error_log 里查到。
    await recordError(env.DB, {
      ts: now, method: 'GET', path: pathname, name: 'rate_limited', message: subject,
    });
    return json({ error: 'rate_limited' }, 429);
  }

  return json({ version: row.version, body: JSON.parse(row.body) });
}
