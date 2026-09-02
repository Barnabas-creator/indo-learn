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

// 未登录时清单里只有 free 单元，paid 的根本不出现——所以这里只在
// 「登录后拿到全量清单」的场景下用得着：告诉 UI 哪些要挂锁。
export const needsUnlock = (unit) => unit?.tier === 'paid';

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
