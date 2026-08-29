import { renderHome } from './lib/views/home.js';
import {
  renderLevels, renderPackGrid, renderPack, renderCongrats,
} from './lib/views/packs.js';
import { renderDialogList, renderDialog } from './lib/views/dialogs.js';
import { renderRootList, renderRootPack } from './lib/views/roots.js';
import { renderAudioCats, renderListenList, renderListen } from './lib/views/listening.js';
import { renderGrammarList, renderGrammarLessons, renderGrammarLesson } from './lib/views/grammar.js';
import { renderCourseUnits, renderCourseLessons, renderCourseLesson } from './lib/views/course.js';
import { renderUnlock } from './lib/views/unlock.js';
import { renderGuide, guideSeen, markGuideSeen } from './lib/views/guide.js';
import {
  renderLogin, renderRegister, renderActivate, renderCodeIssued, renderActivated,
  AUTH_ERRORS, escapeHtml,
} from './lib/views/auth.js';
import { AUTH_MODE, ADMIN_CONTACT } from './lib/config.js';
import { normalizeEmail, trialDaysLeft } from './lib/remote-provider.js';
import { LEVELS, PACKS } from './lib/catalog.js';
import { parentView } from './lib/nav.js';

export function start(root, provider, tts, { history: hist = globalThis.history, win = globalThis } = {}) {
  // 导航状态。view 决定当前层，其余字段是该层参数。全程不落盘。
  let view = 'home';
  let level = null; // 'beginner' | 'intermediate' | 'advanced'
  let packId = null; // 当前打开的包 id
  let detailId = null; // 对话/语法/课程单元的详情 id
  let lessonId = null; // 课程里当前打开的课 id
  let rootIndex = null; // 词根包在列表里的位置（词根包按顺序排，用下标定位就够）
  let wordsByPack = {}; // 解锁后的词条表 { 包id: [词条…] }，只在内存
  let sessionEmail = null; // 当前登录邮箱，用来校验暂存激活码是不是同一个账号的
  // 试用横幅要用：账号状态与试用到期时间。只有 status === 'trial' 且未过期才显示横幅，
  // 激活成功后 status 变 active，横幅自然消失（下一次 render 就不会再画它）。
  let accountStatus = null;
  let accountTrialEndsAt = null;
  // 当前是不是在主界面（mount() 画的那几层）。登录/注册/激活/鼓励页不算——
  // 那几页没有「上一层」，返回手势与桌面键都不该在上面生效。
  let inApp = false;
  // 音色列表到齐了没有。没到齐之前不能断言「这台手机没有印尼语音色」，
  // 否则安卓上会先闪一条错误的缺音色提示。
  let voicesReady = false;
  let voiceHintDismissed = false;
  // 手册开着的时候，底下的主界面照旧留在 DOM 里——关掉手册就回到原处，
  // 不用重画，也不会把用户翻到一半的位置弄丢。
  let guideOpen = false;
  tts.whenReady?.().then(() => { voicesReady = true; });

  // —— 导航：层深由 nav.js 的父子关系算出来，history 记录与层深一一对应 ——
  // 下钻 pushState，同层（词卡 → 恭喜页）replaceState，上行一律交给 history.go(-n)。
  // 这样系统返回键、安卓左边缘返回手势、页内返回按钮、桌面键走的是同一条路，
  // history 不会越点越深，也不会在 PWA 里一按返回就把应用关掉。
  const depthOf = (v) => { let d = 0; let cur = v; while ((cur = parentView(cur)) !== null) d += 1; return d; };

  function goTo(next) {
    const before = depthOf(view);
    const after = depthOf(next);
    view = next;
    if (after > before) hist?.pushState?.({ view: next }, '');
    else hist?.replaceState?.({ view: next }, '');
    render();
  }

  function goUp(next) {
    if (next === view) return;
    const delta = depthOf(view) - depthOf(next);
    tts.stop();
    if (delta > 0 && hist?.go) { hist.go(-delta); return; } // 落到 popstate 里统一改 view
    view = next;
    render();
  }

  const goBack = () => { const parent = parentView(view); if (parent) goUp(parent); };
  const goHome = () => goUp('home');

  // 返回手势完全交给 history/popstate，页面不再自己认「左边缘右滑」。
  //
  // 之前两条路并存：系统手势触发 popstate 退一级，页面上的 isBackSwipe 又认一次
  // 再退一级。iPhone 上尤其明显——两次 popstate 的先后顺序还不固定，表现成
  // 「先退到上一层，停一会儿又自己跳回首页」。
  //
  // 页面那条路本来只为「系统不吃这个手势」的场合兜底，但那种场合并不存在：
  // 安卓三键导航有返回键、浏览器标签页有返回按钮、每个界面顶栏还有「← 返回」。
  // 删掉它，一个手势就只退一级。
  win?.addEventListener?.('popstate', (e) => {
    if (!inApp) return; // 停在登录/激活页时不接管，让浏览器按自己的来
    view = e?.state?.view ?? 'home';
    tts.stop();
    render();
  });

  function showUnlock(error = '', busy = false) {
    inApp = false;
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
    inApp = false;
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
    inApp = false;
    renderRegister(root, {
      error,
      busy,
      onSwitch: () => showLogin(),
      onSubmit: async (email, password) => {
        showRegister('', true);
        try {
          // 注册即送 7 天全量试用：服务端已经把账号建成 trial 状态，不用再等码、
          // 不用先经过「待发放提示 → 激活页」，登录一次直接进首页。
          // 卖码模式（生产默认）响应里没有明文码：激活码攥在负责人手里，付费后
          // 从首页横幅的「输入激活码」入口进激活页再输，注册流程不用再提它。
          // 自动发码模式（AUTO_ISSUE_CODE=true，自己人用）响应里带明文码：
          // 让注册者当场复制保存，点「下一步」再进首页。
          const regRes = await provider.register(email, password);
          const { status, trialEndsAt } = await provider.login(email, password);
          sessionEmail = normalizeEmail(email);
          accountStatus = status;
          accountTrialEndsAt = trialEndsAt;
          if (status === 'active' || status === 'trial') {
            wordsByPack = await provider.getPacks();
            if (regRes && regRes.code) {
              inApp = false;
              renderCodeIssued(root, { code: regRes.code, onNext: () => { render(); openGuide(); } });
            } else {
              // 刚注册的人第一次进来，先把手册摊开——装桌面、装语音包、
              // 按什么顺序学，这三件事不说清楚，多半会以为软件坏了。
              render();
              openGuide();
            }
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
    inApp = false;
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
          // 激活成功不直接甩回首页：先给一页鼓励，点「开始学习」再进主界面。
          inApp = false;
          renderActivated(root, { onNext: () => render() });
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
    // no 是包在这一级里的序号（含准备中的包），跟网格上显示的编号一致，
    // 好让「背到第几包」在网格和词卡页上是同一个数。
    return PACKS[id].map((p, i) => ({
      ...p,
      no: String(i + 1).padStart(2, '0'),
      words: wordsByPack[p.id] ?? [],
    }));
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
      root.querySelector('.back').addEventListener('click', goHome);
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

  // 缺印尼语音色提示：安卓不装「Google 语音服务」的印尼语数据包时，点朗读是纯静音、
  // 不报错，用户只会以为软件坏了。等音色列表到齐后才敢下这个结论（voicesReady）。
  function renderVoiceHint(container) {
    if (voiceHintDismissed || !voicesReady) return;
    if (tts.hasIndonesianVoice?.() !== false) return;
    const hint = document.createElement('div');
    hint.className = 'voice-hint';
    // 分两种手机说。国行手机（小米、华为、OPPO、vivo、荣耀）多半没有 Google 套件，
    // 「去 Google 语音服务里下载语音数据」这条路对他们是走不通的，照着做只会更懵。
    hint.innerHTML = `
      <span class="voice-hint-text">这台手机没有印尼语语音，点朗读会没声音。</span>
      <details class="voice-hint-fix">
        <summary>手机有 Google 服务（国际版、三星等）</summary>
        <p>设置 → 通用管理 / 系统 → 文字转语音（TTS）→ 选「Google 语音服务」→
          安装语音数据 → 下载 <b>Bahasa Indonesia</b>。</p>
      </details>
      <details class="voice-hint-fix">
        <summary>国行手机（小米 / 华为 / OPPO / vivo / 荣耀）</summary>
        <p>国行系统自带的语音引擎基本只有中英文，没有印尼语，所以默认是不出声的。两条路：</p>
        <p><b>一、装 Google 的语音引擎。</b>应用商店一般搜不到，需要自己找
          「Google 文字转语音」（Speech Services by Google）的安装包装上，再到
          设置 → 辅助功能 / 无障碍 → 文字转语音 → 把引擎切成它 → 下载
          <b>Bahasa Indonesia</b>。华为部分机型装不上，属正常。</p>
        <p><b>二、不折腾，直接听真人录音。</b>首页「对话与听力 → 教材听力」是印尼官方
          教材的真人录音，不用手机语音也能听，发音比机器还准。</p>
      </details>
      <button type="button" class="voice-hint-close" aria-label="知道了">知道了</button>`;
    hint.querySelector('.voice-hint-close').addEventListener('click', () => {
      voiceHintDismissed = true;
      hint.remove();
    });
    container.append(hint);
  }

  // 桌面键：挂在顶部返回键的右边，跟着页面一起滚，不悬浮。
  // 原本是右下角的悬浮球，挡内容也不好够——手在屏幕上半部时要伸下去点。
  // 放在返回键旁边，「退一级」和「回首页」两个动作就在同一个位置上。
  // 首页本身不画（已经在首页了）。
  function renderHomeKey(container) {
    if (view === 'home') return;
    const bar = container.querySelector('.crumb, .card-head');
    if (!bar) return; // 视图没有顶栏（比如加载失败页），不硬塞
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'home-key';
    btn.setAttribute('aria-label', '回到首页');
    btn.innerHTML = '<span class="home-key-glyph">⌂</span><span class="home-key-text">首页</span>';
    btn.addEventListener('click', goHome);
    bar.append(btn);
  }

  // 手册铺在最上面一层，另挂一个容器，不动 root 里已经画好的界面。
  function openGuide() {
    if (guideOpen) return;
    guideOpen = true;
    const layer = document.createElement('div');
    layer.className = 'guide-layer';
    document.body.append(layer);
    renderGuide(layer, {
      onClose: () => {
        layer.remove();
        guideOpen = false;
        markGuideSeen(localStorage);
      },
    });
  }

  // 首页右下角的「?」。只在首页画：手册讲的是整个 App 怎么用，
  // 深层页面里挂个入口既挡内容也没必要。
  function renderGuideFab(container) {
    if (view !== 'home') return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'guide-fab';
    btn.setAttribute('aria-label', '使用手册');
    btn.textContent = '?';
    btn.addEventListener('click', openGuide);
    container.append(btn);
  }

  function mount(fn) {
    const main = document.createElement('div');
    root.innerHTML = '';
    inApp = true;
    renderTrialBanner(root);
    renderVoiceHint(root);
    root.append(main);
    fn(main);
    renderHomeKey(main);
    renderGuideFab(root);
    // 每进一层都回到最上面。不然新页面会继承上一页的滚动位置，
    // 一进去顶上就缺一块——看起来像是被什么遮住了。
    win?.scrollTo?.(0, 0);
    // 没看过手册的人，第一次进到主界面就摊开一次。放在 mount 里是因为进主界面
    // 有好几条路（注册、登录、输密码解锁、会话还在直接进），挨个去加必漏一条。
    // 弹过一次就记进 localStorage，之后只有点右下角的「?」才出现。
    if (!guideSeen(localStorage)) openGuide();
  }

  function render() {
    if (view === 'home') {
      return mount((m) =>
        renderHome(m, {
          open: (id) => {
            if (id === 'course') goTo('courseUnits');
            else if (id === 'packs') goTo('levels');
            else if (id === 'audio') goTo('audioCats');
            else if (id === 'roots') goTo('rootList');
            else goTo('grammarList');
          },
        }),
      );
    }

    if (view === 'levels') {
      return mount((m) =>
        renderLevels(m, {
          levels: LEVELS,
          counts: levelCounts(),
          back: goBack,
          open: (id) => { level = id; goTo('grid'); },
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
          back: goBack,
          open: (i) => { packId = packs[i].id; goTo('cards'); },
        }),
      );
    }

    if (view === 'cards') {
      const pack = packsOfLevel(level).find((p) => p.id === packId);
      return mount((m) =>
        renderPack(m, {
          pack,
          tts,
          back: goBack,
          onComplete: () => goTo('congrats'),
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
          // 恭喜页与词卡同层（都挂在包网格底下），返回一律回到包网格。
          back: () => goUp('grid'),
          next: () => {
            if (!isLast) { packId = opened[at + 1].id; goTo('cards'); }
            else if (nextHasPacks) { level = nextLevel; goUp('grid'); }
            else { goUp('levels'); }
          },
        }),
      );
    }

    if (view === 'audioCats') {
      // 两份内容都要数一下条数才画得出卡片上的「25 组 / 3 段」。
      return guard(
        Promise.all([provider.getDialogs(), provider.getListening()]),
        ([dialogs, listening]) =>
          mount((m) =>
            renderAudioCats(m, {
              counts: { dialogs: dialogs.length, listening: listening.length },
              back: goBack,
              open: (id) => goTo(id === 'dialogs' ? 'dialogList' : 'listenList'),
            }),
          ),
      );
    }

    if (view === 'listenList') {
      return guard(provider.getListening(), (items) =>
        mount((m) =>
          renderListenList(m, items, {
            back: goBack,
            open: (id) => { detailId = id; goTo('listenDetail'); },
          }),
        ),
      );
    }

    if (view === 'listenDetail') {
      return guard(provider.getListening(), (items) =>
        mount((m) =>
          renderListen(m, items.find((x) => x.id === detailId), { tts, back: goBack }),
        ),
      );
    }

    if (view === 'dialogList') {
      return guard(provider.getDialogs(), (dialogs) =>
        mount((m) =>
          renderDialogList(m, dialogs, {
            back: goBack,
            open: (id) => { detailId = id; goTo('dialogDetail'); },
          }),
        ),
      );
    }

    if (view === 'dialogDetail') {
      return guard(provider.getDialogs(), (dialogs) =>
        mount((m) =>
          renderDialog(m, dialogs.find((d) => d.id === detailId), {
            tts,
            back: goBack,
          }),
        ),
      );
    }

    if (view === 'rootList') {
      return guard(provider.getRoots(), (packs) =>
        mount((m) =>
          renderRootList(m, packs, {
            back: goBack,
            open: (i) => { rootIndex = i; goTo('rootCards'); },
          }),
        ),
      );
    }

    if (view === 'rootCards') {
      return guard(provider.getRoots(), (packs) =>
        mount((m) =>
          renderRootPack(m, {
            pack: packs[rootIndex],
            tts,
            back: goBack,
            onComplete: () => goTo('rootCongrats'),
          }),
        ),
      );
    }

    if (view === 'rootCongrats') {
      return guard(provider.getRoots(), (packs) => {
        // 词根包没有分级，一路顺着背下去，最后一包完了就回列表。
        const isLast = rootIndex >= packs.length - 1;
        return mount((m) =>
          renderCongrats(m, {
            pack: packs[rootIndex],
            nextLabel: isLast ? '回到列表' : '下一包',
            back: () => goUp('rootList'),
            next: () => {
              if (isLast) goUp('rootList');
              else { rootIndex += 1; goTo('rootCards'); }
            },
          }),
        );
      });
    }

    if (view === 'grammarList') {
      return guard(provider.getGrammar(), (grammar) =>
        mount((m) =>
          renderGrammarList(m, grammar, {
            back: goBack,
            open: (id) => { detailId = id; goTo('grammarModule'); },
          }),
        ),
      );
    }

    if (view === 'courseUnits') {
      return guard(provider.getCourse(), (units) =>
        mount((m) =>
          renderCourseUnits(m, units, {
            back: goBack,
            open: (id) => { detailId = id; goTo('courseLessons'); },
          }),
        ),
      );
    }

    if (view === 'courseLessons') {
      return guard(provider.getCourse(), (units) =>
        mount((m) =>
          renderCourseLessons(m, units.find((u) => u.id === detailId), {
            back: goBack,
            open: (id) => { lessonId = id; goTo('courseLesson'); },
          }),
        ),
      );
    }

    if (view === 'courseLesson') {
      return guard(provider.getCourse(), (units) =>
        mount((m) =>
          renderCourseLesson(
            m,
            units.find((u) => u.id === detailId).lessons.find((l) => l.id === lessonId),
            { tts, back: goBack },
          ),
        ),
      );
    }

    if (view === 'grammarModule') {
      return guard(provider.getGrammar(), (grammar) =>
        mount((m) =>
          renderGrammarLessons(m, grammar.find((g) => g.id === detailId), {
            back: goBack,
            open: (id) => { lessonId = id; goTo('grammarLesson'); },
          }),
        ),
      );
    }

    if (view === 'grammarLesson') {
      return guard(provider.getGrammar(), (grammar) => {
        const mod = grammar.find((g) => g.id === detailId);
        return mount((m) =>
          renderGrammarLesson(m, mod, mod.lessons.find((l) => l.id === lessonId), {
            tts,
            back: goBack,
          }),
        );
      });
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
    inApp = false;
    root.innerHTML = '<div class="stack">'
      + '<p class="error">内容暂时读取失败，请检查网络后重试</p>'
      + '<button class="retry">重试</button></div>';
    root.querySelector('.retry').addEventListener('click', loadPacksAfterUnlock);
  }

  (async () => {
    // 首页那条记录要带上 view，不然从深层 go(-n) 回来时 popstate 拿到的是 null state。
    hist?.replaceState?.({ view: 'home' }, '');
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
      inApp = false;
      root.innerHTML = `<p class="error">加载失败：${err.message || '内容读取出错'}</p>`;
    }
  })();
}
