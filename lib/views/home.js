// 首页：三张大卡片入口。逐级钻取导航的第一层。
export function renderHome(root, { open }) {
  const cards = [
    { id: 'packs', title: '单词包', sub: '按主题分级背单词', glyph: 'Aa' },
    { id: 'dialogs', title: '场景对话', sub: '真实情境整段对话', glyph: '“”' },
    { id: 'grammar', title: '语法', sub: '词缀与句子结构', glyph: 'me-' },
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
    </div>`;
  root.querySelectorAll('.home-card').forEach((el) =>
    el.addEventListener('click', () => open(el.dataset.id)),
  );
}
