// 左右翻页容器。课程的一课、语法的一篇，都拆成几张横向的卡片，一次只看一块。
//
// 为什么不继续用上下长滚：一课里有生词、对话、要点、小测四块，堆成一根长条要
// 滑很久才看得完，也分不清自己在第几块。拆成横向卡片后每屏只有一件事，
// 字号就能放大，块与块之间的边界也变成物理的——手指一划就是下一块。
//
// 翻页靠原生 scroll-snap，不自己实现拖拽：惯性、回弹、无障碍焦点都由浏览器管，
// 比手写 touchmove 稳。下面那排圆点既是进度也是目录，可以直接跳。

export const PAGER_CLASS = 'pager';

// 当前停在第几页：容器滚动位置除以一页的宽度，四舍五入。
// 用宽度而不是逐个量 offsetLeft，是因为每页都是 100% 宽，除法足够准也更快。
export function pageIndexFrom(scrollLeft, pageWidth, count) {
  if (!(pageWidth > 0) || !(count > 0)) return 0;
  const i = Math.round(scrollLeft / pageWidth);
  return Math.min(count - 1, Math.max(0, i));
}

// 页数少（课程一课四块）用图标圆点，一眼看全；页数多（语法一篇几十课）
// 排一地圆点反而找不着北，改成「‹ 3/37 ›」的紧凑条。
export const DOTS_MAX = 8;

export function renderPager(root, pages) {
  const list = pages ?? [];
  const compact = list.length > DOTS_MAX;

  root.innerHTML = `
    <div class="${PAGER_CLASS}${compact ? ' compact' : ''}">
      <div class="pager-track">
        ${list.map((p, i) => `
          <section class="pager-page" data-i="${i}" aria-label="${p.label}">
            <div class="pager-page-inner">
              <h3 class="pager-title"><span class="pager-icon">${p.icon}</span>${p.label}</h3>
              ${p.body}
            </div>
          </section>`).join('')}
      </div>
      <nav class="pager-nav" aria-label="小节">
        ${compact ? `
          <button class="pager-step" data-step="-1" aria-label="上一节">‹</button>
          <span class="pager-count"><b class="pager-now">1</b> / ${list.length}</span>
          <button class="pager-step" data-step="1" aria-label="下一节">›</button>
        ` : list.map((p, i) => `
          <button class="pager-dot${i === 0 ? ' on' : ''}" data-i="${i}" title="${p.label}" aria-label="${p.label}">
            <span class="dot-icon">${p.icon}</span>
          </button>`).join('')}
      </nav>
    </div>`;

  const track = root.querySelector('.pager-track');
  const dots = [...root.querySelectorAll('.pager-dot')];
  const now = root.querySelector('.pager-now');
  let at = 0;

  const mark = (i) => {
    at = i;
    dots.forEach((d, k) => d.classList.toggle('on', k === i));
    if (now) now.textContent = String(i + 1);
  };

  // 翻页同时把页面滚回顶部：上一页拖到一半的位置，会让新页看起来是从中间开始的。
  const goTo = (i) => {
    const k = Math.min(list.length - 1, Math.max(0, i));
    track.scrollTo({ left: k * track.clientWidth, behavior: 'smooth' });
    mark(k); // 先亮起来，不等滚动结束——点了没反应会以为没点上
    root.ownerDocument?.defaultView?.scrollTo?.({ top: 0, behavior: 'smooth' });
  };

  dots.forEach((d) => d.addEventListener('click', () => goTo(Number(d.dataset.i))));
  root.querySelectorAll('.pager-step').forEach((b) =>
    b.addEventListener('click', () => goTo(at + Number(b.dataset.step))));

  track.addEventListener('scroll', () => {
    mark(pageIndexFrom(track.scrollLeft, track.clientWidth, list.length));
  }, { passive: true });

  return { track, dots, goTo };
}
