// 语法：篇的列表 → 篇里的课 → 一课的分页阅读。
// 内容转写自《我的第一本印尼语文法》。
//
// 原本只有两层，一篇 37 课全塞进一个左右翻页里——翻到第 20 页根本不知道自己在哪。
// 现在中间加了一层课列表：先挑课，再进这一课的分页。
//
// 一课怎么分页：第一页永远是概览（这一课在讲什么规则），有记法就再来一页
// 思维导图，之后每个用法各占一页。这样一屏只讲一件事，字号放得开，
// 「这一课有几种用法」也从翻页条上直接看得出来。

import { renderPager } from './pager.js';

// 每一篇配一张概念图。语法讲的都是抽象的东西（词缀、语序、从句），
// 没有实物可画，所以这些图是手写的 SVG 而不是 OpenMoji 的现成图案。
// 找不到对应的图就退回默认那张，绝不让 <img> 挂着断链。
const VISUAL_DIR = 'assets/grammar-svg/book';
const VISUALS = new Set(['phonetic', 'basic', 'affix', 'syntax']);

export function visualFor(mod) {
  const id = VISUALS.has(mod?.id) ? mod.id : 'affix';
  return `${VISUAL_DIR}/${id}.svg`;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// —— 第二层：四篇 ——
export function renderGrammarList(root, modules, { open, back }) {
  root.innerHTML = `
    <div class="stack">
      <div class="crumb"><button class="back">← 返回</button><span>语法</span></div>
      <ul class="grammar-list">
        ${modules.map((m) => `
        <li><button class="grammar-item" data-id="${esc(m.id)}">
          <span class="grammar-mark">
            <img class="grammar-visual" src="${visualFor(m)}" alt="" loading="lazy">
            <span class="grammar-number">${esc(m.number)}</span>
          </span>
          <div class="grammar-body">
            <span class="grammar-title">${esc(m.title)}</span>
            <span class="grammar-subtitle">${esc(m.subtitle)}</span>
          </div>
          <span class="grammar-count">${m.lessons.length} 课</span>
        </button></li>`).join('')}
      </ul>
    </div>`;
  root.querySelector('.back').addEventListener('click', back);
  root.querySelectorAll('.grammar-item').forEach((el) =>
    el.addEventListener('click', () => open(el.dataset.id)));
}

// —— 第三层：一篇里的课 ——
export function renderGrammarLessons(root, mod, { open, back }) {
  root.innerHTML = `
    <div class="stack">
      <div class="crumb">
        <button class="back">← 返回</button>
        <img class="grammar-head-visual" src="${visualFor(mod)}" alt="" loading="lazy">
        <span>${esc(mod.number)} ${esc(mod.title)}</span>
      </div>
      <ul class="lesson-list">
        ${mod.lessons.map((l, i) => `
        <li><button class="lesson-item" data-id="${esc(l.id)}">
          <span class="lesson-order">${String(i + 1).padStart(2, '0')}</span>
          <div class="lesson-body">
            <span class="lesson-name">${esc(l.title)}${l.advanced ? ' <em class="tag-adv">进阶</em>' : ''}</span>
            ${l.base ? `<span class="lesson-task">${esc(l.base)}</span>` : ''}
          </div>
          <span class="lesson-meta">${l.options.length} 例</span>
        </button></li>`).join('')}
      </ul>
    </div>`;
  root.querySelector('.back').addEventListener('click', back);
  root.querySelectorAll('.lesson-item').forEach((el) =>
    el.addEventListener('click', () => open(el.dataset.id)));
}

// —— 第四层：一课的分页 ——

// 概览页：这一课在讲什么规则。
function overviewPage(l) {
  return `
    ${l.base ? `<p class="lesson-base">📐 ${esc(l.base)}</p>` : ''}
    ${l.instruction ? `<p class="lesson-instruction">${esc(l.instruction)}</p>` : ''}
    <p class="overview-hint">👉 右滑看${l.tip ? '记法与' : ''}用法（共 ${l.options.length} 个）</p>`;
}

// 记法页：把 tip 拆成节点排成思维导图。
// tip 里常写成「A→B；C→D」这种一串对照，拆开后每条一个节点比一整段好记得多。
export function splitTip(tip) {
  const parts = String(tip ?? '')
    .split(/[；;]/)
    .map((x) => x.trim())
    .filter(Boolean);
  return parts.length > 1 ? parts : [];
}

function tipPage(l) {
  const nodes = splitTip(l.tip);
  if (!nodes.length) return `<p class="point-body">${esc(l.tip)}</p>`;
  return `
    <div class="mind">
      <div class="mind-root">${esc(l.title)}</div>
      <ul class="mind-branches">
        ${nodes.map((n, i) => `
          <li class="mind-branch">
            <span class="mind-node">${['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧'][i] ?? '◆'}</span>
            <div class="mind-leaf"><div class="point-body">${esc(n)}</div></div>
          </li>`).join('')}
      </ul>
    </div>`;
}

// 用法页：一个用法一页，例句放大。
function optionPage(o) {
  return `
    <div class="option-solo">
      <div class="option-head">
        <span class="option-label">${esc(o.label)}</span>
        <span class="option-arrow">→</span>
        <span class="option-result">${esc(o.result)}</span>
      </div>
      <div class="option-meaning">${esc(o.meaning)}</div>
      <button class="option-example speak-option" data-text="${esc(o.example)}">
        ${esc(o.example)} <span class="speak-mark">🔊</span>
      </button>
      <div class="option-translation">${esc(o.translation)}</div>
      ${o.note ? `<div class="option-note">✎ ${esc(o.note)}</div>` : ''}
    </div>`;
}

export function lessonPages(l) {
  const pages = [{ label: '概览', icon: '📐', body: overviewPage(l) }];
  if (l.tip) pages.push({ label: '记法', icon: '🧭', body: tipPage(l) });
  for (const o of l.options) {
    pages.push({ label: o.label, icon: String(pages.length + 1 - (l.tip ? 2 : 1)), body: optionPage(o) });
  }
  return pages;
}

export function renderGrammarLesson(root, mod, lesson, { tts, back }) {
  root.innerHTML = `
    <div class="grammar-view">
      <div class="card-head">
        <button class="back">← 返回</button>
        <span class="grammar-head-title">${esc(lesson.title)}</span>
      </div>
      <div class="pager-host"></div>
    </div>`;

  renderPager(root.querySelector('.pager-host'), lessonPages(lesson));

  root.querySelector('.back').addEventListener('click', () => { tts.stop(); back(); });
  root.querySelectorAll('.speak-option').forEach((b) =>
    b.addEventListener('click', () => tts.speak(b.dataset.text)));
}
