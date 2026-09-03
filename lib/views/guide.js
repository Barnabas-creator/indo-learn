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

// 学习路线。不是一条直线走到底，是一个转起来的圈：
//   单词包 → 语法 → 对话与听力 → 课程学习 → 回到单词包
// 单词是地基（要一直往里加），语法和课程是两翼，对话与听力是拿来检验的——
// 听得懂说得出，才算真学会了；发现漏了，再回去补词。
// 词根背诵法挂在圈外：它服务的是「正式场合要开口」这个需求，顺带帮着背词，
// 用不用都行，所以画成虚线、单独一格。
const CYCLE = [
  { name: '单词包', line: '地基。一包十个词，天天加一点，嘴里先有词。' },
  { name: '语法', line: '词怎么变、句子怎么排。有了词再看它，才看得进去。' },
  { name: '对话与听力', line: '拿来检验：听得懂吗、说得出吗。教材听力是官方真人录音。' },
  { name: '课程学习', line: 'BIPA 官方教材，一课一个话题，把散着的词和语法串成一条线。' },
];

// 后续计划。日期写死：这是「截至这一天的打算」，不是承诺——写上日期，
// 半年后回头看也知道这份计划有多旧。改计划时顺手把日期一起改。
const ROADMAP_DATE = '2026-08-29';

const ROADMAP = [
  '各个模块的内容会陆续补齐——教材听力先把 BIPA A1 剩下的单元做完，课程往 A2 走，单词包和语法也会继续加。',
  '新开一个栏目：口语表达技巧。讲怎么把学到的词和句子真的说出口——寒暄怎么起头、想不起词时怎么绕、语气怎么才不生硬。',
  '加论坛，大家互相交流心得。学语言最怕一个人闷头背，有人一起走能走得远一些。',
];

const OPTIONAL = {
  name: '词根背诵法',
  line: '选修。认得原型词，正式场合要用的那些长词就不慌了，顺带帮着背单词。',
};

// 环形图的几何参数。四个节点摆在同一个圆上（圆心 (160,160)），角度从正北
// 起顺时针、每 90° 一个节点。弧线也画在这同一个圆上——半径比节点框的外角还
// 远一点，绕在方框外侧，不会切进圆角矩形里。四条弧只是起始角依次 +90°，
// 半径、跨角完全一样，弧长自然一模一样。
//
// 旧版是四条手敲坐标的二次贝塞尔（M214 52q46 20 50 66 之类），起点、控制点、
// 长度各不相同，画出来弧长和箭头位置参差不齐——这就是「看着不齐」的根源。
// 半径 140、留白 30° 这两个数不是拍脑袋来的：四个节点框里最宽的是「对话与
// 听力」（134px），它的外角离圆心约 155px；把弧的半径定在 140、每条弧两端
// 都让开 30°，量出来对四个方框都留有余量，弧才不会贴着或切进方框。
const CYCLE_CENTER = { x: 160, y: 160 };
const CYCLE_ARC_RADIUS = 140;
const CYCLE_ARC_GAP_DEG = 30;

function polarPoint(angleDeg, radius = CYCLE_ARC_RADIUS, center = CYCLE_CENTER) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: +(center.x + radius * Math.sin(rad)).toFixed(1),
    y: +(center.y - radius * Math.cos(rad)).toFixed(1),
  };
}

// 四条弧的起止角：四个节点分别在 0°/90°/180°/270°（正北起顺时针），每条弧从
// 「离开当前节点」转到「进入下一节点」，两端各让开 CYCLE_ARC_GAP_DEG 度。
export function cycleArcAngles() {
  return [0, 90, 180, 270].map((base) => ({
    start: base + CYCLE_ARC_GAP_DEG,
    end: base + 90 - CYCLE_ARC_GAP_DEG,
  }));
}

function arcPath({ start, end }) {
  const p1 = polarPoint(start);
  const p2 = polarPoint(end);
  // 跨角小于 180°，大弧标志恒为 0；四个节点顺时针排列，sweep 标志恒为 1
  return `M${p1.x} ${p1.y} A${CYCLE_ARC_RADIUS} ${CYCLE_ARC_RADIUS} 0 0 1 ${p2.x} ${p2.y}`;
}

