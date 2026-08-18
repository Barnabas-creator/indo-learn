export function renderDialogList(root, dialogs, { open, back }) {
  root.innerHTML = `
    <div class="stack">
      <div class="crumb"><button class="back">← 返回</button><span>场景对话</span></div>
    <ul class="dialog-list">
      ${dialogs
        .map(
          (d) => `
        <li><button class="dialog-item" data-id="${d.id}">
          <span class="dialog-zh">${d.sceneZh}</span>
          <span class="dialog-id">${d.scene}</span>
          <span class="dialog-count">${d.lines.length} 轮</span>
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
            (k) => `<li><b>${k.id_text}</b><span>${k.zh}</span></li>`,
          )
          .join('')}
      </ul>

      <h3 class="section-title">生词</h3>
      <ul class="dialog-vocab">
        ${dialog.vocab
          .map((v) => `<li><b>${v.word}</b><span>${v.zh}</span></li>`)
          .join('')}
      </ul>
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
