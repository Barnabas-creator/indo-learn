// 词根背诵法：包列表 → 词根卡。
//
// 跟单词包长得像，但背的东西不一样：单词包背「这个词是什么意思」，
// 这里背「这个词根能长出哪些词」。印尼语的词绝大多数是词根加前后缀拼出来的，
// 认得 200 个常见原型词，一大片派生词就能猜个八九不离十。
// 所以卡背面最重的一块是 derived —— 那一行才是这个模块存在的理由。
import { iconFor } from '../icons.js';

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
// packs 现在是清单条目（{ id, tier, title }，见 app.js rootList 分支），不是取到手的
// 正文——title 眼下清单里恒为 null（词根标题算正文的一部分，没解锁不该看到），
// subtitle/words 更是压根没有。点进 rootCards 才会按 id 取到真正文。
// 编号靠列表位置算（同 packsWithStatus 的 no），标题拿不到就留空，别猜词数。
export function renderRootList(root, packs, { open, back }) {
  const grid = packs
    .map((p, i) => `
      <button class="pack-card" data-id="${esc(p.id)}">
        <span class="pack-no">${esc(String(i + 1).padStart(2, '0'))}</span>
        <img class="pack-icon" src="${iconFor('', p.title ?? '')}" alt="" loading="lazy">
        <span class="pack-title">${esc(p.title ?? '')}</span>
      </button>`)
    .join('');
  root.innerHTML = `
    <div class="stack">
      <div class="crumb"><button class="back">← 返回</button><span>词根背诵法</span></div>
      <p class="root-note">先背原型词，再看它长出来的派生词。共 ${packs.length} 包。<br>
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
