export function renderGrammarList(root, modules, { open, back }) {
  root.innerHTML = `
    <div class="stack">
      <div class="crumb"><button class="back">← 返回</button><span>语法</span></div>
    <ul class="grammar-list">
      ${modules
        .map(
          (m) => `
        <li><button class="grammar-item" data-id="${m.id}">
          <span class="grammar-number">${m.number}</span>
          <div class="grammar-body">
            <span class="grammar-title">${m.title}</span>
            <span class="grammar-subtitle">${m.subtitle}</span>
          </div>
          <span class="grammar-count">${m.lessons.length} 课</span>
        </button></li>`,
        )
        .join('')}
    </ul>
    </div>`;
  root.querySelector('.back').addEventListener('click', back);
  root.querySelectorAll('.grammar-item').forEach((el) =>
    el.addEventListener('click', () => open(el.dataset.id)),
  );
}

export function renderGrammarModule(root, mod, { tts, back }) {
  root.innerHTML = `
    <div class="grammar-view">
      <div class="card-head">
        <button class="back">← 返回</button>
        <span class="grammar-head-title">${mod.number} ${mod.title}</span>
      </div>

      ${mod.lessons
        .map(
          (l) => `
        <section class="lesson">
          <h3 class="lesson-title">${l.title}</h3>
          ${l.base ? `<p class="lesson-base">${l.base}</p>` : ''}
          ${l.instruction ? `<p class="lesson-instruction">${l.instruction}</p>` : ''}
          <ul class="options">
            ${l.options
              .map(
                (o) => `
              <li class="option">
                <div class="option-head">
                  <span class="option-label">${o.label}</span>
                  <span class="option-result">${o.result}</span>
                  <button class="speak-option" data-text="${escapeAttr(o.example)}" aria-label="朗读">🔊</button>
                </div>
                <div class="option-meaning">${o.meaning}</div>
                <div class="option-example">${o.example}</div>
                <div class="option-translation">${o.translation}</div>
                ${o.note ? `<div class="option-note">${o.note}</div>` : ''}
              </li>`,
              )
              .join('')}
          </ul>
          ${l.tip ? `<p class="lesson-tip">${l.tip}</p>` : ''}
        </section>`,
        )
        .join('')}
    </div>`;

  root.querySelector('.back').addEventListener('click', () => {
    tts.stop();
    back();
  });
  root.querySelectorAll('.speak-option').forEach((b) =>
    b.addEventListener('click', () => tts.speak(b.dataset.text)),
  );
}

function escapeAttr(s) {
  return String(s ?? '').replace(/"/g, '&quot;');
}
