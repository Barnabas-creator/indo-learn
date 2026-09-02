// 词根背诵法：包列表 → 词根卡。
//
// 跟单词包长得像，但背的东西不一样：单词包背「这个词是什么意思」，
// 这里背「这个词根能长出哪些词」。印尼语的词绝大多数是词根加前后缀拼出来的，
// 认得 200 个常见原型词，一大片派生词就能猜个八九不离十。
// 所以卡背面最重的一块是 derived —— 那一行才是这个模块存在的理由。
import { iconFor } from '../icons.js';
import { needsUnlock } from '../catalog-view.js';

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// derived 写成「melihat 看见 · dilihat 被看 · …」，中点分隔。
// 拆开逐条排，一眼看得出这个词根一共长出几个词。
export function derivedItems(derived) {
  return String(derived ?? '')
    .split(/[·•]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

// —— 第二层：词根包列表 ——
// packs 现在是清单条目摊平后的样子（{ id, title, subtitle, count }，见 app.js
// rootList 分支：subtitle/count 是从清单条目的 meta.subtitle / meta.count 摊平来的，
// title 是清单条目自己的 title）。点进 rootCards 才会按 id 取到真正文（含 words）。
// 编号靠列表位置算（同 packsWithStatus 的 no）。
// meta 可能是 null（坏数据兜底、新模块没给 meta）——subtitle/count 摊平时已经在
// app.js 那边兜成 null 了，这里只管「null 就不画那一块」，不猜、不崩、不显示 undefined。
// 11.5：包本身没有「准备中」状态（每一条都是从清单摊平来的，能出现在这个
// 列表里就是清单里有），但 tier 是 paid 时账号未必看得了正文——挂锁复用
// packs.js 那套 .pack-card/.pack-no/.pack-lock 样式，点击本身仍然照常触发
// open(id)，是否跳登录由 app.js 的 open 回调判 needsUnlock 决定，这里只管
// 视觉提示，不拦点击。
export function renderRootList(root, packs, { open, back, account }) {
  const totalWords = packs.some((p) => p.count != null)
    ? packs.reduce((n, p) => n + (p.count ?? 0), 0)
    : null;
  const grid = packs
    .map((p, i) => {
      const locked = needsUnlock(p, account);
      return `
      <button class="pack-card" data-id="${esc(p.id)}">
        <span class="pack-no">${esc(String(i + 1).padStart(2, '0'))}</span>
        ${locked ? '<span class="pack-lock" aria-label="需要登录">🔒</span>' : ''}
        <img class="pack-icon" src="${iconFor('', p.title ?? '')}" alt="" loading="lazy">
        <span class="pack-title">${esc(p.title ?? '')}</span>
        ${p.subtitle ? `<span class="pack-sub">${esc(p.subtitle)}</span>` : ''}
        ${p.count != null ? `<span class="pack-count">${p.count} 词根</span>` : ''}
      </button>`;
    })
    .join('');
  root.innerHTML = `
    <div class="stack">
      <div class="crumb"><button class="back">← 返回</button><span>词根背诵法</span></div>
      <p class="root-note">先背原型词，再看它长出来的派生词。共 ${packs.length} 包${totalWords != null ? ` / ${totalWords} 个词根` : ''}。<br>
        建议配合语法的「词缀篇」一起看：那边讲词缀怎么变词，这边看词根变出了哪些词，
        两头对上，事半功倍。</p>
      <div class="pack-grid">${grid}</div>
    </div>`;
  root.querySelector('.back').addEventListener('click', back);
  root.querySelectorAll('.pack-card').forEach((el) =>
    el.addEventListener('click', () => open(el.dataset.id)));
}

// —— 第三层：词根卡 ——
export function renderRootPack(root, { pack, tts, back, onComplete }) {
  let index = 0;
  let flipped = false;

  function draw() {
    const w = pack.words[index];
    const last = index === pack.words.length - 1;
    const items = derivedItems(w.derived);
    root.innerHTML = `
      <div class="card-view">
        <div class="crumb">
          <button class="back">← 返回</button>
          <span class="card-progress">${esc(pack.no ? pack.no + ' ' : '')}${esc(pack.title)} · ${index + 1}/${pack.words.length}</span>
        </div>
        <div class="word-card root-card ${flipped ? 'flipped' : ''}">
          ${flipped
            ? `<div class="card-face card-back">
                 <div class="back-word">${esc(w.word)}</div>
                 <div class="card-zh">${esc(w.zh)}</div>
                 <div class="card-pos">${esc(w.pos)}</div>
                 <div class="card-example">${esc(w.example)}</div>
                 <div class="card-example-zh">${esc(w.exampleZh)}</div>
                 ${items.length
                   ? `<div class="root-derived">
                        <div class="root-derived-head">长出来的词</div>
                        <ul class="root-derived-list">
                          ${items.map((d) => `<li>${esc(d)}</li>`).join('')}
                        </ul>
                      </div>`
                   : ''}
               </div>`
            : `<div class="card-face card-front">
                 <img class="card-icon" src="${iconFor(w.word, pack.title)}" alt="" loading="lazy">
                 <div class="card-word">${esc(w.word)}</div>
                 <div class="card-tap">点卡片看派生词</div>
               </div>`}
        </div>
        <div class="card-actions">
          <button class="prev" ${index === 0 ? 'disabled' : ''}>上一个</button>
          <button class="speak">🔊 朗读</button>
          ${last ? '<button class="done">完成 ✓</button>' : '<button class="next">下一个</button>'}
        </div>
      </div>`;

    root.querySelector('.back').addEventListener('click', () => { tts.stop(); back(); });
    root.querySelector('.word-card').addEventListener('click', () => { flipped = !flipped; draw(); });
    root.querySelector('.speak').addEventListener('click', (e) => {
      e.stopPropagation();
      tts.speak(flipped ? w.example : w.word);
    });
    root.querySelector('.prev')?.addEventListener('click', () => {
      if (index > 0) { index--; flipped = false; draw(); }
    });
    root.querySelector('.next')?.addEventListener('click', () => { index++; flipped = false; draw(); });
    root.querySelector('.done')?.addEventListener('click', () => { tts.stop(); onComplete(); });
  }

  draw();
}
