// 「这个包开放了没有」以前看 wordsByPack 里有没有词条——那要求先把全部词条拉到手。
// 现在看清单：清单里有这个 id 就是开放，没有就是准备中。UI 表现不变。
export function packsWithStatus(skeletonPacks, index) {
  const known = new Map((index.packs ?? []).map((u) => [u.id, u]));
  return skeletonPacks.map((p, i) => ({
    ...p,
    no: String(i + 1).padStart(2, '0'),
    open: known.has(p.id),
    tier: known.get(p.id)?.tier ?? null,
  }));
}

export function levelCountsFrom(packsByLevel, index) {
  const out = {};
  for (const [level, packs] of Object.entries(packsByLevel)) {
    const withStatus = packsWithStatus(packs, index);
    out[level] = { open: withStatus.filter((p) => p.open).length, total: withStatus.length };
  }
  return out;
}

// 11.5 拍板：付费单元的存在要让未登录者也看得见（清单一律发全量元数据），
// 「能不能点开」因此不再由清单本身决定，要靠前端自己判：tier === 'paid' 且
// 当前账号看不了付费内容。
//
// 判定口径跟服务端 server/src/content.js 的 handleContentUnit 里那段账号
// 判定（tier !== 'free' 的分支）逐条对齐——两处不一致会让 UI 上的锁和实际
// 能不能取到内容对不上（锁没显示、点进去却被 401；或者显示了锁、其实账号
// 明明能看）。试用期边界用同一个比较方向：trialEndsAt > now（服务端是
// account.trial_ends_at > now），「严格大于」，恰好等于 now 算已过期，
// 不是「不晚于」。
//
// account 可能是 undefined（还没登录/拿不到会话）——解构一个 undefined 会
// 直接抛错，所以给默认值 {}，退化成 status/trialEndsAt 都是 undefined，
// 走到下面同样判定为「看不了」，不需要调用方每次都先判一次账号存不存在。
export function canSeePaidLocally({ status, trialEndsAt } = {}, now = Date.now()) {
  if (!status || status === 'disabled') return false;
  if (status === 'active') return true;
  return status === 'trial' && trialEndsAt > now;
}

// tier === 'paid' 且账号看不了付费内容才要挂锁；free 单元、或清单里没有这个
// id（tier 是 null，「准备中」状态）都不算——「没有」不等于「锁着」，这两种
// 状态在 UI 上必须能区分开，不能混成同一种灰。
export function needsUnlock(unit, account, now = Date.now()) {
  return unit?.tier === 'paid' && !canSeePaidLocally(account, now);
}

// 分类卡（对话/听力那两张，见 lib/views/listening.js 的 renderAudioCats）没有
// 单一 tier——听力只有一个单元，套 needsUnlock 天然成立；对话是一堆各自定价
// 的单元，「整类锁住」只在这一类里每一条都要登录时才成立：只要有一条免费或
// 账号已经能看，分类卡本身仍然可点，锁留给列表页逐条去挂（dialogs.js 已经
// 在列表层做了这件事），这里不重复判一次「部分锁」——不然一张本来点得进去
// 的分类卡会被误判成整个锁住，更让人困惑。
export function categoryLocked(units, account, now = Date.now()) {
  const list = units ?? [];
  return list.length > 0 && list.every((u) => needsUnlock(u, account, now));
}

// guard() 遇到这四个码时要把人送去登录页，不是画错误页——都是「当前会话看不了
// 这份内容」的意思（会话过期/账号被停/还没激活/试用到期），用户点的是付费内容，
// 直接给登录入口比甩一个内部错误码有用。跟 server-provider.js/remote-provider.js
// 里各自的 REVOKE_ERRORS 是同一张表，这里单独放一份是因为 app.js 没有测试
// （不引 jsdom），这条判断要能被单测覆盖到，只能抽成纯函数。
const SESSION_ERRORS = new Set(['unauthorized', 'account_disabled', 'not_activated', 'trial_expired']);
export const isSessionError = (message) => SESSION_ERRORS.has(message);

// 换账号（登出，或会话被服务端踢出后换个账号重新登录）都要让「清单」和「已取到的
// 词包正文」两层缓存一起失效。只刷新清单会漏掉 packWords——那是 app.js start()
// 闭包里的内存 Map，是跨账号在同一个标签页里活得比清单还久的单例：Task 8 修的是
// lock() 清 IndexedDB 缓存那个洞，这里是同一个洞在内存层的另一份拷贝，同样能让
// 下一个账号绕过服务端鉴权、直接读到上一个账号缓存过的付费正文。
//
// 先清 packWords 再发 getIndex 请求：哪怕请求失败，也不会残留旧账号的词包缓存——
// 宁可清完了暂时拿不到新清单，也不要清单没刷新、旧内容还能读到。
export async function refreshContentIndex({ getIndex, packWords }) {
  packWords.clear();
  return getIndex();
}

// 登出（或账号被踢出）后要归零的导航状态。不重置的话下一个账号登录时 render()
// 会直接照着上一个账号停留的 view/level/packId 画——这条路径是真实可达的（试用
// 横幅「输入激活码」→ 激活页「退出登录」），不是纸面风险。
export function resetNavState() {
  return { view: 'home', level: null, packId: null };
}
