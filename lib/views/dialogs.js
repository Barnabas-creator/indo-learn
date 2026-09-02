import { needsUnlock } from '../catalog-view.js';

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// 列表页现在读清单摊平后的样子（{ id, sceneZh, scene, rounds, tier }，见 app.js
// dialogList 分支：scene/rounds 是从清单条目的 meta.scene / meta.rounds 摊平来的，
// rounds 是数字不是数组，别再对它调 .length）。
// meta 可能是 null（坏数据兜底、新模块没给 meta）——scene/rounds 摊平时已经在
// app.js 那边兜成 null 了，这里只管「null 就不画那一块」，不猜、不崩、不显示 undefined。
//
// 11.5：对话是各自定价的（自由层/付费层混在同一个列表里），挂锁按条判——点击
// 仍然照常触发 open(id)，是否跳登录由 app.js 的 open 回调判 needsUnlock 决定，
// 这里只管视觉提示，不拦点击（对话没有「准备中」状态，能出现在这里就能点）。
export function renderDialogList(root, dialogs, { open, back, account }) {
  root.innerHTML = `
    <div class="stack">
      <div class="crumb"><button class="back">← 返回</button><span>场景对话</span></div>
    <ul class="dialog-list">
      ${dialogs
        .map(
          (d) => `
        <li><button class="dialog-item" data-id="${esc(d.id)}">
          <span class="dialog-zh">${esc(d.sceneZh)}</span>
          ${d.scene ? `<span class="dialog-id">${esc(d.scene)}</span>` : ''}
          ${d.rounds != null ? `<span class="dialog-count">${d.rounds} 轮</span>` : ''}
          ${needsUnlock(d, account) ? '<span class="dialog-lock" aria-label="需要登录">🔒</span>' : ''}
        </button></li>`,
        )
        .join('')}
    </ul>
    </div>`;
  root.querySelector('.back').addEventListener('click', back);
  root.querySelectorAll('.dialog-item').forEach((el) =>
    el.addEventListener('click', () => open(el.dataset.id)),
  );
}

export function renderDialog(root, dialog, { tts, back }) {
  root.innerHTML = `
    <div class="dialog-view">
      <div class="card-head">
        <button class="back">← 返回</button>
        <span class="dialog-title">${dialog.sceneZh}</span>
        <button class="play-all">▶ 连续播放</button>
      </div>

      ${dialog.situasi ? `<p class="dialog-situasi">${dialog.situasi}</p>` : ''}

      <ol class="lines">
        ${dialog.lines
          .map(
            (l, i) => `
          <li class="line speaker-${l.speaker}">
            <span class="who">${l.speaker}</span>
            <div class="line-body">
              <span class="line-id">${l.id_text}</span>
              <span class="line-zh">${l.zh}</span>
            </div>
            <button class="speak-line" data-i="${i}" aria-label="朗读">🔊</button>
          </li>`,
          )
          .join('')}
      </ol>

      <h3 class="section-title">关键句</h3>
      <ul class="key-phrases">
        ${dialog.keyPhrases
          .map(
            (k) => `<li><b>${k.id_text}</b><span>${k.zh}</span>`
              + (k.ganti ? `<span class="ganti">换：${k.ganti}</span>` : '')
              + '</li>',
          )
          .join('')}
      </ul>

      <h3 class="section-title">生词</h3>
      <ul class="dialog-vocab">
        ${dialog.vocab
          .map((v) => `<li><b>${v.word}</b><span>${v.zh}</span></li>`)
          .join('')}
      </ul>

      ${
        (dialog.tips ?? []).length
          ? '<h3 class="section-title">本地贴士</h3><ul class="dialog-tips">'
            + dialog.tips.map((t) => `<li>${t}</li>`).join('')
            + '</ul>'
          : ''
      }
    </div>`;

  root.querySelector('.back').addEventListener('click', () => {
    tts.stop();
    back();
  });
  root.querySelector('.play-all').addEventListener('click', () =>
    tts.speakSequence(dialog.lines.map((l) => l.id_text)),
  );
  root.querySelectorAll('.speak-line').forEach((b) =>
    b.addEventListener('click', () =>
      tts.speak(dialog.lines[Number(b.dataset.i)].id_text),
    ),
  );
}
