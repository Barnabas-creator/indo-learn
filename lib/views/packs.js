// 单词包：分级页 → 包网格 → 词卡 → 恭喜页。
// 全程不记录进度：恭喜/跳转纯靠数据顺序算，关掉 App 即重置。
import { iconFor } from '../icons.js';

// —— 第二层：初级/中级/高级分级页 ——
export function renderLevels(root, { levels, counts, open, back }) {
  root.innerHTML = `
    <div class="stack">
      <div class="crumb"><button class="back">← 返回</button><span>单词包</span></div>
      <div class="level-cards">
        ${levels
          .map((lv) => {
            const { open: ready, total } = counts[lv.id];
            return `
          <button class="level-card ${ready ? '' : 'soon'}" data-id="${lv.id}">
            <span class="level-badge">${ready ? '开放 ' + ready + ' 包' : '准备中'}</span>
            <span class="level-title">${lv.title}</span>
            <span class="level-sub">${lv.subtitle}</span>
            <span class="level-meta">${total} 个主题</span>
          </button>`;
          })
          .join('')}
      </div>
    </div>`;
  root.querySelector('.back').addEventListener('click', back);
  root.querySelectorAll('.level-card').forEach((el) =>
    el.addEventListener('click', () => open(el.dataset.id)),
  );
}

// —— 第三层：某一级的主题包网格 ——
export function renderPackGrid(root, { levelTitle, packs, open, back }) {
  // 开放与否逐包判断：有词条就能进，没有就是「准备中」。
  const openCount = packs.filter((p) => p.words.length).length;
  const grid = packs
    .map((p, i) => {
      const ready = p.words.length > 0;
      return `
      <button class="pack-card ${ready ? '' : 'soon'}" data-i="${i}" ${ready ? '' : 'disabled'}>
        <img class="pack-icon" src="${iconFor('', p.title)}" alt="" loading="lazy">
        <span class="pack-title">${p.title}</span>
        <span class="pack-sub">${p.subtitle}</span>
        <span class="pack-count">${ready ? p.words.length + ' 词' : '准备中'}</span>
      </button>`;
    })
    .join('');
  root.innerHTML = `
    <div class="stack">
      <div class="crumb"><button class="back">← 返回</button><span>${levelTitle}</span></div>
      ${
        openCount === packs.length
          ? ''
          : `<p class="soon-note">已开放 ${openCount} / ${packs.length} 个主题，其余正在准备中。</p>`
      }
      <div class="pack-grid">${grid}</div>
    </div>`;
  root.querySelector('.back').addEventListener('click', back);
  root.querySelectorAll('.pack-card:not([disabled])').forEach((el) =>
    el.addEventListener('click', () => open(Number(el.dataset.i))),
  );
}

// —— 第四层：词卡（连续刷，末张变「完成」） ——
export function renderPack(root, { pack, tts, back, onComplete }) {
  let index = 0;
  let flipped = false;

  function draw() {
    const w = pack.words[index];
    const last = index === pack.words.length - 1;
    root.innerHTML = `
      <div class="card-view">
        <div class="crumb">
          <button class="back">← 返回</button>
          <span class="card-progress">${pack.title} · ${index + 1}/${pack.words.length}</span>
        </div>
        <div class="word-card ${flipped ? 'flipped' : ''}">
          ${
            flipped
              ? `<div class="card-face card-back">
                   <div class="back-word">${w.word}</div>
                   <div class="card-zh">${w.zh}</div>
                   <div class="card-pos">${w.pos}</div>
                   <div class="card-example">${w.example}</div>
                   <div class="card-example-zh">${w.exampleZh}</div>
                 </div>`
              : `<div class="card-face card-front">
                   <img class="card-icon" src="${iconFor(w.word, pack.title)}" alt="" loading="lazy">
                   <div class="card-word">${w.word}</div>
                   <div class="card-tap">点卡片看释义</div>
                 </div>`
          }
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

// —— 恭喜页 ——
export function renderCongrats(root, { pack, nextLabel, back, next }) {
  root.innerHTML = `
    <div class="congrats">
      <div class="congrats-burst">🎉</div>
      <h2 class="congrats-title">完成！</h2>
      <p class="congrats-pack">《${pack.title} · ${pack.subtitle}》</p>
      <p class="congrats-line">这一包 ${pack.words.length} 个词都过了一遍。</p>
      <div class="congrats-actions">
        <button class="back">← 返回列表</button>
        <button class="next primary">${nextLabel} →</button>
      </div>
    </div>`;
  root.querySelector('.back').addEventListener('click', back);
  root.querySelector('.next').addEventListener('click', next);
}
