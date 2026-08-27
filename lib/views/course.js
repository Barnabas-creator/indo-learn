// 课程学习：单元列表 → 单元里的课 → 课文页。
// 内容转写自印尼教育部官方教材 Sahabatku Indonesia 的 A1 册。
//
// 课文页是左右翻页的四张卡（生词 / 对话 / 要点 / 小测），不是一根长条——
// 每屏只放一件事，字号才放得开，看到哪一块也一目了然。见 pager.js。
//
// 跟对话/语法一样：只渲染 + 绑事件，不碰网络。小测在本地判对错，不落盘。

import { renderPager } from './pager.js';

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// —— 第二层：单元列表 ——
export function renderCourseUnits(root, units, { open, back }) {
  root.innerHTML = `
    <div class="stack">
      <div class="crumb"><button class="back">← 返回</button><span>课程 · BIPA A1</span></div>
      <p class="soon-note">印尼教育部官方教材 <em>Sahabatku Indonesia</em> 初级 A1，共 ${units.length} 个单元。</p>
      <ul class="unit-list">
        ${units.map((u) => `
        <li><button class="unit-item" data-id="${esc(u.id)}">
          <span class="unit-number">${esc(u.number)}</span>
          <div class="unit-body">
            <span class="unit-title">${esc(u.titleZh)}</span>
            <span class="unit-title-id">${esc(u.title)}</span>
            <span class="unit-goal">${esc(u.goal)}</span>
          </div>
          <span class="unit-count">${u.lessons.length} 课</span>
        </button></li>`).join('')}
      </ul>
    </div>`;
  root.querySelector('.back').addEventListener('click', back);
  root.querySelectorAll('.unit-item').forEach((el) =>
    el.addEventListener('click', () => open(el.dataset.id)));
}

// —— 第三层：某单元里的课 ——
export function renderCourseLessons(root, unit, { open, back }) {
  root.innerHTML = `
    <div class="stack">
      <div class="crumb"><button class="back">← 返回</button><span>${esc(unit.number)} ${esc(unit.titleZh)}</span></div>
      <p class="unit-goal-full">🎯 ${esc(unit.goal)}</p>
      <ul class="lesson-list">
        ${unit.lessons.map((l) => `
        <li><button class="lesson-item" data-id="${esc(l.id)}">
          <span class="lesson-order">${esc(l.order)}</span>
          <div class="lesson-body">
            <span class="lesson-name">${esc(l.title)}</span>
            <span class="lesson-task">${esc(l.task)}</span>
          </div>
          <span class="lesson-meta">${l.words.length} 词</span>
        </button></li>`).join('')}
      </ul>
    </div>`;
  root.querySelector('.back').addEventListener('click', back);
  root.querySelectorAll('.lesson-item').forEach((el) =>
    el.addEventListener('click', () => open(el.dataset.id)));
}

// —— 第四层：课文页，四张横向卡片 ——

function wordsPage(lesson) {
  return `
    <ul class="word-chips">
      ${lesson.words.map((w) => `
        <li class="word-chip" data-text="${esc(w.text)}">
          <span class="chip-id">${esc(w.text)}</span>
          <span class="chip-zh">${esc(w.meaning)}</span>
          <span class="chip-play">🔊</span>
        </li>`).join('')}
    </ul>`;
}

function scenePage(lesson) {
  return `
    <div class="scene-head">
      <span class="scene-where">${esc(lesson.scene.title)}</span>
      <button class="play-all">▶ 连播</button>
    </div>
    <ul class="scene-lines">
      ${lesson.scene.lines.map((l, i) => `
        <li class="scene-line">
          <span class="line-speaker">${esc(l.speaker)}</span>
          <div class="line-body">
            <button class="line-id" data-i="${i}">${esc(l.text)}</button>
            <div class="line-zh">${esc(l.meaning)}</div>
          </div>
        </li>`).join('')}
    </ul>`;
}

// 要点排成一根竖脊 + 分枝节点，是思维导图那种读法：
// 一眼看得出「这一课有三个要点」，而不是三段并排的文字。
function pointsPage(lesson) {
  return `
    <div class="mind">
      <div class="mind-root">${esc(lesson.task)}</div>
      <ul class="mind-branches">
        ${lesson.points.map((p, i) => `
          <li class="mind-branch">
            <span class="mind-node">${['①', '②', '③', '④', '⑤'][i] ?? '◆'}</span>
            <div class="mind-leaf">
              <div class="point-title">${esc(p.title)}</div>
              <div class="point-body">${esc(p.body)}</div>
            </div>
          </li>`).join('')}
      </ul>
    </div>`;
}

function quizPage(lesson) {
  return lesson.quiz.map((q, qi) => `
    <div class="quiz" data-q="${qi}">
      <div class="quiz-prompt">${esc(q.prompt)}</div>
      ${q.context ? `<div class="quiz-context">💭 ${esc(q.context)}</div>` : ''}
      <ul class="quiz-choices">
        ${q.choices.map((c, ci) => `
          <li><button class="choice" data-q="${qi}" data-c="${ci}">${esc(c.text)}</button></li>`).join('')}
      </ul>
      <div class="quiz-why"></div>
    </div>`).join('');
}

export function renderCourseLesson(root, lesson, { tts, back }) {
  root.innerHTML = `
    <div class="course-view">
      <div class="card-head">
        <button class="back">← 返回</button>
        <span class="course-head-title">${esc(lesson.order)} ${esc(lesson.title)}</span>
      </div>
      <div class="pager-host"></div>
    </div>`;

  renderPager(root.querySelector('.pager-host'), [
    { label: '生词', icon: '📕', body: wordsPage(lesson) },
    { label: '对话', icon: '💬', body: scenePage(lesson) },
    { label: '要点', icon: '🧭', body: pointsPage(lesson) },
    { label: '小测', icon: '✏️', body: quizPage(lesson) },
  ]);

  root.querySelector('.back').addEventListener('click', () => { tts.stop(); back(); });
  root.querySelector('.play-all').addEventListener('click', () =>
    tts.speakSequence(lesson.scene.lines.map((l) => l.text)));
  root.querySelectorAll('.word-chip').forEach((el) =>
    el.addEventListener('click', () => tts.speak(el.dataset.text)));
  root.querySelectorAll('.line-id').forEach((el) =>
    el.addEventListener('click', () => tts.speak(lesson.scene.lines[Number(el.dataset.i)].text)));

  // 判对错只改样式、写一句解释，不记分也不落盘：答错了还能接着点，
  // 目的是看懂为什么错，不是考试。
  root.querySelectorAll('.choice').forEach((el) =>
    el.addEventListener('click', () => {
      const q = lesson.quiz[Number(el.dataset.q)];
      const c = q.choices[Number(el.dataset.c)];
      const box = root.querySelector(`.quiz[data-q="${el.dataset.q}"]`);
      box.querySelectorAll('.choice').forEach((b) => b.classList.remove('picked', 'right', 'wrong'));
      el.classList.add('picked', c.ok ? 'right' : 'wrong');
      const why = box.querySelector('.quiz-why');
      why.textContent = `${c.ok ? '✅ ' : '❌ '}${c.why}`;
      why.className = `quiz-why ${c.ok ? 'right' : 'wrong'}`;
    }));
}
