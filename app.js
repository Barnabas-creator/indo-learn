import { renderHome } from './lib/views/home.js';
import {
  renderLevels, renderPackGrid, renderPack, renderCongrats,
} from './lib/views/packs.js';
import { renderDialogList, renderDialog } from './lib/views/dialogs.js';
import { renderGrammarList, renderGrammarModule } from './lib/views/grammar.js';
import { renderUnlock } from './lib/views/unlock.js';
import { LEVELS, UPPER } from './lib/catalog.js';

export function start(root, provider, tts) {
  // 导航状态。view 决定当前层，其余字段是该层参数。全程不落盘。
  let view = 'home';
  let level = null; // 'beginner' | 'intermediate' | 'advanced'
  let packIndex = 0; // 包在该级序列中的位置
  let detailId = null; // 对话/语法的详情 id
  let beginnerPacks = null; // 初级词条，解锁后缓存在内存

  function showUnlock(error = '', busy = false) {
    renderUnlock(root, {
      error,
      busy,
      onSubmit: async (password) => {
        showUnlock('', true);
        try {
          await provider.unlock(password);
          beginnerPacks = await provider.getPacks();
          render();
        } catch (err) {
          showUnlock(err.message);
        }
      },
    });
  }

  // 某一级的包序列：初级用真实词条，中高级用骨架
  function packsOfLevel(id) {
    if (id === 'beginner') return beginnerPacks;
    return UPPER[id].map((x) => ({ title: x.t, subtitle: x.u, words: [] }));
  }

  function levelCounts() {
    return {
      beginner: beginnerPacks ? beginnerPacks.length : 0,
      intermediate: UPPER.intermediate.length,
      advanced: UPPER.advanced.length,
    };
  }

  // 内容是异步取的，取不到就给一句错误 + 回首页，别留白屏。
  function guard(promise, fn) {
    return promise.then(fn).catch((err) => {
      root.innerHTML = `<div class="stack"><div class="crumb"><button class="back">← 返回</button></div>`
        + `<p class="error">内容加载失败：${err.message || '请检查网络后重试'}</p></div>`;
      root.querySelector('.back').addEventListener('click', () => { view = 'home'; render(); });
    });
  }

  function mount(fn) {
    const main = document.createElement('div');
    root.innerHTML = '';
    root.append(main);
    fn(main);
  }

  function render() {
    if (view === 'home') {
      return mount((m) =>
        renderHome(m, {
          open: (id) => {
            if (id === 'packs') view = 'levels';
            else if (id === 'dialogs') view = 'dialogList';
            else view = 'grammarList';
            render();
          },
        }),
      );
    }

    if (view === 'levels') {
      return mount((m) =>
        renderLevels(m, {
          levels: LEVELS,
          counts: levelCounts(),
          back: () => { view = 'home'; render(); },
          open: (id) => { level = id; view = 'grid'; render(); },
        }),
      );
    }

    if (view === 'grid') {
      const meta = LEVELS.find((l) => l.id === level);
      return mount((m) =>
        renderPackGrid(m, {
          levelTitle: meta.title,
          packs: packsOfLevel(level),
          ready: meta.ready,
          back: () => { view = 'levels'; render(); },
          open: (i) => { packIndex = i; view = 'cards'; render(); },
        }),
      );
    }

    if (view === 'cards') {
      const packs = packsOfLevel(level);
      return mount((m) =>
        renderPack(m, {
          pack: packs[packIndex],
          tts,
          back: () => { view = 'grid'; render(); },
          onComplete: () => { view = 'congrats'; render(); },
        }),
      );
    }

    if (view === 'congrats') {
      const packs = packsOfLevel(level);
      const isLast = packIndex >= packs.length - 1;
      const order = ['beginner', 'intermediate', 'advanced'];
      const nextLevel = order[order.indexOf(level) + 1];
      const nextLabel = isLast
        ? (nextLevel ? '进入' + LEVELS.find((l) => l.id === nextLevel).title : '回到分级')
        : '下一包';
      return mount((m) =>
        renderCongrats(m, {
          pack: packs[packIndex],
          nextLabel,
          back: () => { view = 'grid'; render(); },
          next: () => {
            if (!isLast) { packIndex += 1; view = 'cards'; }
            else if (nextLevel) { level = nextLevel; view = 'grid'; }
            else { view = 'levels'; }
            render();
          },
        }),
      );
    }

    if (view === 'dialogList') {
      return guard(provider.getDialogs(), (dialogs) =>
        mount((m) =>
          renderDialogList(m, dialogs, {
            back: () => { view = 'home'; render(); },
            open: (id) => { detailId = id; view = 'dialogDetail'; render(); },
          }),
        ),
      );
    }

    if (view === 'dialogDetail') {
      return guard(provider.getDialogs(), (dialogs) =>
        mount((m) =>
          renderDialog(m, dialogs.find((d) => d.id === detailId), {
            tts,
            back: () => { view = 'dialogList'; render(); },
          }),
        ),
      );
    }

    if (view === 'grammarList') {
      return guard(provider.getGrammar(), (grammar) =>
        mount((m) =>
          renderGrammarList(m, grammar, {
            back: () => { view = 'home'; render(); },
            open: (id) => { detailId = id; view = 'grammarModule'; render(); },
          }),
        ),
      );
    }

    if (view === 'grammarModule') {
      return guard(provider.getGrammar(), (grammar) =>
        mount((m) =>
          renderGrammarModule(m, grammar.find((g) => g.id === detailId), {
            tts,
            back: () => { view = 'grammarList'; render(); },
          }),
        ),
      );
    }
  }

  (async () => {
    try {
      const { unlocked } = await provider.init();
      if (!unlocked) return showUnlock();
      try {
        beginnerPacks = await provider.getPacks();
      } catch {
        // 存下来的凭据能解开这一版内容，是没法只靠版本号断定的：
        // 解不开就丢掉凭据回解锁页，别把用户堵在死页面上。
        provider.lock();
        return showUnlock('内容已更新，请重新输入密码');
      }
      render();
    } catch (err) {
      root.innerHTML = `<p class="error">加载失败：${err.message || '内容读取出错'}</p>`;
    }
  })();
}
