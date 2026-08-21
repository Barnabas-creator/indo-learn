import { renderHome } from './lib/views/home.js';
import {
  renderLevels, renderPackGrid, renderPack, renderCongrats,
} from './lib/views/packs.js';
import { renderDialogList, renderDialog } from './lib/views/dialogs.js';
import { renderGrammarList, renderGrammarModule } from './lib/views/grammar.js';
import { renderUnlock } from './lib/views/unlock.js';
import {
  renderLogin, renderRegister, renderActivate, AUTH_ERRORS, escapeHtml,
} from './lib/views/auth.js';
import { AUTH_MODE, ADMIN_CONTACT } from './lib/config.js';
import { normalizeEmail, trialDaysLeft } from './lib/remote-provider.js';
import { LEVELS, PACKS } from './lib/catalog.js';

export function start(root, provider, tts) {
  // 导航状态。view 决定当前层，其余字段是该层参数。全程不落盘。
  let view = 'home';
  let level = null; // 'beginner' | 'intermediate' | 'advanced'
  let packId = null; // 当前打开的包 id
  let detailId = null; // 对话/语法的详情 id
  let wordsByPack = {}; // 解锁后的词条表 { 包id: [词条…] }，只在内存
  let sessionEmail = null; // 当前登录邮箱，用来校验暂存激活码是不是同一个账号的
  // 试用横幅要用：账号状态与试用到期时间。只有 status === 'trial' 且未过期才显示横幅，
  // 激活成功后 status 变 active，横幅自然消失（下一次 render 就不会再画它）。
  let accountStatus = null;
  let accountTrialEndsAt = null;

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

  // 试用模式下注册不再当场发码给用户（码攥在负责人手里），这套暂存机制原本是给
  // 「注册成功但自动登录失败」兜底用的，现在没有写入方了；留着读取/清除两个函数
  // 是为了兼容注册即送试用上线前，浏览器里可能还没清掉的旧暂存记录。
  const PENDING_CODE_KEY = 'indo-learn-pending-code';
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
          const { status, trialEndsAt } = await provider.login(email, password);
          sessionEmail = normalizeEmail(email);
          accountStatus = status;
          accountTrialEndsAt = trialEndsAt;
          if (status === 'active' || status === 'trial') {
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
          // 注册即送 7 天全量试用：服务端已经把账号建成 trial 状态，不用再等码、
          // 不用先经过「显示码/待发放提示 → 激活页」，登录一次直接进首页。
          // 激活码这时候攥在负责人手里，付费后从首页横幅的「输入激活码」入口进激活页再输。
          await provider.register(email, password);
          const { status, trialEndsAt } = await provider.login(email, password);
          sessionEmail = normalizeEmail(email);
          accountStatus = status;
          accountTrialEndsAt = trialEndsAt;
          if (status === 'active' || status === 'trial') {
            wordsByPack = await provider.getPacks();
            render();
          } else {
            // 兜底：万一服务端某天又开始产出非试用的 pending 账号，仍然走原来的激活页。
            showActivate();
          }
        } catch (err) {
          showRegister(msg(err));
        }
      },
    });
  }

  function showActivate(error = '', busy = false, inputCode = null, notice = '') {
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
      notice,
      adminContact: ADMIN_CONTACT,
      onLogout: () => { clearPendingCode(); sessionEmail = null; provider.lock(); showLogin(); },
      onSubmit: async (typed) => {
        showActivate('', true, typed);
        try {
          const { status, trialEndsAt } = await provider.activate(typed);
          accountStatus = status;
          accountTrialEndsAt = trialEndsAt;
          clearPendingCode();
          wordsByPack = await provider.getPacks();
          render();
        } catch (err) {
          showActivate(msg(err), false, typed);
        }
      },
      // 负责人可能在睡觉：作废旧码、申请新码重新推送。旧码（暂存的也好、手输的也好）
      // 作废后都不再有效，成功后清空暂存并把输入框留空，等用户拿到新码再手输。
      onRequestCode: async () => {
        showActivate('', true, code);
        try {
          await provider.requestCode();
          clearPendingCode();
          showActivate('', false, '', '已重新申请，请联系管理员获取新的激活码');
        } catch (err) {
          showActivate(msg(err), false, code);
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

  // 试用横幅：status === 'trial' 且未过期时，在 mount() 画的每个主界面顶部都带上。
  // 放在 mount() 里统一渲染是改动最小的做法——只有登录/注册/激活三个视图不走 mount()，
  // 它们本来就不该出现横幅（还没登录，或正在输码）。
  function renderTrialBanner(container) {
    if (accountStatus !== 'trial') return;
    const days = trialDaysLeft(accountTrialEndsAt);
    if (days <= 0) return; // 本地算出来已经过期：下一次请求会被服务端拒绝并清会话，这里先不画横幅
    const banner = document.createElement('div');
    banner.className = 'trial-banner';
    banner.innerHTML = `
      <span class="trial-banner-text">试用中，还剩 ${days} 天 · 购买完整版请联系
        <a href="mailto:${escapeHtml(ADMIN_CONTACT)}">${escapeHtml(ADMIN_CONTACT)}</a></span>
      <button type="button" class="trial-banner-btn">输入激活码</button>`;
    banner.querySelector('.trial-banner-btn').addEventListener('click', () => showActivate());
    container.append(banner);
  }

  function mount(fn) {
    const main = document.createElement('div');
    root.innerHTML = '';
    renderTrialBanner(root);
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

  // 只有「确认解不开」或「服务器明确拒绝」才清凭据：
  // - content_decrypt_failed：真解不开这一版内容（provider.js/remote-provider.js 在
  //   decryptJson 失败时统一改抛这个），密钥/密码已经对不上了，留着会话没意义。
  // - '未解锁'：远程模式下 session 已经被清掉了（refreshKey 内部判定吊销/未激活时会
  //   clear()），说明服务器已经明确拒绝过一次。
  // 其余情况——fetch 失败（SW 缓存被回收、.enc 404、断网）、content_outdated（新版本
  // 内容已发布但暂时联不上网刷新密钥）——都是网络类问题，离线可用是核心设计，
  // 不能被一次瞬时失败就把用户踢回登录/解锁页。
  const FATAL_CONTENT_ERRORS = new Set(['content_decrypt_failed', '未解锁']);

  async function loadPacksAfterUnlock() {
    try {
      wordsByPack = await provider.getPacks();
      render();
    } catch (err) {
      if (FATAL_CONTENT_ERRORS.has(err?.message)) {
        // 走到这里时 session 多半已经被 refreshKey() 清掉了（见上面注释）；
        // 试用到期是其中一种具体原因，登录页要给专门文案，别的原因沿用旧提示。
        const reason = provider.lastRevokeReason ? provider.lastRevokeReason() : null;
        provider.lock();
        if (AUTH_MODE !== 'remote') return showUnlock('内容已更新，请重新输入密码');
        return showLogin(reason === 'trial_expired' ? AUTH_ERRORS.trial_expired : '');
      }
      showContentRetry();
    }
  }

  function showContentRetry() {
    root.innerHTML = '<div class="stack">'
      + '<p class="error">内容暂时读取失败，请检查网络后重试</p>'
      + '<button class="retry">重试</button></div>';
    root.querySelector('.retry').addEventListener('click', loadPacksAfterUnlock);
  }

  (async () => {
    try {
      const { unlocked, status, email, trialEndsAt } = await provider.init();
      sessionEmail = email ? normalizeEmail(email) : null; // provider 已归一化，这里再做一次保险，防旧会话数据是原样存的
      accountStatus = status;
      accountTrialEndsAt = trialEndsAt ?? null;
      if (!unlocked) {
        if (AUTH_MODE !== 'remote') return showUnlock();
        // 试用到期是本地时钟一到点就地清会话的（remote-provider.js 的 init() 里），
        // 也可能是刷新密钥时服务端刚拒绝的——两种情况 lastRevokeReason() 都会给出
        // 'trial_expired'，登录页要展示专门的文案，不能跟普通的「请重新登录」混在一起。
        const reason = provider.lastRevokeReason ? provider.lastRevokeReason() : null;
        if (reason === 'trial_expired') return showLogin(AUTH_ERRORS.trial_expired);
        return status === 'pending' ? showActivate() : showLogin();
      }
      await loadPacksAfterUnlock();
    } catch (err) {
      root.innerHTML = `<p class="error">加载失败：${err.message || '内容读取出错'}</p>`;
    }
  })();
}
