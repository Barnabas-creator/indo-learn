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

// 全站单元约 250 个。正常人一天翻不到 400 个，扒全集要连着两天且留痕。
// 这是计数不是配额：拦不住内容最终要送进浏览器，只把「一次性导出全集」
// 变成看得见、拖得慢的事。
//
// 12.5 拍板：匿名请求不计数、不限流。匿名从这条路由只够拿到 free 那 12 个
// 免费单元（tier='free'）的正文，扒不到任何值钱的东西，限它没有收益；
// 而按 IP 计数在印尼是有害的——本地大量手机用户走运营商 CGNAT，成百上千人
// 共用一个出口 IP，会共享同一份配额，新用户第一次打开就可能被前面的人
// 挤到 429。账号那档不受影响：只要认出账号，就按账号计数、按
// ACCOUNT_DAILY_LIMIT 限，跟匿名与否无关。
export const ACCOUNT_DAILY_LIMIT = 400;

export const dayKey = (now) => new Date(now).toISOString().slice(0, 10);

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
  //
  // 只有认出账号才计数、才限流——匿名请求完全不摸计数器：拿不到付费正文的
  // 请求没什么好拦的，而按 IP 计数在印尼会误伤 CGNAT 后面的一大片真实用户
  // （见上面 ACCOUNT_DAILY_LIMIT 那段注释）。
  const accountId = account?.id;
  if (accountId) {
    const subject = `acct:${accountId}`;
    // fail open：限流是抬高「一次性导出全集」的成本，不是安全边界——真正兜底
    // 权限的是上面那段判定。content_hits 写不进去（D1 抖动）不该把一次本该
    // 放行的正常请求变成用户可见的 500，所以计数失败当作「这次不计数」处理，
    // 直接放行，跟 index.js 里 recordError 失败「记不下去就算了」是同一条原则。
    let hits = 0;
    try {
      hits = await bumpContentHits(env.DB, { subject, day: dayKey(now) });
    } catch (err) {
      console.error('bumpContentHits failed, failing open', err);
    }
    if (hits > ACCOUNT_DAILY_LIMIT) {
      // 「有人在扒」是个信号，不是普通错误——记下来，好在 error_log 里查到。
      await recordError(env.DB, {
        ts: now, method: 'GET', path: pathname, name: 'rate_limited', message: subject,
      });
      return json({ error: 'rate_limited' }, 429);
    }
  }

  return json({ version: row.version, body: JSON.parse(row.body) });
}
