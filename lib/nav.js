// 导航辅助：层级关系 + 返回手势判定。纯逻辑，不碰 DOM，方便单测。
//
// 安卓上「左滑返回」有两条完全不同的实现路径，app.js 两条都走：
//
// 1. 手势导航的机型上，左边缘右滑就是系统返回手势，网页拦不住它——它只会触发
//    popstate，或者在 PWA 里直接把应用关掉。所以真正管用的做法是给每一层压一条
//    history 记录，popstate 时退回上一层，系统返回手势与返回键就都变成应用内返回。
// 2. 三键导航、或普通浏览器标签页里，系统不吃这个手势，就靠 isBackSwipe() 自己认。

// 每一层的上一层。home 没有上一层（返回到此为止，不再退出应用）。
const PARENT = {
  home: null,
  levels: 'home',
  grid: 'levels',
  cards: 'grid',
  congrats: 'grid',
  dialogList: 'home',
  dialogDetail: 'dialogList',
  grammarList: 'home',
  grammarModule: 'grammarList',
};

export function parentView(view) {
  return PARENT[view] ?? null;
}

// 手势阈值：起点必须落在左边缘 EDGE_PX 内（不然会跟词卡翻面、横向滚动抢），
// 横向至少划 MIN_DX，纵向不超过 MAX_DY（不然是在上下滚页面）。
export const EDGE_PX = 32;
export const MIN_DX = 60;
export const MAX_DY = 45;

export function isBackSwipe({ startX, startY, endX, endY }) {
  if (startX > EDGE_PX) return false;
  const dx = endX - startX;
  const dy = Math.abs(endY - startY);
  return dx >= MIN_DX && dy <= MAX_DY;
}
