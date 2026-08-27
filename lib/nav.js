// 导航辅助：层级关系。纯逻辑，不碰 DOM，方便单测。
//
// 返回全部走 history/popstate：每进一层压一条 history 记录，popstate 时退回上一层。
// 这样系统返回手势（安卓左边缘右滑、iOS 边缘滑动）、安卓返回键、顶栏的「← 返回」
// 和桌面键走的是同一条路，一个动作只退一级。
//
// 页面曾经自己认过一次左边缘右滑，作为「系统不吃这个手势」的兜底——结果是两条路
// 同时生效，一个手势退两级（iPhone 上表现成「先退一层，过一会又跳回首页」）。
// 那种兜底场合并不存在（三键导航有返回键、浏览器有返回按钮、顶栏一直有返回），
// 所以已经删掉。

// 每一层的上一层。home 没有上一层（返回到此为止，不再退出应用）。
const PARENT = {
  home: null,
  levels: 'home',
  grid: 'levels',
  cards: 'grid',
  congrats: 'grid',
  dialogList: 'home',
  dialogDetail: 'dialogList',
  courseUnits: 'home',
  courseLessons: 'courseUnits',
  courseLesson: 'courseLessons',
  grammarList: 'home',
  grammarModule: 'grammarList',
  grammarLesson: 'grammarModule',
};

export function parentView(view) {
  return PARENT[view] ?? null;
}
