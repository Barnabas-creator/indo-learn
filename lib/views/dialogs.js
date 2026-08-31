// 列表页现在读清单（只有 id + sceneZh，见 app.js dialogList 分支），不再是整段对话——
// scene（印尼语原名）和「N 轮」都是正文才有的东西，scene 本来就跟标题重复，直接去掉；
// 「N 轮」只在 lines 存在时才画（点开详情后正文里带 lines，走这条分支的调用方
// 目前没有，留着是为了这个函数不用因为「谁传了正文谁传了清单」分叉成两个函数）。
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
          ${d.lines ? `<span class="dialog-count">${d.lines.length} 轮</span>` : ''}
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
