// 首页：五张大卡片入口。逐级钻取导航的第一层。
// 底部显示版本号——用户截图报问题时，一眼就能看出他手机上跑的是哪一版
// （Service Worker 的缓存机制让「手机上还是旧代码」成了反复出现的问题）。
import { APP_VERSION } from '../version.js';

export function renderHome(root, { open }) {
  const cards = [
    { id: 'packs', title: '单词包', sub: '按主题分级背单词', glyph: 'Aa' },
    { id: 'grammar', title: '语法', sub: '词缀与句子结构', glyph: 'me-' },
    { id: 'dialogs', title: '场景对话', sub: '真实情境整段对话', glyph: '“”' },
    { id: 'course', title: '课程学习', sub: 'BIPA A1 官方教材', glyph: 'A1' },
    { id: 'roots', title: '词根背诵法', sub: '200 个原型词长出一片', glyph: 'akar' },
  ];
  root.innerHTML = `
    <div class="home">
      <div class="home-hero">
        <div class="hero-mark">Bahasa</div>
        <h1 class="hero-title">印尼语学习</h1>
        <p class="hero-sub">Belajar Bahasa Indonesia</p>
      </div>
      <div class="home-cards">
        ${cards
          .map(
            (c) => `
          <button class="home-card" data-id="${c.id}">
            <span class="home-glyph">${c.glyph}</span>
            <span class="home-card-body">
              <span class="home-card-title">${c.title}</span>
              <span class="home-card-sub">${c.sub}</span>
            </span>
            <span class="home-arrow">→</span>
          </button>`,
          )
          .join('')}
      </div>
      <p class="home-version">v${APP_VERSION}</p>
    </div>`;
  root.querySelectorAll('.home-card').forEach((el) =>
    el.addEventListener('click', () => open(el.dataset.id)),
  );
}
