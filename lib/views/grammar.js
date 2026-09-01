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

// 优先认 mod.visual（清单 meta.visual 摊平来的字段，见 app.js grammarList 分支），
// 认不出（不在 VISUALS 里，或压根没给）才退回 mod.id——四篇现有内容的 id 本身
// 就是合法文件名（phonetic/basic/affix/syntax），这条兜底一直好使，改动不影响它。
export function visualFor(mod) {
  const id = VISUALS.has(mod?.visual) ? mod.visual : (VISUALS.has(mod?.id) ? mod.id : 'affix');
  return `${VISUAL_DIR}/${id}.svg`;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// —— 第二层：四篇 ——
// modules 现在是清单条目摊平后的样子（{ id, title, number, subtitle, visual, lessons }，
// 见 app.js grammarList 分支：number/subtitle/visual/lessons 从清单条目的 meta 摊平来，
// lessons 是数字不是数组，别再对它调 .length）。
// meta 可能是 null——摊平时已经在 app.js 那边兜成 null 了，这里只管「null 就不画
// 那一块」：esc() 本身认 null（转成空字符串），number/subtitle 直接用它兜底；
// lessons 要拼「N 课」，null 时整段省略，不然会画出「null 课」。
export function renderGrammarList(root, modules, { open, back }) {
  root.innerHTML = `
    <div class="stack">
      <div class="crumb"><button class="back">← 返回</button><span>语法</span></div>
      <ul class="grammar-list">
        ${modules.map((m) => `
        <li><button class="grammar-item" data-id="${esc(m.id)}">
          <span class="grammar-mark">
            <img class="grammar-visual" src="${visualFor(m)}" alt="" loading="lazy">
            ${m.number ? `<span class="grammar-number">${esc(m.number)}</span>` : ''}
          </span>
          <div class="grammar-body">
            <span class="grammar-title">${esc(m.title)}</span>
            ${m.subtitle ? `<span class="grammar-subtitle">${esc(m.subtitle)}</span>` : ''}
          </div>
          ${m.lessons != null ? `<span class="grammar-count">${m.lessons} 课</span>` : ''}
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
      <ul class="lesson-list compact">
        ${mod.lessons.map((l, i) => `
        <li><button class="lesson-item" data-id="${esc(l.id)}">
          <span class="lesson-code">${esc(l.code ?? String(i + 1).padStart(2, '0'))}</span>
          <span class="lesson-name">${esc(l.title)}${l.advanced ? ' <em class="tag-adv">进阶</em>' : ''}</span>
          <span class="lesson-meta">${l.options.length}</span>
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

// 记法页：把 tip 拆成一张思维导图。
//
// tip 常写成「总原则：甲；乙；丙。补充说明。」这种一串对照。整段读下来记不住，
// 拆开后每条一个节点好得多——但拆之前得先把三样东西分开：
//   lead 总原则  首段「：」之前的话。它管着后面每一条，不该混进第一条里
//   nodes 条目   按分号切出来的对照项
//   foot 补充    最后一条句号之后的话。那是另一条独立的规则，不是最后一项的一部分
// 有些 tip 的条目本身已经带 ①②③（比如 meN- 的六条规则），这时候就用它自己的
// 编号，别再套一层，不然会出现「① ① mem- ＋…」这种双重编号。
const NUMBERED = /^[①-⑳]/;

export function parseTip(tip) {
  const raw = String(tip ?? '').trim();
  if (!raw) return { lead: '', nodes: [], foot: '' };

  const parts = raw.split(/[；;]/).map((x) => x.trim()).filter(Boolean);
  if (parts.length < 2) return { lead: raw, nodes: [], foot: '' };

  let lead = '';
  const head = parts[0].match(/^(.*?)[：:]\s*(.+)$/);
  if (head && head[1] && head[2]) {
    lead = head[1].trim();
    parts[0] = head[2].trim();
  }

  let foot = '';
  const tail = parts[parts.length - 1].match(/^(.*?[。])\s*(.+)$/);
  if (tail && tail[2]) {
    parts[parts.length - 1] = tail[1].replace(/。$/, '').trim();
    foot = tail[2].trim();
  }

  return { lead, nodes: parts.filter(Boolean), foot };
}

function tipPage(l) {
  const { lead, nodes, foot } = parseTip(l.tip);
  if (!nodes.length) return `<p class="point-body">${esc(lead || l.tip)}</p>`;
  const marks = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
  return `
    <div class="mind">
      <div class="mind-root">${esc(lead || l.title)}</div>
      <ul class="mind-branches">
        ${nodes.map((n, i) => {
          const own = NUMBERED.test(n);
          return `
          <li class="mind-branch">
            <span class="mind-node${own ? ' plain' : ''}">${own ? n.slice(0, 1) : (marks[i] ?? '◆')}</span>
            <div class="mind-leaf"><div class="point-body">${esc(own ? n.slice(1).trim() : n)}</div></div>
          </li>`;
        }).join('')}
      </ul>
      ${foot ? `<p class="mind-foot">＊ ${esc(foot)}</p>` : ''}
    </div>`;
}

// 注释怎么拆。
//
// 书里的注释是一整段挤在一起的：生词、对话的另外半句、又例、口语说法，全用
// 「·」和「｜」串成一行。读起来是一堵墙，而且更糟的是——书里的对话我们只引了
// 一句当例句，另外半句其实就藏在注释的「对话：」「回答：」后面，混在生词堆里
// 根本看不见。于是注释里出现的词在页面上找不到出处，用户报的就是这个。
//
// 拆法：先按「｜」切成几段，每段再看是哪一种：
//   vocab  生词表    用「·」串起来的「词 中文」，一行一个词
//   quote  引文      带「对话：」「回答：」「又例：」这类标签的，单独成块
// 生词块摆在最后：先让人看见对话和例句，再看词表。
const QUOTE_LABEL = /^(对话|回答|又例|同型|对照|等于|公式|口语|生活口语|陈述句|日常口语|问句|反问)\s*[：:]?\s*/;

export function parseNote(note) {
  const raw = String(note ?? '').trim();
  if (!raw) return [];
  const parts = raw.split(/[｜|]/).map((x) => x.trim()).filter(Boolean);
  const out = [];
  for (const part of parts) {
    const m = part.match(QUOTE_LABEL);
    if (m) {
      out.push({ kind: 'quote', label: m[1], text: part.slice(m[0].length).trim() });
    } else if (part.includes('·')) {
      out.push({
        kind: 'vocab',
        items: part.split('·').map((x) => x.trim()).filter(Boolean),
      });
    } else {
      out.push({ kind: 'text', text: part });
    }
  }
  // 生词表沉到底：对话和又例是「内容」，词表是「查阅」。
  return [...out.filter((x) => x.kind !== 'vocab'), ...out.filter((x) => x.kind === 'vocab')];
}

function noteBlocks(note) {
  const parts = parseNote(note);
  if (!parts.length) return '';
  return `<div class="option-note">${parts.map((p) => {
    if (p.kind === 'quote') {
      return `<div class="note-quote"><span class="note-tag">${esc(p.label)}</span>`
        + `<span class="note-quote-text">${esc(p.text)}</span></div>`;
    }
    if (p.kind === 'vocab') {
      return `<ul class="note-vocab">${p.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
    }
    return `<div class="note-text">${esc(p.text)}</div>`;
  }).join('')}</div>`;
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
      ${noteBlocks(o.note)}
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
        <span class="grammar-head-title">${esc(lesson.code ? lesson.code + " " : "")}${esc(lesson.title)}</span>
      </div>
      <div class="pager-host"></div>
    </div>`;

  renderPager(root.querySelector('.pager-host'), lessonPages(lesson));

  root.querySelector('.back').addEventListener('click', () => { tts.stop(); back(); });
  root.querySelectorAll('.speak-option').forEach((b) =>
    b.addEventListener('click', () => tts.speak(b.dataset.text)));
}
