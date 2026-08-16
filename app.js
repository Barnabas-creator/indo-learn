import { renderUnlock } from './lib/views/unlock.js';
import { renderPackList, renderPack } from './lib/views/packs.js';
import { renderDialogList, renderDialog } from './lib/views/dialogs.js';
import { renderGrammarList, renderGrammarModule } from './lib/views/grammar.js';

const TABS = [
  { id: 'packs', label: '单词包' },
  { id: 'dialogs', label: '场景对话' },
  { id: 'grammar', label: '语法' },
];

export function start(root, provider, tts) {
  let state = { tab: 'packs', detail: null };

  function showUnlock(error = '', busy = false) {
    renderUnlock(root, {
      error,
      busy,
      onSubmit: async (password) => {
        showUnlock('', true);
        try {
          await provider.unlock(password);
          renderApp();
        } catch (err) {
          showUnlock(err.message);
        }
      },
    });
  }

  function shell(main) {
    root.innerHTML = `
      <header class="topbar">
        <h1>印尼语学习</h1>
        ${tts.hasIndonesianVoice() ? '' : '<span class="tts-warn" title="未检测到印尼语音色，朗读可能不准">🔇 无印尼语音色</span>'}
      </header>
      <main id="main"></main>
      <nav class="tabbar">
        ${TABS.map(
          (t) =>
            `<button data-tab="${t.id}" class="${t.id === state.tab ? 'active' : ''}">${t.label}</button>`,
        ).join('')}
      </nav>`;
    root.querySelectorAll('[data-tab]').forEach((b) =>
      b.addEventListener('click', () => {
        tts.stop();
        state = { tab: b.dataset.tab, detail: null };
        renderApp();
      }),
    );
    root.querySelector('#main').append(main);
  }

  async function renderApp() {
    const main = document.createElement('div');
    shell(main);
    main.innerHTML = '<p class="loading">加载中…</p>';

    const open = (detail) => {
      state = { ...state, detail };
      renderApp();
    };
    const back = () => {
      state = { ...state, detail: null };
      renderApp();
    };

    try {
      if (state.tab === 'packs') {
        const packs = await provider.getPacks();
        if (state.detail) {
          renderPack(main, packs.find((p) => p.id === state.detail), { tts, back });
        } else {
          renderPackList(main, packs, { open });
        }
      } else if (state.tab === 'dialogs') {
        const dialogs = await provider.getDialogs();
        if (state.detail) {
          renderDialog(main, dialogs.find((d) => d.id === state.detail), { tts, back });
        } else {
          renderDialogList(main, dialogs, { open });
        }
      } else {
        const grammar = await provider.getGrammar();
        if (state.detail) {
          renderGrammarModule(main, grammar.find((g) => g.id === state.detail), { tts, back });
        } else {
          renderGrammarList(main, grammar, { open });
        }
      }
    } catch (err) {
      main.innerHTML = `<p class="error">加载失败：${err.message}</p>`;
    }
  }

  (async () => {
    try {
      const { unlocked } = await provider.init();
      if (unlocked) renderApp();
      else showUnlock();
    } catch (err) {
      root.innerHTML = `<p class="error">初始化失败：${err.message}</p>`;
    }
  })();
}
