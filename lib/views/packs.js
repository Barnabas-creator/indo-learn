// 单词包：网格列表 + 词卡。不显示任何进度、不记录任何状态。
import { iconFor } from '../icons.js';

export function renderPackList(root, packs, { open }) {
  root.innerHTML = `
    <div class="pack-grid">
      ${packs
        .map(
          (p) => `
        <button class="pack-card" data-id="${p.id}">
          <img class="pack-icon" src="${iconFor('', p.title)}" alt="" loading="lazy">
          <span class="pack-title">${p.title}</span>
          <span class="pack-subtitle">${p.subtitle}</span>
          <span class="pack-count">${p.words.length} 词</span>
        </button>`,
        )
        .join('')}
    </div>`;
  root.querySelectorAll('.pack-card').forEach((el) =>
    el.addEventListener('click', () => open(el.dataset.id)),
  );
}

export function renderPack(root, pack, { tts, back }) {
  let index = 0;
  let flipped = false;

  function draw() {
    const w = pack.words[index];
    root.innerHTML = `
      <div class="card-view">
        <div class="card-head">
          <button class="back">← 返回</button>
          <span class="card-progress">${pack.title} · ${index + 1}/${pack.words.length}</span>
        </div>

        <div class="word-card ${flipped ? 'flipped' : ''}">
          ${
            flipped
              ? `<div class="card-face card-back">
                   <div class="card-back-word">${w.word}</div>
                   <div class="card-zh">${w.zh}</div>
                   <div class="card-pos">${w.pos}</div>
                   <div class="card-example">${w.example}</div>
                   <div class="card-example-zh">${w.exampleZh}</div>
                 </div>`
              : `<div class="card-face card-front">
                   <img class="card-icon" src="${iconFor(w.word, pack.title)}" alt="" loading="lazy">
                   <div class="card-word">${w.word}</div>
                   <div class="card-tap-hint">点击卡片看释义</div>
                 </div>`
          }
        </div>

        <div class="card-actions">
          <button class="prev" ${index === 0 ? 'disabled' : ''}>上一个</button>
          <button class="speak">🔊 朗读</button>
          <button class="next" ${index === pack.words.length - 1 ? 'disabled' : ''}>下一个</button>
        </div>
      </div>`;

    root.querySelector('.back').addEventListener('click', () => {
      tts.stop();
      back();
    });
    root.querySelector('.word-card').addEventListener('click', () => {
      flipped = !flipped;
      draw();
    });
    root.querySelector('.speak').addEventListener('click', (e) => {
      e.stopPropagation();
      tts.speak(flipped ? w.example : w.word);
    });
    root.querySelector('.prev').addEventListener('click', () => {
      if (index > 0) {
        index--;
        flipped = false;
        draw();
      }
    });
    root.querySelector('.next').addEventListener('click', () => {
      if (index < pack.words.length - 1) {
        index++;
        flipped = false;
        draw();
      }
    });
  }

  draw();
}
