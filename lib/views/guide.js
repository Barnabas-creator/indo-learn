// 使用手册。
//
// 新注册的人第一次进来自动弹一次，之后只有从首页右下角那个「?」点进来才出现。
// 弹过一次就记在 localStorage 里——每次进 App 都拦一道，比不说明还烦人。
//
// 里头讲三件事，都是用户不看说明就一定会踩的：
//   1. 装到桌面再用。左滑返回、全屏这些在浏览器标签页里是残的。
//   2. 安卓要装印尼语语音，国行手机还得绕一圈。
//   3. 五个模块各是干什么的，按什么顺序学。
// 前面再放一段作者自己的话——这软件是一个人用业余时间做的，说清楚了，
// 用户才知道那个「联系邮箱要激活码」是怎么回事。
import { ADMIN_CONTACT } from '../config.js';
import { APP_VERSION } from '../version.js';

export const GUIDE_SEEN_KEY = 'indo-learn-guide-seen';

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// 学习路线上的一站。step 决定圆圈里的序号，箭头由 CSS 画在两站之间。
const STEPS = [
  { id: 'packs', name: '单词包', line: '按主题背，一包十个词。先把嘴里有词。' },
  { id: 'roots', name: '词根背诵法', line: '认得原型词，一大片派生词就能猜出来。' },
  { id: 'grammar', name: '语法', line: '词缀怎么变词、句子怎么排。跟词根一起看最省力。' },
  { id: 'audio', name: '对话与听力', line: '先看得懂，再听得懂。教材听力是官方真人录音。' },
  { id: 'course', name: '课程学习', line: 'BIPA 官方教材，一课一个话题，成体系地走一遍。' },
];

export function renderGuide(root, { onClose }) {
  root.innerHTML = `
    <div class="guide">
      <div class="guide-sheet">
        <header class="guide-head">
          <h1>使用手册</h1>
          <button class="guide-close" aria-label="关闭">✕</button>
        </header>

        <section class="guide-hello">
          <p>谢谢你用这个 App。</p>
          <p>我自己也在学印尼语，做这个是因为找不到一个顺手的：单词、语法、对话、
            教材，各在各的地方。于是下班后一点点拼出了它。内容是一条一条对着教材
            核过来的，图是一张一张配的——没有团队，就我一个人。</p>
          <p>它现在能用，也会一直更新下去。<b>激活一次，往后所有更新都是你的</b>，
            不再收第二回。愿意帮着付点电费的，写信到
            <a href="mailto:${esc(ADMIN_CONTACT)}">${esc(ADMIN_CONTACT)}</a> 找我要激活码。
            不方便也没关系，七天试用够你把这几个模块都摸一遍。</p>
        </section>

        <section class="guide-block">
          <h2><span class="guide-num">1</span>先「添加到主屏幕」再用</h2>
          <p>这是一个能装到桌面的网页应用。装上之后是独立一个图标，跟普通 App 一样，
            全屏、离线也能背，左滑返回也才顺手——留在浏览器标签页里用，
            这些都是残的。</p>
          <div class="guide-how">
            <p><b>安卓 Chrome</b>：右上角 ⋮ → 添加到主屏幕。</p>
            <p><b>iPhone Safari</b>：底部分享 <span class="mono">⬆</span> → 添加到主屏幕。</p>
            <p><b>国内浏览器</b>（UC、QQ、夸克等）：菜单里找「添加到桌面」。找不到就换 Chrome 或 Edge。</p>
          </div>
        </section>

        <section class="guide-block">
          <h2><span class="guide-num">2</span>安卓要自己装印尼语语音</h2>
          <p>点朗读没声音不是坏了——是手机里没有印尼语的发音数据。iPhone 一般自带，
            安卓多半要装一次。装完一劳永逸。</p>
          <div class="guide-how">
            <p><b>手机有 Google 服务</b>（国际版、三星等）：设置 → 通用管理 / 系统 →
              文字转语音（TTS）→ 选「Google 语音服务」→ 安装语音数据 →
              下载 <b>Bahasa Indonesia</b>。</p>
            <p><b>国行手机</b>（小米 / 华为 / OPPO / vivo / 荣耀）：系统自带的语音引擎
              基本只有中英文，没有印尼语。两条路——</p>
            <p class="guide-sub">① 自己找「Google 文字转语音」（Speech Services by Google）的
              安装包装上，再到 设置 → 辅助功能 / 无障碍 → 文字转语音 → 把引擎切成它 →
              下载 Bahasa Indonesia。华为部分机型装不上，属正常。</p>
            <p class="guide-sub">② 不折腾：<b>「对话与听力 → 教材听力」是印尼官方教材的真人录音</b>，
              不用手机语音也能听，发音还比机器准。</p>
          </div>
        </section>

        <section class="guide-block">
          <h2><span class="guide-num">3</span>五个模块，这样学最省力</h2>
          <ol class="guide-path">
            ${STEPS.map((s, i) => `
              <li class="guide-step">
                <span class="step-no">${i + 1}</span>
                <div class="step-body">
                  <b>${esc(s.name)}</b>
                  <span>${esc(s.line)}</span>
                </div>
              </li>`).join('<li class="guide-arrow" aria-hidden="true">↓</li>')}
          </ol>
          <p class="guide-note">不必死守这个顺序。真正管用的是<b>每天各来一点</b>：
            背一包词、看一课语法、听一段录音。语言是靠天天碰面记住的，不是靠哪一天猛攻。</p>
        </section>

        <footer class="guide-foot">
          <button class="guide-start primary">开始学习 →</button>
          <p class="guide-version">v${APP_VERSION} · 随时可以从首页右下角的 <b>?</b> 再打开这一页</p>
        </footer>
      </div>
    </div>`;

  root.querySelector('.guide-close').addEventListener('click', onClose);
  root.querySelector('.guide-start').addEventListener('click', onClose);
}

// 这个人见没见过手册。读写都包在 try 里：隐私模式下 localStorage 会直接抛。
export function guideSeen(storage) {
  try {
    return storage.getItem(GUIDE_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function markGuideSeen(storage) {
  try {
    storage.setItem(GUIDE_SEEN_KEY, '1');
  } catch {
    // 存不下就算了：大不了下次再弹一遍，比整个页面崩掉强
  }
}
