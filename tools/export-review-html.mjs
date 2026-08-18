// 生成一份可在手机浏览器里直接审校的单页 HTML。
// 与 tools/export-review.py 产出的 Excel 等价，区别是能标记 + 一键复制问题清单。
//
// 用法：node tools/export-review-html.mjs [输出路径]
//
// 注意：产物含全部词条与对话的明文，不得提交到公开仓库。
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadPacks } from './load-packs.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] ?? join(root, '印尼语词库审校.html');

const packs = loadPacks();
const dialogs = JSON.parse(readFileSync(join(root, 'content-src/dialogs.json'), 'utf8'));

// 压缩成数组形式，减小内联体积
const DATA = {
  packs: packs.map((p) => ({
    s: p.stage,
    t: p.title,
    u: p.subtitle,
    w: p.words.map((w) => [w.word, w.pos, w.zh, w.example, w.exampleZh]),
  })),
  dialogs: dialogs.map((d) => ({
    z: d.sceneZh,
    i: d.scene,
    l: d.lines.map((l) => [l.speaker, l.id_text, l.zh]),
    k: d.keyPhrases.map((k) => [k.id_text, k.zh]),
    v: d.vocab.map((v) => [v.word, v.zh]),
  })),
};

const html = `<title>印尼语词库审校</title>
<style>
:root {
  --ground: #f5f7f4;
  --surface: #ffffff;
  --surface-2: #eef1ee;
  --ink: #16202b;
  --ink-2: #4a5b66;
  --ink-3: #7b8b95;
  --line: #dde3df;
  --accent: #0b6e5f;
  --accent-soft: #e2efec;
  --flag: #b3400c;
  --flag-soft: #fbeae1;
  --maybe: #8a6a00;
  --maybe-soft: #f7f0d8;
  --shadow: 0 1px 2px rgba(22, 32, 43, .06), 0 8px 24px rgba(22, 32, 43, .05);

  --font-id: Georgia, "Iowan Old Style", "Times New Roman", serif;
  --font-zh: system-ui, -apple-system, "PingFang SC", "Noto Sans SC",
             "Microsoft YaHei", sans-serif;
  --step--1: .8125rem;
  --step-0: .9375rem;
  --step-1: 1.0625rem;
  --step-2: 1.25rem;
  --step-3: 1.5rem;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --ground: #11171b;
    --surface: #192126;
    --surface-2: #202a30;
    --ink: #e7edea;
    --ink-2: #a9b9c0;
    --ink-3: #7c8d95;
    --line: #2a363d;
    --accent: #46b39c;
    --accent-soft: #16302c;
    --flag: #f08a5d;
    --flag-soft: #33201a;
    --maybe: #d6b64a;
    --maybe-soft: #2e2916;
    --shadow: 0 1px 2px rgba(0, 0, 0, .3), 0 8px 24px rgba(0, 0, 0, .25);
  }
}

:root[data-theme="dark"] {
  --ground: #11171b;
  --surface: #192126;
  --surface-2: #202a30;
  --ink: #e7edea;
  --ink-2: #a9b9c0;
  --ink-3: #7c8d95;
  --line: #2a363d;
  --accent: #46b39c;
  --accent-soft: #16302c;
  --flag: #f08a5d;
  --flag-soft: #33201a;
  --maybe: #d6b64a;
  --maybe-soft: #2e2916;
  --shadow: 0 1px 2px rgba(0, 0, 0, .3), 0 8px 24px rgba(0, 0, 0, .25);
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--ground);
  color: var(--ink);
  font-family: var(--font-zh);
  font-size: var(--step-0);
  line-height: 1.55;
  padding-bottom: 5.5rem;
}

.wrap { max-width: 46rem; margin: 0 auto; padding: 0 .875rem; }

/* ---------- 头部 ---------- */

.masthead {
  padding: 1.75rem 0 1rem;
  display: flex;
  flex-direction: column;
  gap: .375rem;
}

.masthead h1 {
  margin: 0;
  font-size: var(--step-3);
  font-weight: 650;
  letter-spacing: -.01em;
  text-wrap: balance;
}

.masthead p { margin: 0; color: var(--ink-2); font-size: var(--step--1); }

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: .5rem;
  margin-top: .5rem;
  font-size: var(--step--1);
  color: var(--ink-2);
}

.legend span {
  display: inline-flex;
  align-items: center;
  gap: .3rem;
  padding: .1rem .5rem;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface);
}

.dot { width: .5rem; height: .5rem; border-radius: 50%; }
.dot.f { background: var(--flag); }
.dot.m { background: var(--maybe); }

/* ---------- 控制条 ---------- */

.controls {
  position: sticky;
  top: 0;
  z-index: 20;
  background: var(--ground);
  border-bottom: 1px solid var(--line);
  padding: .625rem 0 .75rem;
}

.tabs { display: flex; gap: .375rem; margin-bottom: .5rem; }

.tabs button {
  flex: 1;
  padding: .5rem .25rem;
  font: inherit;
  font-size: var(--step--1);
  color: var(--ink-2);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: .5rem;
  cursor: pointer;
}

.tabs button[aria-selected="true"] {
  color: var(--accent);
  background: var(--accent-soft);
  border-color: var(--accent);
  font-weight: 600;
}

.filters { display: flex; gap: .375rem; align-items: stretch; }

.filters input[type="search"],
.filters select {
  font: inherit;
  font-size: var(--step-0);
  color: var(--ink);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: .5rem;
  padding: .5rem .625rem;
  min-width: 0;
}

.filters input[type="search"] { flex: 1; }
.filters select { max-width: 8.5rem; }

.toggle {
  display: inline-flex;
  align-items: center;
  gap: .375rem;
  padding: .5rem .625rem;
  font-size: var(--step--1);
  white-space: nowrap;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: .5rem;
  cursor: pointer;
}

.toggle input { accent-color: var(--accent); margin: 0; }

.tally {
  margin-top: .5rem;
  font-size: var(--step--1);
  color: var(--ink-3);
  font-variant-numeric: tabular-nums;
}

/* ---------- 分节 ---------- */

.pack { margin-top: 1.25rem; }

.pack-head {
  display: flex;
  align-items: baseline;
  gap: .5rem;
  padding: 0 .125rem .5rem;
}

.pack-no {
  font-variant-numeric: tabular-nums;
  font-size: var(--step--1);
  font-weight: 700;
  color: var(--accent);
  min-width: 1.75rem;
}

.pack-title { font-size: var(--step-1); font-weight: 650; }
.pack-sub { font-size: var(--step--1); color: var(--ink-3); }

.rows {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: .75rem;
  box-shadow: var(--shadow);
  overflow: hidden;
}

.row { border-top: 1px solid var(--line); }
.row:first-child { border-top: none; }
.row[data-state="flag"] { background: var(--flag-soft); }
.row[data-state="maybe"] { background: var(--maybe-soft); }

.row-main {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: .25rem .5rem;
  padding: .75rem .875rem;
  cursor: pointer;
}

.term {
  font-family: var(--font-id);
  font-size: var(--step-2);
  font-weight: 600;
  letter-spacing: -.005em;
}

.gloss { color: var(--ink-2); font-size: var(--step--1); }

.gloss .pos {
  display: inline-block;
  margin-right: .375rem;
  padding: 0 .375rem;
  font-size: .75rem;
  color: var(--accent);
  background: var(--accent-soft);
  border-radius: .25rem;
}

.sent {
  grid-column: 1 / -1;
  margin-top: .25rem;
  padding-top: .375rem;
  border-top: 1px dashed var(--line);
}

.sent .id { font-family: var(--font-id); font-size: var(--step-0); }
.sent .zh { color: var(--ink-3); font-size: var(--step--1); }

.mark {
  grid-row: 1 / 3;
  grid-column: 2;
  align-self: start;
  width: 2rem;
  height: 2rem;
  display: grid;
  place-items: center;
  font-size: 1rem;
  color: var(--ink-3);
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: 999px;
  cursor: pointer;
}

.row[data-state="flag"] .mark {
  color: var(--flag);
  border-color: var(--flag);
  background: var(--surface);
}

.row[data-state="maybe"] .mark {
  color: var(--maybe);
  border-color: var(--maybe);
  background: var(--surface);
}

.note { padding: 0 .875rem .75rem; }

.note textarea {
  width: 100%;
  min-height: 3.25rem;
  font: inherit;
  font-size: var(--step--1);
  color: var(--ink);
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: .5rem;
  padding: .5rem .625rem;
  resize: vertical;
}

.note textarea::placeholder { color: var(--ink-3); }

/* ---------- 对话 ---------- */

.line-who {
  display: inline-grid;
  place-items: center;
  width: 1.25rem;
  height: 1.25rem;
  margin-right: .375rem;
  font-size: .7rem;
  font-weight: 700;
  color: var(--accent);
  background: var(--accent-soft);
  border-radius: 50%;
  vertical-align: .05em;
}

/* ---------- 底栏 ---------- */

.footbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 30;
  background: var(--surface);
  border-top: 1px solid var(--line);
  box-shadow: 0 -4px 20px rgba(22, 32, 43, .07);
  transform: translateY(105%);
  transition: transform .22s ease;
}

.footbar.on { transform: none; }

@media (prefers-reduced-motion: reduce) {
  .footbar { transition: none; }
}

.footbar-in {
  max-width: 46rem;
  margin: 0 auto;
  padding: .75rem .875rem calc(.75rem + env(safe-area-inset-bottom));
  display: flex;
  align-items: center;
  gap: .625rem;
}

.footbar .count {
  flex: 1;
  min-width: 0;
  font-size: .75rem;
  line-height: 1.3;
  color: var(--ink-2);
  font-variant-numeric: tabular-nums;
}

.footbar .count b { display: block; color: var(--ink); font-size: var(--step-0); }

.footbar button {
  font: inherit;
  font-size: var(--step-0);
  padding: .5rem .875rem;
  border-radius: .5rem;
  border: 1px solid var(--line);
  background: var(--surface-2);
  color: var(--ink);
  cursor: pointer;
}

.footbar button.primary {
  color: #fff;
  background: var(--accent);
  border-color: var(--accent);
  font-weight: 600;
}

:root[data-theme="dark"] .footbar button.primary,
:root:not([data-theme="light"]) .footbar button.primary { color: #08211d; }

@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]) .footbar button.primary { color: #fff; }
}

.empty { padding: 3rem 1rem; text-align: center; color: var(--ink-3); }

:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

.sheet { display: none; }
.sheet.on { display: block; }
</style>

<div class="wrap">
  <header class="masthead">
    <h1>印尼语词库审校</h1>
    <p>点右侧圆圈标记：一次「要改」，两次「不确定」，三次取消。标记后可写修改建议。全部存在这台手机上，改完点底部「复制问题清单」发回来即可。</p>
    <div class="legend">
      <span><i class="dot f"></i>要改</span>
      <span><i class="dot m"></i>不确定</span>
      <span>共 <b id="total-words"></b> 词条 · <b id="total-lines"></b> 对话行</span>
    </div>
  </header>

  <div class="controls">
    <div class="tabs" role="tablist">
      <button role="tab" data-sheet="words" aria-selected="true">词条</button>
      <button role="tab" data-sheet="dialogs" aria-selected="false">对话</button>
      <button role="tab" data-sheet="extras" aria-selected="false">关键句与生词</button>
    </div>
    <div class="filters">
      <input type="search" id="q" placeholder="搜印尼语或中文…" autocomplete="off">
      <select id="theme-filter"><option value="">全部主题</option></select>
      <label class="toggle"><input type="checkbox" id="only-marked">只看已标</label>
    </div>
    <div class="tally" id="tally"></div>
  </div>

  <main>
    <section class="sheet on" id="sheet-words"></section>
    <section class="sheet" id="sheet-dialogs"></section>
    <section class="sheet" id="sheet-extras"></section>
  </main>
</div>

<div class="footbar" id="footbar">
  <div class="footbar-in">
    <span class="count" id="foot-count"></span>
    <button type="button" id="clear">清空标记</button>
    <button type="button" class="primary" id="copy">复制问题清单</button>
  </div>
</div>

<script>
const DATA = ${JSON.stringify(DATA)};
const KEY = 'indo-review-marks';
const STATES = ['none', 'flag', 'maybe'];
const LABEL = { flag: '要改', maybe: '不确定' };

let marks = {};
try { marks = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { marks = {}; }

const save = () => localStorage.setItem(KEY, JSON.stringify(marks));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- 建表 ---------- */

function wordRow(id, w) {
  const [term, pos, zh, ex, exz] = w;
  return \`<article class="row" data-id="\${id}" data-text="\${esc((term + ' ' + zh + ' ' + ex + ' ' + exz).toLowerCase())}">
    <div class="row-main">
      <div>
        <div class="term">\${esc(term)}</div>
        <div class="gloss"><span class="pos">\${esc(pos)}</span>\${esc(zh)}</div>
      </div>
      <button class="mark" type="button" aria-label="标记"></button>
      <div class="sent">
        <div class="id">\${esc(ex)}</div>
        <div class="zh">\${esc(exz)}</div>
      </div>
    </div>
    <div class="note" hidden><textarea placeholder="写下正确说法或问题所在…"></textarea></div>
  </article>\`;
}

function lineRow(id, who, idText, zh) {
  return \`<article class="row" data-id="\${id}" data-text="\${esc((idText + ' ' + zh).toLowerCase())}">
    <div class="row-main">
      <div>
        <div class="term"><span class="line-who">\${esc(who)}</span>\${esc(idText)}</div>
        <div class="gloss">\${esc(zh)}</div>
      </div>
      <button class="mark" type="button" aria-label="标记"></button>
    </div>
    <div class="note" hidden><textarea placeholder="写下正确说法或问题所在…"></textarea></div>
  </article>\`;
}

function buildWords() {
  return DATA.packs.map((p) => \`
    <section class="pack" data-theme="\${esc(p.t)}">
      <div class="pack-head">
        <span class="pack-no">\${p.s}</span>
        <span class="pack-title">\${esc(p.t)}</span>
        <span class="pack-sub">\${esc(p.u)}</span>
      </div>
      <div class="rows">\${p.w.map((w, i) => wordRow('w:' + p.s + ':' + (i + 1), w)).join('')}</div>
    </section>\`).join('');
}

function buildDialogs() {
  return DATA.dialogs.map((d) => \`
    <section class="pack" data-theme="\${esc(d.z)}">
      <div class="pack-head">
        <span class="pack-title">\${esc(d.z)}</span>
        <span class="pack-sub">\${esc(d.i)}</span>
      </div>
      <div class="rows">\${d.l.map((l, i) =>
        lineRow('d:' + d.z + ':' + (i + 1), l[0], l[1], l[2])).join('')}</div>
    </section>\`).join('');
}

function buildExtras() {
  return DATA.dialogs.map((d) => \`
    <section class="pack" data-theme="\${esc(d.z)}">
      <div class="pack-head">
        <span class="pack-title">\${esc(d.z)}</span>
        <span class="pack-sub">关键句 \${d.k.length} · 生词 \${d.v.length}</span>
      </div>
      <div class="rows">
        \${d.k.map((k, i) => wordRow('k:' + d.z + ':' + (i + 1),
            [k[0], '关键句', k[1], '', ''])).join('')}
        \${d.v.map((v, i) => wordRow('v:' + d.z + ':' + (i + 1),
            [v[0], '生词', v[1], '', ''])).join('')}
      </div>
    </section>\`).join('');
}

document.getElementById('sheet-words').innerHTML = buildWords();
document.getElementById('sheet-dialogs').innerHTML = buildDialogs();
document.getElementById('sheet-extras').innerHTML = buildExtras();

// 没有例句的行（关键句/生词）把空的例句块去掉
document.querySelectorAll('.sent').forEach((s) => {
  if (!s.textContent.trim()) s.remove();
});

document.getElementById('total-words').textContent =
  DATA.packs.reduce((n, p) => n + p.w.length, 0);
document.getElementById('total-lines').textContent =
  DATA.dialogs.reduce((n, d) => n + d.l.length, 0);

/* ---------- 主题筛选项 ---------- */

const sel = document.getElementById('theme-filter');
[...new Set(DATA.packs.map((p) => p.t))].forEach((t) => {
  const o = document.createElement('option');
  o.value = t;
  o.textContent = t;
  sel.append(o);
});

/* ---------- 状态还原 ---------- */

function applyMark(row) {
  const m = marks[row.dataset.id];
  const state = m ? m.s : 'none';
  row.dataset.state = state;
  const note = row.querySelector('.note');
  note.hidden = state === 'none';
  const ta = note.querySelector('textarea');
  if (m && m.n != null && ta.value !== m.n) ta.value = m.n;
  row.querySelector('.mark').textContent =
    state === 'flag' ? '✕' : state === 'maybe' ? '?' : '○';
}

document.querySelectorAll('.row').forEach(applyMark);

/* ---------- 交互 ---------- */

document.addEventListener('click', (e) => {
  const row = e.target.closest('.row');
  if (!row || e.target.closest('.note')) return;
  const id = row.dataset.id;
  const cur = marks[id] ? marks[id].s : 'none';
  const next = STATES[(STATES.indexOf(cur) + 1) % STATES.length];
  if (next === 'none') delete marks[id];
  else marks[id] = { s: next, n: marks[id] ? marks[id].n : '' };
  save();
  applyMark(row);
  refresh();
});

document.addEventListener('input', (e) => {
  if (!e.target.matches('.note textarea')) return;
  const id = e.target.closest('.row').dataset.id;
  if (marks[id]) { marks[id].n = e.target.value; save(); }
});

document.querySelectorAll('[data-sheet]').forEach((b) => {
  b.addEventListener('click', () => {
    document.querySelectorAll('[data-sheet]').forEach((x) =>
      x.setAttribute('aria-selected', String(x === b)));
    document.querySelectorAll('.sheet').forEach((s) =>
      s.classList.toggle('on', s.id === 'sheet-' + b.dataset.sheet));
    refresh();
  });
});

['q', 'theme-filter', 'only-marked'].forEach((id) =>
  document.getElementById(id).addEventListener('input', refresh));

/* ---------- 筛选与计数 ---------- */

function refresh() {
  const q = document.getElementById('q').value.trim().toLowerCase();
  const theme = document.getElementById('theme-filter').value;
  const onlyMarked = document.getElementById('only-marked').checked;
  const sheet = document.querySelector('.sheet.on');

  let shown = 0;
  sheet.querySelectorAll('.pack').forEach((pack) => {
    let any = 0;
    pack.querySelectorAll('.row').forEach((row) => {
      const okQ = !q || row.dataset.text.includes(q);
      const okT = !theme || pack.dataset.theme === theme;
      const okM = !onlyMarked || Boolean(marks[row.dataset.id]);
      const ok = okQ && okT && okM;
      row.hidden = !ok;
      if (ok) any++;
    });
    pack.hidden = any === 0;
    shown += any;
  });

  let old = sheet.querySelector('.empty');
  if (old) old.remove();
  if (shown === 0) {
    sheet.insertAdjacentHTML('beforeend', '<p class="empty">没有符合条件的条目</p>');
  }

  const n = Object.keys(marks).length;
  const nf = Object.values(marks).filter((m) => m.s === 'flag').length;
  document.getElementById('tally').textContent =
    '显示 ' + shown + ' 条' + (n ? ' · 已标记 ' + n + ' 条（要改 ' + nf + '）' : '');
  document.getElementById('foot-count').innerHTML =
    '<b>已标记 ' + n + ' 条</b>要改 ' + nf + ' · 不确定 ' + (n - nf);
  document.getElementById('footbar').classList.toggle('on', n > 0);
}

refresh();

/* ---------- 导出 ---------- */

function report() {
  const lines = ['印尼语词库审校 · 问题清单', ''];
  const byRow = new Map();
  document.querySelectorAll('.row').forEach((r) => byRow.set(r.dataset.id, r));

  Object.entries(marks).forEach(([id, m]) => {
    const row = byRow.get(id);
    if (!row) return;
    const pack = row.closest('.pack');
    const where = pack.querySelector('.pack-title').textContent +
      ' / ' + pack.querySelector('.pack-sub').textContent;
    const term = row.querySelector('.term').textContent.trim();
    const gloss = row.querySelector('.gloss').textContent.trim();
    lines.push('[' + LABEL[m.s] + '] ' + where + ' | ' + term + ' — ' + gloss +
      (m.n ? '\\n    建议：' + m.n : ''));
  });
  return lines.join('\\n');
}

document.getElementById('copy').addEventListener('click', async (e) => {
  const text = report();
  try {
    await navigator.clipboard.writeText(text);
    e.target.textContent = '已复制';
  } catch (err) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.append(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    e.target.textContent = '已复制';
  }
  setTimeout(() => { e.target.textContent = '复制问题清单'; }, 1600);
});

document.getElementById('clear').addEventListener('click', () => {
  if (!confirm('清空全部标记？此操作无法撤销。')) return;
  marks = {};
  save();
  document.querySelectorAll('.row').forEach(applyMark);
  refresh();
});
</script>
`;

writeFileSync(out, html);
console.log(`已生成 ${out}（${(html.length / 1024).toFixed(0)} KB）`);
