// 下拉刷新：页面（和手指下面的滚动区）都在顶部时往下拉，松手超过阈值就整页重新加载。
// iOS「添加到主屏幕」的独立 App 模式没有原生下拉刷新；安卓 Chrome 自带的那个用
// overscroll-behavior 关掉，两边行为一致。横向滑动、在输入框里起手都不触发。
// 提示条由脚本自己挂到 <body>，不进 #app——#app 每次切视图都会被整块重绘。
(() => {
  const el = document.createElement("div");
  el.className = "ptr";
  el.setAttribute("aria-live", "polite");
  el.textContent = "下拉刷新";
  document.body.appendChild(el);
  const TRIGGER = 70;
  let startY = null, startX = 0, pull = 0, busy = false;
  const scrolledInside = (node) => {
    for (; node && node !== document.body; node = node.parentElement) if (node.scrollTop > 0) return true;
    return false;
  };
  const show = (y, text) => {
    el.style.transform = `translate(-50%, ${Math.min(y, TRIGGER + 20) - 60}px)`;
    el.style.opacity = y > 10 ? "1" : "0";
    el.textContent = text;
  };
  const reset = () => { el.classList.remove("dragging"); el.style.transform = ""; el.style.opacity = ""; };

  document.addEventListener("touchstart", (e) => {
    startY = null;
    if (busy || e.touches.length !== 1 || window.scrollY > 0) return;
    if (e.target.closest("input, select, textarea") || scrolledInside(e.target)) return;
    startY = e.touches[0].clientY; startX = e.touches[0].clientX; pull = 0;
  }, { passive: true });

  document.addEventListener("touchmove", (e) => {
    if (startY === null) return;
    const dy = e.touches[0].clientY - startY, dx = Math.abs(e.touches[0].clientX - startX);
    if (dy <= 0 || dx > dy || window.scrollY > 0) { pull = 0; reset(); return; }
    pull = dy * 0.5;   // 阻尼：手指拉 140px，提示走 70px
    el.classList.add("dragging");
    show(pull, pull >= TRIGGER ? "松手刷新" : "下拉刷新");
  }, { passive: true });

  document.addEventListener("touchend", () => {
    if (startY === null) return;
    startY = null;
    el.classList.remove("dragging");
    if (pull < TRIGGER) { reset(); return; }
    busy = true;
    show(TRIGGER, "刷新中…");
    setTimeout(() => location.reload(), 150);
  });
})();
