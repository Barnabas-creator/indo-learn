// 教材听力：单元列表 → 一段听力。
//
// 跟场景对话最大的不同是顺序：这里**先听、后看**。原文默认是折叠的，
// 做完题再展开对答案——原文摆在眼前的听力练习等于阅读练习，练不到耳朵。
//
// 音频是印尼教育部 BIPA 教材的原配录音（真人朗读），不是 TTS。文件明文放在
// assets/ 下：这批录音本来就是公开教材的附件，加密它挡不住任何人，
// 我们自己写的转写、翻译、题目才是加密内容。
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// 列表按单元分组。单元顺序按第一次出现的顺序，不重排——
// 内容文件本来就是按单元排的，谁先出现谁在前。
export function groupByUnit(items) {
  const units = [];
  const byId = new Map();
  for (const item of items ?? []) {
    let u = byId.get(item.unit);
    if (!u) {
      u = { id: item.unit, title: item.unitZh, items: [] };
      byId.set(item.unit, u);
      units.push(u);
    }
    u.items.push(item);
  }
  return units;
}

export function mmss(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// —— 第二层：对话与听力的分类页 ——
// 条数以前靠先把两份内容整包取回来数 length；现在改从清单摊平的 counts 拿——
// 对话数是清单里 dialogs 条目的个数，听力数是 listening 那个唯一单元的 meta.count
// （见 app.js audioCats 分支），两个都是清单里现成的数字，不用为了这一层多发请求。
// counts.dialogs / counts.listening 可能是 null（坏数据兜底、模块没在清单里出现
// 过）——null 就不画那块徽标，不猜一个假数；只有真的数到 0 才标灰成「soon」，
// 跟以前「meta.startsWith('0')」是同一个「真零才灰」的意思，null 不算零。
//
// 11.5：locked.dialogs / locked.listening 由 app.js 用 catalog-view.js 的
// categoryLocked 算出来传进来（听力只有一个单元，tier 单一；对话是「这一类
// 里每一条都要登录」才算锁住，见 categoryLocked 的注释）。「soon」和「locked」
// 是两种不同状态，不能共用一个 class——soon 是「这类内容压根还没有」，locked
// 是「有内容，但账号看不了」，二者互斥（count===0 时 units 数组必空，
// categoryLocked 天然算不出 true），但视觉上仍然各自独立标记，别让人以为
// 灰掉的卡片都是一个意思。点击仍然照常触发 open(id)，是否跳登录由 app.js
// 的 open 回调判 needsUnlock/categoryLocked 决定，这里只管视觉提示。
export function renderAudioCats(root, { counts, locked, open, back }) {
  const cats = [
    { id: 'dialogs', title: '情境对话', sub: '真实场景整段对话，配朗读', count: counts?.dialogs, unit: '组' },
    { id: 'listening', title: '教材听力', sub: 'BIPA 官方教材录音 ＋ 听力题', count: counts?.listening, unit: '段' },
  ];
  root.innerHTML = `
    <div class="stack">
      <div class="crumb"><button class="back">← 返回</button><span>对话与听力</span></div>
      <div class="level-cards">
        ${cats.map((c) => {
          const isLocked = Boolean(locked?.[c.id]);
          return `
          <button class="level-card ${c.count === 0 ? 'soon' : ''} ${isLocked ? 'locked' : ''}" data-id="${c.id}">
            ${c.count != null ? `<span class="level-badge">${c.count} ${esc(c.unit)}</span>` : ''}
            <span class="level-title">${esc(c.title)}</span>
            <span class="level-sub">${esc(c.sub)}</span>
            ${isLocked ? '<span class="level-lock" aria-label="需要登录">🔒</span>' : ''}
          </button>`;
        }).join('')}
      </div>
    </div>`;
  root.querySelector('.back').addEventListener('click', back);
  root.querySelectorAll('.level-card').forEach((el) =>
    el.addEventListener('click', () => open(el.dataset.id)));
}

// —— 第三层：按单元列出每一段 ——
export function renderListenList(root, items, { open, back }) {
  const units = groupByUnit(items);
  root.innerHTML = `
    <div class="stack">
      <div class="crumb"><button class="back">← 返回</button><span>教材听力</span></div>
      <p class="soon-note">录音是 BIPA 官方教材的原配真人录音。先听两遍再做题，最后才看原文。</p>
      ${units.map((u) => `
        <h3 class="section-title">${esc(u.title)}</h3>
        <ul class="listen-list">
          ${u.items.map((it) => `
            <li><button class="listen-item" data-id="${esc(it.id)}">
              <span class="listen-code">${esc(it.code)}</span>
              <span class="listen-name">${esc(it.titleZh)}</span>
              <span class="listen-meta">${mmss(it.seconds)} · ${it.quiz.length} 题</span>
            </button></li>`).join('')}
        </ul>`).join('')}
    </div>`;
  root.querySelector('.back').addEventListener('click', back);
  root.querySelectorAll('.listen-item').forEach((el) =>
    el.addEventListener('click', () => open(el.dataset.id)));
}

// —— 第四层：一段听力 ——
export function renderListen(root, item, { tts, back }) {
  root.innerHTML = `
    <div class="listen-view">
      <div class="card-head">
        <button class="back">← 返回</button>
        <span class="listen-title">${esc(item.code)} ${esc(item.titleZh)}</span>
      </div>

      <div class="player">
        <audio class="audio" src="${esc(item.audio)}" preload="none" controls></audio>
        <div class="player-actions">
          <button class="replay">↺ 重听</button>
          <button class="rate" data-rate="1">速度 1.0×</button>
        </div>
      </div>

      <p class="listen-guide">🎧 ${esc(item.guide)}</p>

      <h3 class="section-title">听力题</h3>
      ${item.quiz.map((q, qi) => `
        <div class="quiz" data-q="${qi}">
          <div class="quiz-prompt">${esc(q.prompt)}</div>
          <ul class="quiz-choices">
            ${q.choices.map((c, ci) => `
              <li><button class="choice" data-q="${qi}" data-c="${ci}">${esc(c.text)}</button></li>`).join('')}
          </ul>
          <div class="quiz-why"></div>
        </div>`).join('')}

      <button class="reveal">📄 显示原文与翻译</button>
      <div class="transcript" hidden>
        <ol class="lines">
          ${item.lines.map((l, i) => `
            <li class="line">
              <span class="who">${esc(l.speaker)}</span>
              <div class="line-body">
                <span class="line-id" data-i="${i}">${esc(l.id_text)}</span>
                <span class="line-zh">${esc(l.zh)}</span>
              </div>
              <button class="speak-line" data-i="${i}" aria-label="朗读">🔊</button>
            </li>`).join('')}
        </ol>
      </div>

      <h3 class="section-title">表达法</h3>
      <ul class="key-phrases">
        ${item.phrases.map((p) => `<li><b>${esc(p.id_text)}</b><span>${esc(p.zh)}</span>`
          + (p.ganti ? `<span class="ganti">换：${esc(p.ganti)}</span>` : '') + '</li>').join('')}
      </ul>

      <h3 class="section-title">生词</h3>
      <ul class="dialog-vocab">
        ${item.vocab.map((v) => `<li><b>${esc(v.word)}</b><span>${esc(v.zh)}</span></li>`).join('')}
      </ul>

      <h3 class="section-title">贴士</h3>
      <ul class="dialog-tips">
        ${item.tips.map((t) => `<li>${esc(t)}</li>`).join('')}
      </ul>
    </div>`;

  const audio = root.querySelector('.audio');

  root.querySelector('.back').addEventListener('click', () => { tts.stop(); audio.pause(); back(); });

  root.querySelector('.replay').addEventListener('click', () => {
    audio.currentTime = 0;
    audio.play();
  });

  // 慢速在 0.75× 与 1.0× 之间来回切。听不清的时候放慢，是听力练习最实用的一个键。
  root.querySelector('.rate').addEventListener('click', (e) => {
    const next = Number(e.currentTarget.dataset.rate) === 1 ? 0.75 : 1;
    audio.playbackRate = next;
    e.currentTarget.dataset.rate = String(next);
    e.currentTarget.textContent = `速度 ${next.toFixed(2).replace(/0$/, '')}×`;
  });

  // 原文一展开就不再收回：收回没意义——已经看过了。
  const reveal = root.querySelector('.reveal');
  reveal.addEventListener('click', () => {
    root.querySelector('.transcript').hidden = false;
    reveal.remove();
  });

  // 转写里的句子仍然可以用 TTS 单句复读：官方录音是整段的，抠不出单句。
  root.querySelectorAll('.speak-line, .line-id').forEach((el) =>
    el.addEventListener('click', () => tts.speak(item.lines[Number(el.dataset.i)].id_text)));

  // 判对错只改样式、写一句解释，不记分也不落盘——跟课程小测同一套规矩。
  root.querySelectorAll('.choice').forEach((el) =>
    el.addEventListener('click', () => {
      const q = item.quiz[Number(el.dataset.q)];
      const c = q.choices[Number(el.dataset.c)];
      const box = root.querySelector(`.quiz[data-q="${el.dataset.q}"]`);
      box.querySelectorAll('.choice').forEach((b) => b.classList.remove('picked', 'right', 'wrong'));
      el.classList.add('picked', c.ok ? 'right' : 'wrong');
      const why = box.querySelector('.quiz-why');
      why.textContent = `${c.ok ? '✅ ' : '❌ '}${c.why}`;
      why.className = `quiz-why ${c.ok ? 'right' : 'wrong'}`;
    }));
}