// 节点框宽度按标签字数走：原来写死 112，「单词包」「语法」「课程学习」
// （≤4 字）够用，但「对话与听力」（5 字）会顶到左边的序号圆圈上——所以只有
// 超过 4 字才加宽，短标签的宽度、位置跟改之前完全一样，不会被这次改动带偏。
function nodeWidth(label) {
  const extraChars = Math.max(0, [...label].length - 4);
  return 112 + extraChars * 18;
}

function node(x, y, label, n) {
  const w = nodeWidth(label);
  const half = w / 2;
  const circleCx = -half + 18; // 圆圈离方框左边缘固定 18px，跟原图一致
  const textCx = (circleCx + 11 + half) / 2; // 文字摆在「圆圈右边缘」和「方框右边缘」正中间——框越宽，文字右边的余量跟着越大
  return `
    <g transform="translate(${x} ${y})">
      <rect x="${-half}" y="-19" width="${w}" height="38" rx="19" fill="#fbf9f2" stroke="#2f5d4f" stroke-width="2.5"/>
      <circle cx="${circleCx}" cy="0" r="11" fill="#b4552d"/>
      <text x="${circleCx}" y="4" text-anchor="middle" font-size="12" fill="#fbf9f2">${n}</text>
      <text x="${textCx}" y="5" text-anchor="middle" font-size="14.5" fill="#16211d">${label}</text>
    </g>`;
}

// 环形图。四个模块摆成一圈，箭头顺时针转；词根背诵法在圈外，虚线牵回单词包。
// 用 SVG 而不是 CSS 排版，是因为要画的正是那几根箭头——CSS 画不出弧线箭头。
function cycleChart() {
  return `
    <svg class="cycle" viewBox="0 0 320 320" role="img"
         aria-label="学习顺序：单词包 → 语法 → 对话与听力 → 课程学习 → 回到单词包；词根背诵法为选修">
      <defs>
        <marker id="cyc" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0 0l10 5-10 5z" fill="#b4552d"/>
        </marker>
      </defs>
      <g fill="none" stroke="#b4552d" stroke-width="3" marker-end="url(#cyc)">
        ${cycleArcAngles().map((a) => `<path d="${arcPath(a)}"/>`).join('')}
      </g>
      ${node(160, 40, '单词包', 1)}
      ${node(258, 160, '语法', 2)}
      ${node(160, 280, '对话与听力', 3)}
      ${node(62, 160, '课程学习', 4)}
    </svg>`;
}

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
            不方便也没关系：七天试用够你把这几个模块都摸一遍，
            <b>试用到期之后也会留一些模块继续免费用</b>，不会让你一下子什么都看不了。</p>
        </section>

        <section class="guide-block">
          <h2><span class="guide-num">1</span>先「添加到主屏幕」再用</h2>
          <p>这是一个能装到桌面的网页应用。装上之后是独立一个图标，跟普通 App 一样，
            全屏、左滑返回这些才顺手——留在浏览器标签页里用，这些都是残的。</p>
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
          <p><b>单词是地基，要一直往里加</b>——学语言没有别的捷径，就是持续输入。
            旁边配上语法和课程，再用对话与听力回过头来检验：听得懂、说得出，才算学会了。</p>
          ${cycleChart()}
          <ol class="guide-path">
            ${CYCLE.map((c, i) => `
              <li class="guide-step">
                <span class="step-no">${i + 1}</span>
                <div class="step-body">
                  <b>${esc(c.name)}</b>
                  <span>${esc(c.line)}</span>
                </div>
              </li>`).join('')}
            <li class="guide-step optional">
              <span class="step-no opt">选</span>
              <div class="step-body">
                <b>${esc(OPTIONAL.name)}</b>
                <span>${esc(OPTIONAL.line)}</span>
              </div>
            </li>
          </ol>
          <p class="guide-note">转完一圈不是结束，是回到单词包接着加。真正管用的是
            <b>每天各来一点</b>：背一包词、看一课语法、听一段录音，然后<b>大声念出来</b>——
            嘴上不动，听懂了也说不出。语言是靠天天碰面记住的，不是靠哪一天猛攻。</p>
        </section>

        <section class="guide-block">
          <h2><span class="guide-num">4</span>后续计划</h2>
          <p class="roadmap-date">截至 ${ROADMAP_DATE}</p>
          <ol class="guide-roadmap">
            ${ROADMAP.map((r, i) => `
              <li><span class="road-no">${i + 1}</span><span>${esc(r)}</span></li>`).join('')}
          </ol>
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
