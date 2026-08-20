import { renderHome } from './lib/views/home.js';
import {
  renderLevels, renderPackGrid, renderPack, renderCongrats,
} from './lib/views/packs.js';
import { renderDialogList, renderDialog } from './lib/views/dialogs.js';
import { renderGrammarList, renderGrammarModule } from './lib/views/grammar.js';
import { renderUnlock } from './lib/views/unlock.js';
import { renderLogin, renderRegister, renderCodeIssued, renderActivate, AUTH_ERRORS } from './lib/views/auth.js';
import { AUTH_MODE } from './lib/config.js';
import { LEVELS, PACKS } from './lib/catalog.js';

export function start(root, provider, tts) {
  // 导航状态。view 决定当前层，其余字段是该层参数。全程不落盘。
  let view = 'home';
  let level = null; // 'beginner' | 'intermediate' | 'advanced'
  let packId = null; // 当前打开的包 id
  let detailId = null; // 对话/语法的详情 id
  let wordsByPack = {}; // 解锁后的词条表 { 包id: [词条…] }，只在内存
  let sessionEmail = null; // 当前登录邮箱，用来校验暂存激活码是不是同一个账号的

  function showUnlock(error = '', busy = false) {
    renderUnlock(root, {
      error,
      busy,
      onSubmit: async (password) => {
        showUnlock('', true);
        try {
          await provider.unlock(password);
          wordsByPack = await provider.getPacks();
          render();
        } catch (err) {
          showUnlock(err.message);
        }
      },
    });
  }

  const msg = (err) => AUTH_ERRORS[err?.message] ?? AUTH_ERRORS.default;

  // 注册成功但自动登录失败时，激活码不能跟着丢：单独存一份，
  // 激活成功后才清掉，刷新页面/重开浏览器也能在激活页找回来。
  const PENDING_CODE_KEY = 'indo-learn-pending-code';
  const savePendingCode = (email, code) =>
    localStorage.setItem(PENDING_CODE_KEY, JSON.stringify({ email, code }));
  const readPendingCode = () => {
    try {
      return JSON.parse(localStorage.getItem(PENDING_CODE_KEY));
    } catch {
      return null;
    }
  };
  const clearPendingCode = () => localStorage.removeItem(PENDING_CODE_KEY);

  function showLogin(error = '', busy = false) {
    renderLogin(root, {
      error,
      busy,
      onSwitch: () => showRegister(),
      onSubmit: async (email, password) => {
        showLogin('', true);
        try {
          const { status } = await provider.login(email, password);
          sessionEmail = email;
          if (status === 'active') {
            wordsByPack = await provider.getPacks();
            render();
          } else {
            showActivate();
          }
        } catch (err) {
          showLogin(msg(err));
        }
      },
    });
  }

  function showRegister(error = '', busy = false) {
    renderRegister(root, {
      error,
      busy,
      onSwitch: () => showLogin(),
      onSubmit: async (email, password) => {
        showRegister('', true);
        try {
          const out = await provider.register(email, password);
          // 先把码亮出来、存到本地，再去登录：账号和码在服务端已经生成好了，
          // 后面 login() 哪怕失败也不能让用户连码都没看到就卡死。
          if (out.code) savePendingCode(email, out.code);
          const afterCodeSeen = async () => {
            try {
              await provider.login(email, password);
              sessionEmail = email;
              showActivate();
            } catch (err) {
              showLogin(msg(err));
            }
          };
          if (out.code) renderCodeIssued(root, { code: out.code, onNext: afterCodeSeen });
          else await afterCodeSeen();
        } catch (err) {
          showRegister(msg(err));
        }
      },
    });
  }

  function showActivate(error = '', busy = false, inputCode = null) {
    // 暂存码是跟邮箱绑定的：换了账号登录，不能把上一个账号的码带出来。
    let pending = readPendingCode();
    if (pending && pending.email !== sessionEmail) {
      clearPendingCode(); // 无主的暂存记录，顺手清掉
      pending = null;
    }
    // 用户刚手输的码优先级更高：失败重渲染不能把手输的值换回暂存码。
    const code = inputCode ?? pending?.code ?? '';
    renderActivate(root, {
      error,
      busy,
      code,
      onLogout: () => { clearPendingCode(); sessionEmail = null; provider.lock(); showLogin(); },
      onSubmit: async (typed) => {
        showActivate('', true, typed);
        try {
          await provider.activate(typed);
          clearPendingCode();
          wordsByPack = await provider.getPacks();
          render();
        } catch (err) {
          showActivate(msg(err), false, typed);
        }
      },
    });
  }

  // 骨架来自 catalog（明文，含尚未开放的包），词条来自加密包
  function packsOfLevel(id) {
    return PACKS[id].map((p) => ({ ...p, words: wordsByPack[p.id] ?? [] }));
  }

  // 已开放 = 有词条。「下一包」只在已开放的包之间走，跳过准备中的。
  function openPacksOfLevel(id) {
    return packsOfLevel(id).filter((p) => p.words.length);
  }

  function levelCounts() {
    return Object.fromEntries(
      LEVELS.map((l) => {
        const packs = packsOfLevel(l.id);
        return [
          l.id,
          { open: packs.filter((p) => p.words.length).length, total: packs.length },
        ];
      }),
    );
  }

  // 内容是异步取的，取不到就给一句错误 + 回首页，别留白屏。
  function guard(promise, fn) {
    return promise.then(fn).catch((err) => {
      root.innerHTML = '<div class="stack"><div class="crumb">'
        + '<button class="back">← 返回</button></div>'
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
      const packs = packsOfLevel(level);
      return mount((m) =>
        renderPackGrid(m, {
          levelTitle: meta.title,
          packs,
          back: () => { view = 'levels'; render(); },
          open: (i) => { packId = packs[i].id; view = 'cards'; render(); },
        }),
      );
    }

    if (view === 'cards') {
      const pack = packsOfLevel(level).find((p) => p.id === packId);
      return mount((m) =>
        renderPack(m, {
          pack,
          tts,
          back: () => { view = 'grid'; render(); },
          onComplete: () => { view = 'congrats'; render(); },
        }),
      );
    }

    if (view === 'congrats') {
      const opened = openPacksOfLevel(level);
      const at = opened.findIndex((p) => p.id === packId);
      const isLast = at >= opened.length - 1;
      const order = LEVELS.map((l) => l.id);
      const nextLevel = order[order.indexOf(level) + 1];
      const nextHasPacks = Boolean(nextLevel) && openPacksOfLevel(nextLevel).length > 0;
      const nextLabel = !isLast
        ? '下一包'
        : nextHasPacks
          ? '进入' + LEVELS.find((l) => l.id === nextLevel).title
          : '回到分级';
      return mount((m) =>
        renderCongrats(m, {
          pack: opened[at],
          nextLabel,
          back: () => { view = 'grid'; render(); },
          next: () => {
            if (!isLast) { packId = opened[at + 1].id; view = 'cards'; }
            else if (nextHasPacks) { level = nextLevel; view = 'grid'; }
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
      const { unlocked, status, email } = await provider.init();
      sessionEmail = email ?? null;
      if (!unlocked) {
        if (AUTH_MODE !== 'remote') return showUnlock();
        return status === 'pending' ? showActivate() : showLogin();
      }
      try {
        wordsByPack = await provider.getPacks();
      } catch {
        // 存下来的凭据能解开这一版内容，是没法只靠版本号断定的：
        // 解不开就丢掉凭据回解锁页，别把用户堵在死页面上。
        provider.lock();
        return AUTH_MODE === 'remote' ? showLogin() : showUnlock('内容已更新，请重新输入密码');
      }
      render();
    } catch (err) {
      root.innerHTML = `<p class="error">加载失败：${err.message || '内容读取出错'}</p>`;
    }
  })();
}
