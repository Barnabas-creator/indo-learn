function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// 列表页现在读清单摊平后的样子（{ id, sceneZh, scene, rounds }，见 app.js dialogList
// 分支：scene/rounds 是从清单条目的 meta.scene / meta.rounds 摊平来的，rounds 是
// 数字不是数组，别再对它调 .length）。
// meta 可能是 null（坏数据兜底、新模块没给 meta）——scene/rounds 摊平时已经在
// app.js 那边兜成 null 了，这里只管「null 就不画那一块」，不猜、不崩、不显示 undefined。
export function renderDialogList(root, dialogs, { open, back }) {
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
