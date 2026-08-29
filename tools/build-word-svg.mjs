// 给没有现成 OpenMoji 图形的词画配图。
//
// 为什么要自己画：OpenMoji 覆盖的是「有实物的东西」。介词、连接词、程度副词
// 这些没有实物，硬套一个别的图案只会误导；印尼特有的东西（榴莲、天贝、
// 巨港鱼饼）OpenMoji 干脆就没有，拿奇异果当榴莲比不配图还糟。
//
// 画法上跟 assets/grammar-svg/book/ 那四张一致：200×200 画布，透明底，
// 苔绿／丁香棕／金三色，线条粗、形状少——词卡上这张图只有 92px 见方，
// 细节多了就是一团糊。
//
// 每张图都要能一眼说出那个词的意思，说不出就别画（宁可退回主题兜底）。
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const MOSS = '#2f5d4f';
const CLOVE = '#b4552d';
const GOLD = '#c9a227';
const PAPER = '#fbf9f2';
const FADE = '#c9c4b4';

const wrap = (label, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" role="img" aria-label="${label}">\n${body}\n</svg>\n`;

// —— 复用零件 ——
// 人：词卡上要一眼认出是「人」，所以头大身圆，不画四肢。
const person = (x, y, s, fill, op = 1) =>
  `<g fill="${fill}" opacity="${op}" transform="translate(${x} ${y}) scale(${s})">`
  + `<circle cx="0" cy="-18" r="13"/>`
  + `<path d="M-18 22a18 20 0 0 1 36 0z"/></g>`;

const arrow = (d, color = CLOVE, w = 9) =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#tip)"/>`;

const defsArrow = (color = CLOVE) =>
  `<defs><marker id="tip" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto">`
  + `<path d="M0 0l10 5-10 5z" fill="${color}"/></marker></defs>`;

const box = (x, y, w, h, color = MOSS, fill = 'none', sw = 8) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="${fill}" stroke="${color}" stroke-width="${sw}"/>`;

const dot = (x, y, r, color = CLOVE) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}"/>`;

const text = (x, y, str, size, color = MOSS, weight = 700, anchor = 'middle') =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Georgia, 'Times New Roman', serif"`
  + ` font-size="${size}" font-weight="${weight}" fill="${color}">${str}</text>`;

const bar = (x, y, w, h, color, op = 1) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(h, w) / 2}" fill="${color}" opacity="${op}"/>`;

const ICONS = {};

// ——————————————————————————————
// 数字 11–20：一张牌 ＋ 数字。1–10 用的是 OpenMoji 的 keycap，11 以上没有，
// 只能自己写；写成牌的样子跟前十个的观感也接近。
// ——————————————————————————————
for (const [word, n] of [
  ['sebelas', 11], ['dua belas', 12], ['tiga belas', 13], ['empat belas', 14],
  ['lima belas', 15], ['enam belas', 16], ['tujuh belas', 17], ['delapan belas', 18],
  ['sembilan belas', 19], ['dua puluh', 20],
]) {
  ICONS[word] = wrap(String(n),
    `<rect x="26" y="34" width="148" height="132" rx="26" fill="${MOSS}"/>`
    + `<rect x="38" y="46" width="124" height="108" rx="18" fill="none" stroke="${PAPER}" stroke-width="4" opacity=".35"/>`
    + text(100, 138, String(n), 76, PAPER));
}

// ——————————————————————————————
// 颜色：直接给色卡。说「粉红色」时最该看见的就是那个粉红。
// 后面几个讲的是花样而不是颜色本身（条纹、花纹、褪色…），就画花样。
// ——————————————————————————————
const swatch = (label, fill, extra = '') =>
  wrap(label, `<rect x="30" y="30" width="140" height="140" rx="28" fill="${fill}"/>`
    + `<rect x="30" y="30" width="140" height="140" rx="28" fill="none" stroke="${MOSS}" stroke-width="5" opacity=".35"/>`
    + extra);

ICONS['abu-abu'] = swatch('灰色', '#9a9a94');
ICONS['merah muda'] = swatch('粉红', '#f0a8bc');
ICONS['biru muda'] = swatch('浅蓝', '#a6cbe3');
ICONS['hijau tua'] = swatch('深绿', '#1f4436');
ICONS['krem'] = swatch('米色', '#efe3c8');

// 透明：只有格子底纹能表达「看得见后面」。
ICONS['bening'] = wrap('透明',
  `<defs><pattern id="ck" width="28" height="28" patternUnits="userSpaceOnUse">`
  + `<rect width="28" height="28" fill="${PAPER}"/><rect width="14" height="14" fill="${FADE}"/>`
  + `<rect x="14" y="14" width="14" height="14" fill="${FADE}"/></pattern></defs>`
  + `<rect x="30" y="30" width="140" height="140" rx="28" fill="url(#ck)"/>`
  + `<rect x="30" y="30" width="140" height="140" rx="28" fill="none" stroke="${MOSS}" stroke-width="5" opacity=".5"/>`);

ICONS['warna-warni'] = wrap('五颜六色',
  `<g>${['#d24f4f', '#e2913c', '#c9a227', '#4e8f5f', '#3f7fb0', '#8a5aa8']
    .map((c, i) => `<rect x="${30 + (i % 3) * 47}" y="${30 + Math.floor(i / 3) * 70}" width="47" height="70" fill="${c}"/>`)
    .join('')}</g>`
  + `<rect x="30" y="30" width="141" height="140" rx="10" fill="none" stroke="${MOSS}" stroke-width="5" opacity=".35"/>`);

ICONS['polos'] = swatch('素色', MOSS);
ICONS['bergaris'] = wrap('条纹',
  `<rect x="30" y="30" width="140" height="140" rx="28" fill="${PAPER}"/>`
  + `<g fill="${MOSS}">${[0, 1, 2, 3].map((i) => `<rect x="${42 + i * 34}" y="30" width="17" height="140"/>`).join('')}</g>`
  + `<rect x="30" y="30" width="140" height="140" rx="28" fill="none" stroke="${MOSS}" stroke-width="5" opacity=".45"/>`);

ICONS['bermotif'] = wrap('花纹',
  `<rect x="30" y="30" width="140" height="140" rx="28" fill="${PAPER}"/>`
  + `<g fill="${CLOVE}" opacity=".8">${[0, 1, 2].flatMap((r) => [0, 1, 2].map((c) =>
    `<circle cx="${58 + c * 42}" cy="${58 + r * 42}" r="11"/>`)).join('')}</g>`
  + `<rect x="30" y="30" width="140" height="140" rx="28" fill="none" stroke="${MOSS}" stroke-width="5" opacity=".45"/>`);

ICONS['lembut'] = swatch('柔和', '#dfe8df');
ICONS['kontras'] = wrap('对比强烈',
  `<path d="M30 58a28 28 0 0 1 28-28h42v140H58a28 28 0 0 1-28-28z" fill="#14201b"/>`
  + `<path d="M100 30h42a28 28 0 0 1 28 28v84a28 28 0 0 1-28 28h-42z" fill="${PAPER}"/>`
  + `<rect x="30" y="30" width="140" height="140" rx="28" fill="none" stroke="${MOSS}" stroke-width="5"/>`);

ICONS['senada'] = wrap('同色系',
  `<g>${['#1f4436', '#2f5d4f', '#4e8f78', '#7fb5a2'].map((c, i) =>
    `<rect x="${30 + i * 35}" y="30" width="35" height="140" fill="${c}"/>`).join('')}</g>`
  + `<rect x="30" y="30" width="140" height="140" rx="10" fill="none" stroke="${MOSS}" stroke-width="5" opacity=".35"/>`);

// 相配：两块颜色拼在一起严丝合缝。
ICONS['cocok'] = wrap('相配',
  `<path d="M34 46a12 12 0 0 1 12-12h44v40a16 16 0 0 0 0 32v60H46a12 12 0 0 1-12-12z" fill="${MOSS}"/>`
  + `<path d="M166 46a12 12 0 0 0-12-12h-44v40a16 16 0 0 1 0 32v60h44a12 12 0 0 0 12-12z" fill="${GOLD}"/>`);

// 褪色：同一块颜色从浓到淡。
ICONS['pudar'] = wrap('褪色',
  `<defs><linearGradient id="fd" x1="0" x2="1"><stop offset="0" stop-color="${CLOVE}"/>`
  + `<stop offset="1" stop-color="${CLOVE}" stop-opacity=".12"/></linearGradient></defs>`
  + `<rect x="30" y="30" width="140" height="140" rx="28" fill="url(#fd)"/>`
  + `<rect x="30" y="30" width="140" height="140" rx="28" fill="none" stroke="${MOSS}" stroke-width="5" opacity=".35"/>`);

// ——————————————————————————————
// 人称：谁在说、说的是谁，靠位置和颜色区分。
// 说话人一律用苔绿实心，听话人用金色，第三方用淡色。
// kami／kita 的区别（含不含听话人）是印尼语的难点，图上必须画出来。
// ——————————————————————————————
ICONS['saya'] = wrap('我（正式）',
  person(100, 108, 1.5, MOSS)
  + `<path d="M56 168h88" stroke="${CLOVE}" stroke-width="9" stroke-linecap="round"/>`);
ICONS['aku'] = wrap('我（随意）',
  person(100, 108, 1.5, MOSS) + `<path d="M62 44q38-22 76 0" fill="none" stroke="${GOLD}" stroke-width="8" stroke-linecap="round"/>`);
ICONS['kamu'] = wrap('你（随意）',
  person(66, 112, 1.15, FADE, .55) + person(140, 112, 1.25, GOLD)
  + arrow('M92 96h28', GOLD) + defsArrow(GOLD));
ICONS['Anda'] = wrap('您（正式）',
  person(100, 116, 1.5, GOLD)
  + `<path d="M74 40h52l-8 22H82z" fill="${CLOVE}"/>`);
ICONS['dia'] = wrap('他／她',
  person(70, 116, 1.1, FADE, .5) + person(140, 112, 1.35, CLOVE)
  + `<circle cx="140" cy="66" r="7" fill="${GOLD}"/>`);
// kami：说话人＋自己人，听话人被排除在圈外。
ICONS['kami'] = wrap('我们（不含你）',
  `<ellipse cx="78" cy="112" rx="62" ry="52" fill="none" stroke="${MOSS}" stroke-width="7"/>`
  + person(52, 122, .95, MOSS) + person(104, 122, .95, MOSS)
  + person(172, 122, .95, FADE, .5));
// kita：圈把听话人也圈进来。
ICONS['kita'] = wrap('我们（含你）',
  `<ellipse cx="100" cy="112" rx="86" ry="54" fill="none" stroke="${MOSS}" stroke-width="7"/>`
  + person(52, 122, .92, MOSS) + person(100, 122, .92, MOSS) + person(148, 122, .92, GOLD));
ICONS['mereka'] = wrap('他们',
  person(46, 130, .85, CLOVE) + person(90, 130, .85, CLOVE) + person(134, 130, .85, CLOVE)
  + person(172, 130, .85, CLOVE) + `<path d="M20 158h160" stroke="${MOSS}" stroke-width="6" stroke-linecap="round" fill="none" opacity=".4"/>`);
ICONS['kalian'] = wrap('你们',
  person(58, 130, .9, GOLD) + person(100, 130, .9, GOLD) + person(142, 130, .9, GOLD)
  + arrow('M100 44v26', CLOVE) + defsArrow(CLOVE));
ICONS['sendiri'] = wrap('自己',
  `<circle cx="100" cy="104" r="62" fill="none" stroke="${MOSS}" stroke-width="7" stroke-dasharray="3 16" stroke-linecap="round"/>`
  + person(100, 116, 1.25, MOSS));

// ——————————————————————————————
// 介词：全是「东西跟位置／方向的关系」，用一个方块和一个点就能说清。
// ——————————————————————————————
ICONS['di'] = wrap('在',
  box(38, 52, 124, 106) + dot(100, 105, 18));
ICONS['ke'] = wrap('到、往',
  dot(40, 105, 15, MOSS) + box(122, 60, 56, 90, MOSS)
  + arrow('M62 105h48') + defsArrow());
ICONS['dari'] = wrap('从',
  box(22, 60, 56, 90, MOSS) + dot(160, 105, 15, MOSS)
  + arrow('M92 105h44') + defsArrow());
ICONS['untuk'] = wrap('为了、给',
  `<rect x="26" y="86" width="58" height="54" rx="10" fill="${GOLD}"/>`
  + `<path d="M55 86v54M26 104h58" stroke="${PAPER}" stroke-width="7"/>`
  + person(158, 128, 1.1, MOSS)
  + arrow('M96 112h32') + defsArrow());
ICONS['dengan'] = wrap('和、用',
  person(62, 122, 1.15, MOSS) + person(138, 122, 1.15, GOLD)
  + `<path d="M84 108h32" stroke="${CLOVE}" stroke-width="9" stroke-linecap="round"/>`);
ICONS['kepada'] = wrap('向、给（人）',
  `<rect x="24" y="82" width="56" height="42" rx="8" fill="${MOSS}"/>`
  + `<path d="M24 82l28 22 28-22" fill="none" stroke="${PAPER}" stroke-width="6"/>`
  + person(160, 126, 1.1, GOLD)
  + arrow('M92 104h34') + defsArrow());
ICONS['pada'] = wrap('在（时间）',
  `<circle cx="100" cy="100" r="64" fill="none" stroke="${MOSS}" stroke-width="9"/>`
  + `<path d="M100 58v46l30 20" fill="none" stroke="${CLOVE}" stroke-width="9" stroke-linecap="round"/>`);
ICONS['tentang'] = wrap('关于',
  `<circle cx="100" cy="100" r="30" fill="${MOSS}"/>`
  + `<circle cx="100" cy="100" r="58" fill="none" stroke="${CLOVE}" stroke-width="8" stroke-dasharray="16 12"/>`);
ICONS['sampai'] = wrap('直到',
  arrow('M28 118h108') + defsArrow()
  + `<path d="M156 46v108" stroke="${MOSS}" stroke-width="11" stroke-linecap="round"/>`);
ICONS['tanpa'] = wrap('没有、不带',
  `<rect x="52" y="62" width="96" height="76" rx="16" fill="none" stroke="${MOSS}" stroke-width="8" stroke-dasharray="12 10"/>`
  + `<path d="M56 156L144 44" stroke="${CLOVE}" stroke-width="12" stroke-linecap="round"/>`);

// ——————————————————————————————
// 连接词：说的是两件事之间是什么关系，画成两个块加一根线。
// ——————————————————————————————
const two = (leftFill, rightFill, mid) =>
  `<rect x="18" y="72" width="62" height="62" rx="14" fill="${leftFill}"/>`
  + `<rect x="120" y="72" width="62" height="62" rx="14" fill="${rightFill}"/>${mid}`;

ICONS['dan'] = wrap('和', two(MOSS, MOSS,
  `<path d="M86 103h28M100 89v28" stroke="${CLOVE}" stroke-width="10" stroke-linecap="round"/>`));
ICONS['atau'] = wrap('或者',
  `<rect x="18" y="30" width="62" height="56" rx="14" fill="${MOSS}"/>`
  + `<rect x="18" y="118" width="62" height="56" rx="14" fill="${MOSS}" opacity=".3"/>`
  + `<path d="M120 58h56M120 146h56" stroke="${FADE}" stroke-width="0"/>`
  + arrow('M100 100h60M100 100L100 58h20M100 100l0 46h20', CLOVE, 8) + defsArrow());
ICONS['tetapi'] = wrap('但是', two(MOSS, CLOVE,
  `<path d="M84 128L116 78" stroke="${GOLD}" stroke-width="11" stroke-linecap="round"/>`));
ICONS['karena'] = wrap('因为',
  `<rect x="12" y="56" width="84" height="88" rx="18" fill="${CLOVE}"/>`
  + `<g fill="${PAPER}"><circle cx="40" cy="86" r="8"/><circle cx="68" cy="86" r="8"/><circle cx="54" cy="116" r="8"/></g>`
  + `<rect x="124" y="56" width="64" height="88" rx="16" fill="none" stroke="${MOSS}" stroke-width="7"/>`
  + arrow('M104 100h12') + defsArrow());
ICONS['jadi'] = wrap('所以',
  `<rect x="12" y="56" width="64" height="88" rx="16" fill="none" stroke="${MOSS}" stroke-width="7"/>`
  + `<rect x="104" y="56" width="84" height="88" rx="18" fill="${MOSS}"/>`
  + `<g fill="${PAPER}"><circle cx="146" cy="84" r="8"/><circle cx="132" cy="116" r="8"/><circle cx="160" cy="116" r="8"/></g>`
  + arrow('M84 100h12', MOSS) + defsArrow(MOSS));
ICONS['kalau'] = wrap('如果',
  `<path d="M60 100l34-34 34 34-34 34z" fill="none" stroke="${GOLD}" stroke-width="9"/>`
  + `<path d="M128 100h44M94 34V16M94 184v-18" stroke="${MOSS}" stroke-width="8" stroke-linecap="round" fill="none"/>`);
ICONS['supaya'] = wrap('为了、以便',
  `<circle cx="140" cy="100" r="34" fill="none" stroke="${MOSS}" stroke-width="8"/>`
  + `<circle cx="140" cy="100" r="12" fill="${CLOVE}"/>`
  + arrow('M20 100h76') + defsArrow());
ICONS['walaupun'] = wrap('虽然',
  `<path d="M84 34v132" stroke="${CLOVE}" stroke-width="14" stroke-linecap="round" opacity=".55"/>`
  + arrow('M22 100h150', MOSS, 10) + defsArrow(MOSS));
ICONS['lalu'] = wrap('然后',
  dot(44, 100, 18, MOSS) + dot(156, 100, 18, MOSS)
  + arrow('M70 100h58') + defsArrow()
  + text(100, 158, '1 → 2', 24, MOSS));
ICONS['sedangkan'] = wrap('而、然而',
  `<rect x="18" y="60" width="66" height="80" rx="14" fill="${MOSS}"/>`
  + `<rect x="116" y="60" width="66" height="80" rx="14" fill="${GOLD}"/>`
  + `<path d="M100 40v120" stroke="${CLOVE}" stroke-width="8" stroke-dasharray="12 10" stroke-linecap="round"/>`);

// ——————————————————————————————
// 副词（程度与频率）：程度用条的长短，频率用格子里点的疏密。
// 一眼能比出大小，比任何图案都直观。
// ——————————————————————————————
const gauge = (label, filled) =>
  wrap(label, `<rect x="24" y="82" width="152" height="36" rx="18" fill="${FADE}" opacity=".45"/>`
    + bar(24, 82, Math.max(18, 152 * filled), 36, MOSS)
    + `<rect x="24" y="82" width="152" height="36" rx="18" fill="none" stroke="${MOSS}" stroke-width="4" opacity=".5"/>`);

ICONS['sangat'] = gauge('非常', .88);
ICONS['sekali'] = gauge('很', .82);
ICONS['agak'] = gauge('有点', .34);
ICONS['terlalu'] = wrap('太',
  `<rect x="24" y="82" width="152" height="36" rx="18" fill="${FADE}" opacity=".45"/>`
  + bar(24, 82, 152, 36, CLOVE)
  + `<path d="M182 66v68" stroke="${MOSS}" stroke-width="9" stroke-linecap="round"/>`
  + `<path d="M186 100h10" stroke="${CLOVE}" stroke-width="9" stroke-linecap="round"/>`);

// 频率：五个格子，点亮几个就是多常做。
const freq = (label, on) =>
  wrap(label, `<g>${[0, 1, 2, 3, 4].map((i) =>
    `<rect x="${16 + i * 36}" y="80" width="28" height="40" rx="8" fill="${on.includes(i) ? MOSS : FADE}" opacity="${on.includes(i) ? 1 : .35}"/>`).join('')}</g>`);

ICONS['selalu'] = freq('总是', [0, 1, 2, 3, 4]);
ICONS['sering'] = freq('经常', [0, 1, 2, 3]);
ICONS['kadang-kadang'] = freq('有时', [1, 3]);
ICONS['jarang'] = freq('很少', [2]);
ICONS['tidak pernah'] = wrap('从不',
  `<g>${[0, 1, 2, 3, 4].map((i) =>
    `<rect x="${16 + i * 36}" y="80" width="28" height="40" rx="8" fill="${FADE}" opacity=".35"/>`).join('')}</g>`
  + `<path d="M24 140L176 60" stroke="${CLOVE}" stroke-width="11" stroke-linecap="round"/>`);
ICONS['hampir'] = wrap('几乎',
  `<rect x="24" y="82" width="152" height="36" rx="18" fill="${FADE}" opacity=".45"/>`
  + bar(24, 82, 134, 36, MOSS)
  + `<path d="M166 100h14" stroke="${CLOVE}" stroke-width="8" stroke-linecap="round" stroke-dasharray="3 9"/>`);

// ——————————————————————————————
// 逻辑连接：文章里承上启下的词。画的是「上一段和下一段的关系」。
// ——————————————————————————————
const para = (x, y, w, color, op = 1, lines = 3) =>
  `<g fill="${color}" opacity="${op}">${Array.from({ length: lines }, (_, i) =>
    `<rect x="${x}" y="${y + i * 14}" width="${i === lines - 1 ? w * 0.6 : w}" height="8" rx="4"/>`).join('')}</g>`;

ICONS['misalnya'] = wrap('比如',
  para(24, 46, 152, MOSS, .9, 2)
  + `<path d="M40 96v56" stroke="${GOLD}" stroke-width="7" stroke-linecap="round"/>`
  + `<g fill="${CLOVE}">${[0, 1, 2].map((i) => `<circle cx="60" cy="${104 + i * 24}" r="7"/>`).join('')}</g>`
  + `<g fill="${MOSS}" opacity=".75">${[0, 1, 2].map((i) => `<rect x="78" y="${100 + i * 24}" width="92" height="8" rx="4"/>`).join('')}</g>`);

ICONS['sebaliknya'] = wrap('相反',
  arrow('M30 74h122', MOSS) + `<path d="M170 126H48" fill="none" stroke="${CLOVE}" stroke-width="9" stroke-linecap="round" marker-end="url(#tip2)"/>`
  + `<defs><marker id="tip2" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto">`
  + `<path d="M0 0l10 5-10 5z" fill="${CLOVE}"/></marker></defs>` + defsArrow(MOSS));

ICONS['selain itu'] = wrap('此外',
  para(24, 40, 152, MOSS, .85)
  + `<rect x="24" y="104" width="152" height="60" rx="14" fill="none" stroke="${CLOVE}" stroke-width="7" stroke-dasharray="14 10"/>`
  + `<path d="M100 118v32M84 134h32" stroke="${CLOVE}" stroke-width="9" stroke-linecap="round"/>`);

ICONS['oleh karena itu'] = wrap('因此',
  para(24, 34, 152, MOSS, .8, 2)
  + arrow('M100 82v34', CLOVE) + defsArrow(CLOVE)
  + `<rect x="40" y="126" width="120" height="46" rx="14" fill="${MOSS}"/>`
  + `<path d="M66 150h68" stroke="${PAPER}" stroke-width="9" stroke-linecap="round"/>`);

ICONS['meskipun'] = wrap('尽管',
  `<path d="M96 26v148" stroke="${CLOVE}" stroke-width="16" stroke-linecap="round" opacity=".5"/>`
  + arrow('M20 100h158', MOSS, 11) + defsArrow(MOSS));

ICONS['sementara itu'] = wrap('与此同时',
  arrow('M24 66h140', MOSS) + `<path d="M24 134h140" fill="none" stroke="${GOLD}" stroke-width="9" stroke-linecap="round" marker-end="url(#tip3)"/>`
  + `<defs><marker id="tip3" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto">`
  + `<path d="M0 0l10 5-10 5z" fill="${GOLD}"/></marker></defs>` + defsArrow(MOSS)
  + `<path d="M100 40v120" stroke="${CLOVE}" stroke-width="5" stroke-dasharray="8 10" stroke-linecap="round"/>`);

ICONS['bahkan'] = wrap('甚至',
  `<g>${[0, 1, 2].map((i) => bar(30, 132 - i * 0, 0, 0)).join('')}</g>`
  + bar(28, 122, 40, 40, MOSS, .45) + bar(80, 96, 40, 66, MOSS, .7)
  + bar(132, 44, 40, 118, CLOVE));

ICONS['singkatnya'] = wrap('简而言之',
  para(24, 34, 152, MOSS, .45, 4)
  + arrow('M100 100v26', CLOVE) + defsArrow(CLOVE)
  + `<rect x="52" y="136" width="96" height="14" rx="7" fill="${MOSS}"/>`);

ICONS['menurut saya'] = wrap('我认为',
  person(64, 132, 1.15, MOSS)
  + `<path d="M104 52h74a12 12 0 0 1 12 12v34a12 12 0 0 1-12 12h-52l-22 20v-20a12 12 0 0 1-12-12V64a12 12 0 0 1 12-12z" fill="${GOLD}"/>`);

ICONS['kesimpulannya'] = wrap('结论是',
  para(30, 34, 140, MOSS, .5, 3)
  + `<path d="M30 100h140" stroke="${MOSS}" stroke-width="5" opacity=".5"/>`
  + `<rect x="46" y="118" width="108" height="48" rx="14" fill="${MOSS}"/>`
  + `<path d="M70 142l16 16 30-32" fill="none" stroke="${PAPER}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`);

// ——————————————————————————————
// 程度进阶：全部用同一根刻度尺，位置不同意思就不同。
// 用同一套图形是有意的——这一包十个词就是在比同一件事的程度。
// ——————————————————————————————
const scale = (label, extra) =>
  wrap(label, `<path d="M22 132h156" stroke="${MOSS}" stroke-width="7" stroke-linecap="round"/>`
    + `<g stroke="${MOSS}" stroke-width="5" opacity=".4" stroke-linecap="round">`
    + [0, 1, 2, 3, 4].map((i) => `<path d="M${30 + i * 35} 132v-12"/>`).join('') + `</g>${extra}`);

ICONS['terlampau'] = scale('过于',
  `<path d="M170 132V52" stroke="${CLOVE}" stroke-width="10" stroke-linecap="round"/>` + dot(170, 46, 13));
ICONS['lumayan'] = scale('还不错',
  `<path d="M118 132V78" stroke="${MOSS}" stroke-width="10" stroke-linecap="round"/>` + dot(118, 72, 13, MOSS));
ICONS['kelewatan'] = scale('过头了',
  `<path d="M150 100h34" stroke="${CLOVE}" stroke-width="8" stroke-dasharray="7 8" stroke-linecap="round"/>`
  + `<path d="M150 132V60" stroke="${MOSS}" stroke-width="8" stroke-linecap="round"/>`
  + dot(184, 100, 12) + `<path d="M150 60h-6" stroke="${MOSS}" stroke-width="8"/>`);
ICONS['sedikit demi sedikit'] = wrap('一点一点',
  `<g fill="${MOSS}">${[0, 1, 2, 3, 4].map((i) =>
    `<rect x="${22 + i * 34}" y="${140 - (i + 1) * 18}" width="26" height="${(i + 1) * 18}" rx="6" opacity="${0.4 + i * 0.15}"/>`).join('')}</g>`);
ICONS['semakin'] = wrap('越来越',
  `<path d="M24 150L176 46" fill="none" stroke="${CLOVE}" stroke-width="11" stroke-linecap="round" marker-end="url(#tip)"/>`
  + defsArrow(CLOVE)
  + `<path d="M24 158h152" stroke="${MOSS}" stroke-width="6" opacity=".4" stroke-linecap="round"/>`);
ICONS['paling sedikit'] = scale('至少',
  `<path d="M64 132V72" stroke="${MOSS}" stroke-width="10" stroke-linecap="round"/>`
  + arrow('M76 72h96', CLOVE, 8) + defsArrow(CLOVE) + dot(64, 66, 12, MOSS));
ICONS['nyaris'] = wrap('差点',
  `<path d="M150 30v140" stroke="${MOSS}" stroke-width="10" stroke-linecap="round"/>`
  + arrow('M24 100h104', CLOVE) + defsArrow(CLOVE)
  + `<path d="M134 100h8" stroke="${CLOVE}" stroke-width="8" stroke-dasharray="3 8" stroke-linecap="round"/>`);
ICONS['berlebihan'] = wrap('过分的',
  `<path d="M40 150h120l-12-64a48 48 0 0 0-96 0z" fill="${MOSS}"/>`
  + `<g fill="${CLOVE}">${[0, 1, 2].map((i) => `<circle cx="${72 + i * 28}" cy="${58 - (i % 2) * 14}" r="13"/>`).join('')}</g>`);
ICONS['seadanya'] = wrap('有什么算什么',
  box(38, 62, 124, 96, MOSS, 'none', 8)
  + dot(80, 118, 14, CLOVE) + dot(120, 128, 10, GOLD));
ICONS['kira-kira'] = wrap('大约',
  `<path d="M30 88q22-22 44 0t44 0 44 0" fill="none" stroke="${MOSS}" stroke-width="9" stroke-linecap="round"/>`
  + `<path d="M30 128q22-22 44 0t44 0 44 0" fill="none" stroke="${MOSS}" stroke-width="9" stroke-linecap="round" opacity=".5"/>`);

// ——————————————————————————————
// 位置与方位：一个参照物加一个点。sini／situ／sana 的远近差别靠距离画出来。
// ——————————————————————————————
ICONS['sini'] = wrap('这里',
  `<ellipse cx="100" cy="158" rx="52" ry="16" fill="${CLOVE}" opacity=".35"/>`
  + person(100, 138, 1.2, MOSS)
  + `<ellipse cx="100" cy="158" rx="52" ry="16" fill="none" stroke="${CLOVE}" stroke-width="7"/>`);
ICONS['situ'] = wrap('那里（近）',
  person(50, 130, .95, MOSS) + `<circle cx="132" cy="120" r="24" fill="none" stroke="${CLOVE}" stroke-width="7"/>`
  + `<path d="M76 118h30" stroke="${GOLD}" stroke-width="7" stroke-linecap="round" stroke-dasharray="4 10"/>`);
ICONS['sana'] = wrap('那里（远）',
  person(38, 130, .85, MOSS) + `<circle cx="166" cy="112" r="20" fill="none" stroke="${CLOVE}" stroke-width="7"/>`
  + `<path d="M62 118h82" stroke="${GOLD}" stroke-width="7" stroke-linecap="round" stroke-dasharray="4 12"/>`);
ICONS['ini'] = wrap('这个',
  `<rect x="62" y="62" width="76" height="76" rx="16" fill="${MOSS}"/>`
  + `<path d="M100 172v-20" stroke="${CLOVE}" stroke-width="9" stroke-linecap="round"/>` + dot(100, 176, 9));
ICONS['itu'] = wrap('那个',
  `<rect x="112" y="70" width="62" height="62" rx="14" fill="${MOSS}" opacity=".55"/>`
  + arrow('M30 100h62') + defsArrow());
ICONS['dekat'] = wrap('近的',
  dot(78, 100, 18, MOSS) + dot(126, 100, 18, CLOVE)
  + `<path d="M78 146h48" stroke="${MOSS}" stroke-width="6" stroke-linecap="round"/>`
  + `<path d="M78 138v16M126 138v16" stroke="${MOSS}" stroke-width="6" stroke-linecap="round"/>`);
ICONS['jauh'] = wrap('远的',
  dot(32, 100, 16, MOSS) + dot(168, 100, 16, CLOVE)
  + `<path d="M32 146h136" stroke="${MOSS}" stroke-width="6" stroke-linecap="round"/>`
  + `<path d="M32 138v16M168 138v16" stroke="${MOSS}" stroke-width="6" stroke-linecap="round"/>`);
ICONS['sebelah'] = wrap('隔壁',
  `<path d="M24 150V96l40-32 40 32v54z" fill="${MOSS}"/>`
  + `<path d="M104 150V96l40-32 40 32v54z" fill="${GOLD}"/>`);
ICONS['sekitar'] = wrap('附近',
  dot(100, 100, 18, MOSS)
  + `<circle cx="100" cy="100" r="46" fill="none" stroke="${CLOVE}" stroke-width="7" stroke-dasharray="12 10"/>`
  + `<circle cx="100" cy="100" r="70" fill="none" stroke="${CLOVE}" stroke-width="5" stroke-dasharray="10 12" opacity=".5"/>`);
ICONS['tempat'] = wrap('地方',
  `<path d="M100 24a44 44 0 0 1 44 44c0 32-44 92-44 92S56 100 56 68a44 44 0 0 1 44-44z" fill="${MOSS}"/>`
  + `<circle cx="100" cy="68" r="17" fill="${PAPER}"/>`);

// 方位六个：同一个方块，标出不同的面。
const face = (label, marks) =>
  wrap(label, box(56, 56, 88, 88, MOSS, 'none', 8) + marks);

ICONS['depan'] = face('前面', `<rect x="56" y="14" width="88" height="26" rx="10" fill="${CLOVE}"/>`);
ICONS['belakang'] = face('后面', `<rect x="56" y="160" width="88" height="26" rx="10" fill="${CLOVE}"/>`);
ICONS['samping'] = face('旁边', `<rect x="160" y="56" width="26" height="88" rx="10" fill="${CLOVE}"/>`);
ICONS['tengah'] = face('中间', dot(100, 100, 20, CLOVE));
ICONS['dalam'] = wrap('里面',
  box(40, 40, 120, 120, MOSS, 'none', 8) + `<rect x="72" y="72" width="56" height="56" rx="12" fill="${CLOVE}"/>`);
ICONS['luar'] = wrap('外面',
  box(24, 56, 92, 92, MOSS, 'none', 8) + `<rect x="134" y="82" width="52" height="52" rx="12" fill="${CLOVE}"/>`);

// ——————————————————————————————
// 判断：确定到什么程度。
// ——————————————————————————————
ICONS['mungkin'] = wrap('可能',
  `<path d="M66 76a34 34 0 1 1 40 40v16" fill="none" stroke="${MOSS}" stroke-width="13" stroke-linecap="round"/>`
  + dot(106, 158, 11));
ICONS['pasti'] = wrap('一定',
  `<circle cx="100" cy="100" r="66" fill="${MOSS}"/>`
  + `<path d="M68 102l22 24 44-50" fill="none" stroke="${PAPER}" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>`);
ICONS['belum'] = wrap('还没',
  `<circle cx="100" cy="100" r="62" fill="none" stroke="${MOSS}" stroke-width="9"/>`
  + `<path d="M100 58v46l28 18" fill="none" stroke="${CLOVE}" stroke-width="9" stroke-linecap="round"/>`
  + `<rect x="60" y="150" width="80" height="12" rx="6" fill="${FADE}"/>`);
ICONS['sudah'] = wrap('已经',
  `<rect x="30" y="76" width="140" height="44" rx="22" fill="${MOSS}"/>`
  + `<path d="M60 100l20 20 42-44" fill="none" stroke="${PAPER}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>`);


// ——————————————————————————————
// 动作：画动作本身，不画做动作的人——手指头大小的图上，人一画就没地方了。
// ——————————————————————————————
ICONS['menekan'] = wrap('按',
  `<circle cx="100" cy="126" r="46" fill="${MOSS}"/>`
  + `<circle cx="100" cy="126" r="24" fill="${PAPER}"/>`
  + arrow('M100 24v54', CLOVE, 11) + defsArrow(CLOVE));
ICONS['beristirahat'] = wrap('休息',
  `<path d="M28 148V96a20 20 0 0 1 20-20h104a20 20 0 0 1 20 20v52" fill="none" stroke="${MOSS}" stroke-width="10" stroke-linecap="round"/>`
  + `<rect x="44" y="106" width="112" height="34" rx="16" fill="${MOSS}"/>`
  + `<path d="M118 58q14-12 0-24t0-22" fill="none" stroke="${CLOVE}" stroke-width="7" stroke-linecap="round"/>`);
ICONS['membuat'] = wrap('做、制作',
  `<path d="M132 34l34 34-30 30-34-34z" fill="${GOLD}"/>`
  + `<path d="M100 66L36 130a16 16 0 0 0 0 24 16 16 0 0 0 24 0l64-64z" fill="${MOSS}"/>`);
ICONS['menyimpan'] = wrap('存放',
  `<path d="M30 72h140v82a14 14 0 0 1-14 14H44a14 14 0 0 1-14-14z" fill="${MOSS}"/>`
  + `<path d="M30 72l22-30h96l22 30z" fill="${CLOVE}"/>`
  + `<rect x="82" y="96" width="36" height="14" rx="7" fill="${PAPER}"/>`);
ICONS['hilang'] = wrap('丢失',
  `<rect x="52" y="58" width="96" height="86" rx="18" fill="none" stroke="${MOSS}" stroke-width="8" stroke-dasharray="14 12"/>`
  + `<path d="M78 84l44 44M122 84l-44 44" stroke="${CLOVE}" stroke-width="10" stroke-linecap="round"/>`);
ICONS['habis'] = wrap('用完',
  `<path d="M52 44h96l-10 106a20 20 0 0 1-20 18H82a20 20 0 0 1-20-18z" fill="none" stroke="${MOSS}" stroke-width="8"/>`
  + `<path d="M64 150h72" stroke="${MOSS}" stroke-width="8" stroke-linecap="round" opacity=".4"/>`
  + `<path d="M40 34h120" stroke="${CLOVE}" stroke-width="10" stroke-linecap="round"/>`);
ICONS['muncul'] = wrap('出现',
  `<path d="M28 152h144" stroke="${MOSS}" stroke-width="9" stroke-linecap="round"/>`
  + `<circle cx="100" cy="98" r="34" fill="${CLOVE}"/>`
  + `<g stroke="${GOLD}" stroke-width="8" stroke-linecap="round">`
  + `<path d="M100 34v18"/><path d="M52 60l12 12"/><path d="M148 60l-12 12"/></g>`);
ICONS['ikut'] = wrap('跟着',
  person(60, 128, 1.05, MOSS) + person(126, 128, 1.05, CLOVE)
  + `<path d="M86 108h22" stroke="${GOLD}" stroke-width="8" stroke-linecap="round" stroke-dasharray="6 10"/>`);
ICONS['lewat'] = wrap('经过',
  `<rect x="76" y="24" width="48" height="152" rx="10" fill="${MOSS}" opacity=".25"/>`
  + arrow('M24 100h152') + defsArrow());
ICONS['butuh'] = wrap('需要',
  `<path d="M100 164S32 118 32 76a34 34 0 0 1 68-12 34 34 0 0 1 68 12c0 42-68 88-68 88z" fill="${CLOVE}"/>`);
ICONS['telat'] = wrap('迟到',
  `<circle cx="100" cy="104" r="60" fill="none" stroke="${MOSS}" stroke-width="9"/>`
  + `<path d="M100 62v46l34 12" fill="none" stroke="${CLOVE}" stroke-width="10" stroke-linecap="round"/>`
  + `<path d="M144 40l26-20" stroke="${CLOVE}" stroke-width="9" stroke-linecap="round"/>`);
ICONS['mencoba lagi'] = wrap('再试一次',
  `<path d="M156 100a56 56 0 1 1-20-43" fill="none" stroke="${MOSS}" stroke-width="12" stroke-linecap="round"/>`
  + `<path d="M138 24v38h-38" fill="none" stroke="${CLOVE}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>`);

// ——————————————————————————————
// 礼貌：这几句都是「场面上的一来一回」，画成两个人之间的动作。
// ——————————————————————————————
ICONS['sama-sama'] = wrap('不客气',
  person(60, 128, 1.05, MOSS) + person(140, 128, 1.05, GOLD)
  + `<path d="M84 96h32M84 116h32" stroke="${CLOVE}" stroke-width="7" stroke-linecap="round"/>`);
ICONS['tidak apa-apa'] = wrap('没关系',
  `<circle cx="100" cy="100" r="62" fill="none" stroke="${MOSS}" stroke-width="9"/>`
  + `<path d="M68 116q32 26 64 0" fill="none" stroke="${MOSS}" stroke-width="9" stroke-linecap="round"/>`
  + dot(78, 82, 8, MOSS) + dot(122, 82, 8, MOSS));
ICONS['boleh'] = wrap('可以',
  `<circle cx="100" cy="100" r="62" fill="none" stroke="${MOSS}" stroke-width="10"/>`
  + `<path d="M70 102l20 22 42-46" fill="none" stroke="${MOSS}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>`);
ICONS['mohon'] = wrap('恳请',
  `<path d="M94 26c-10 26-32 44-38 66-5 19 3 36 20 44l18 8V26z" fill="${MOSS}"/>`
  + `<path d="M106 26c10 26 32 44 38 66 5 19-3 36-20 44l-18 8V26z" fill="${MOSS}" opacity=".7"/>`
  + `<g stroke="${PAPER}" stroke-width="4" opacity=".55" fill="none">`
  + `<path d="M78 52v78"/><path d="M122 52v78"/></g>`
  + `<rect x="66" y="146" width="68" height="20" rx="10" fill="${CLOVE}"/>`);
ICONS['silakan masuk'] = wrap('请进',
  `<path d="M118 26h44v148h-44" fill="none" stroke="${MOSS}" stroke-width="10" stroke-linejoin="round"/>`
  + dot(132, 100, 8, MOSS)
  + arrow('M28 100h64') + defsArrow());
ICONS['boleh jadi'] = wrap('或许',
  `<path d="M66 76a34 34 0 1 1 40 40v14" fill="none" stroke="${MOSS}" stroke-width="12" stroke-linecap="round"/>`
  + dot(106, 156, 10)
  + `<path d="M150 44l16-16M162 70h22" stroke="${GOLD}" stroke-width="7" stroke-linecap="round"/>`);

// ——————————————————————————————
// 租房：一套房子 ＋ 每个词各自的重点。
// ——————————————————————————————
const house = (fill = MOSS, op = 1) =>
  `<path d="M40 158V92l60-46 60 46v66z" fill="${fill}" opacity="${op}"/>`;

ICONS['sewa bulanan'] = wrap('月租',
  house(MOSS, .85) + `<rect x="76" y="106" width="48" height="52" rx="6" fill="${PAPER}"/>`
  + `<circle cx="152" cy="48" r="30" fill="${GOLD}"/>` + text(152, 58, '30', 26, PAPER));
ICONS['pemilik rumah'] = wrap('房东',
  house(MOSS, .35) + person(100, 132, 1.15, MOSS)
  + `<path d="M76 42l24-20 24 20" fill="none" stroke="${CLOVE}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`);
ICONS['penyewa'] = wrap('租客',
  house(MOSS, .35) + person(100, 132, 1.15, GOLD)
  + `<path d="M62 62h20M118 62h20" stroke="${CLOVE}" stroke-width="7" stroke-linecap="round"/>`);
ICONS['uang jaminan'] = wrap('押金',
  `<rect x="34" y="74" width="132" height="76" rx="14" fill="${GOLD}"/>`
  + `<circle cx="100" cy="112" r="22" fill="${PAPER}"/>`
  + `<path d="M70 56a30 30 0 0 1 60 0v18h-14V56a16 16 0 0 0-32 0v18H70z" fill="${MOSS}"/>`);
ICONS['tagihan air'] = wrap('水费',
  `<rect x="46" y="34" width="108" height="132" rx="12" fill="none" stroke="${MOSS}" stroke-width="8"/>`
  + `<path d="M100 66c14 20 24 32 24 44a24 24 0 0 1-48 0c0-12 10-24 24-44z" fill="${CLOVE}"/>`
  + `<path d="M70 142h60" stroke="${MOSS}" stroke-width="7" stroke-linecap="round"/>`);
ICONS['perpanjang sewa'] = wrap('续租',
  house(MOSS, .35)
  + `<path d="M150 104a48 48 0 1 1-16-36" fill="none" stroke="${CLOVE}" stroke-width="11" stroke-linecap="round"/>`
  + `<path d="M136 42v30h-30" fill="none" stroke="${CLOVE}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>`);

// ——————————————————————————————
// 机场
// ——————————————————————————————
const bag = (x, y, w, h, fill) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${fill}"/>`
  + `<path d="M${x + w * 0.32} ${y}v-14a${w * 0.18} 14 0 0 1 ${w * 0.36} 0v14" fill="none" stroke="${fill}" stroke-width="7"/>`;

ICONS['bagasi kabin'] = wrap('随身行李',
  bag(64, 68, 72, 92, MOSS) + `<path d="M64 122h72" stroke="${PAPER}" stroke-width="7"/>`
  + `<path d="M28 172h144" stroke="${MOSS}" stroke-width="7" stroke-linecap="round" opacity=".4"/>`);
ICONS['check-in'] = wrap('办理登机',
  `<rect x="26" y="76" width="112" height="66" rx="12" fill="${MOSS}"/>`
  + `<path d="M26 100h112" stroke="${PAPER}" stroke-width="6"/>`
  + `<circle cx="52" cy="122" r="9" fill="${PAPER}"/>`
  + `<path d="M150 60l30 30-30 30" fill="none" stroke="${CLOVE}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`);
ICONS['pemeriksaan'] = wrap('安检',
  `<path d="M46 166V70a54 54 0 0 1 108 0v96" fill="none" stroke="${MOSS}" stroke-width="12" stroke-linecap="round"/>`
  + `<path d="M100 82v52" stroke="${CLOVE}" stroke-width="9" stroke-linecap="round" stroke-dasharray="10 10"/>`);
ICONS['kelebihan bagasi'] = wrap('行李超重',
  bag(46, 84, 82, 76, MOSS)
  + `<path d="M20 174q68 14 136 0" fill="none" stroke="${MOSS}" stroke-width="9" stroke-linecap="round"/>`
  + `<circle cx="156" cy="52" r="30" fill="${CLOVE}"/>`
  + `<path d="M156 36v20" stroke="${PAPER}" stroke-width="9" stroke-linecap="round"/>`
  + `<circle cx="156" cy="66" r="6" fill="${PAPER}"/>`);

// ——————————————————————————————
// 印尼特有的水果与吃食：OpenMoji 一个都没有。画得像不像那个东西，
// 是这几张图唯一的标准。
// ——————————————————————————————
ICONS['durian'] = wrap('榴莲',
  `<ellipse cx="100" cy="108" rx="62" ry="56" fill="#8a8f3a"/>`
  + `<g fill="#6f7530">${Array.from({ length: 22 }, (_, i) => {
    const a = (i / 22) * Math.PI * 2;
    const x = 100 + Math.cos(a) * 58; const y = 108 + Math.sin(a) * 52;
    const x2 = 100 + Math.cos(a) * 76; const y2 = 108 + Math.sin(a) * 68;
    const px = 100 + Math.cos(a + 0.14) * 52; const py = 108 + Math.sin(a + 0.14) * 46;
    const qx = 100 + Math.cos(a - 0.14) * 52; const qy = 108 + Math.sin(a - 0.14) * 46;
    return `<path d="M${px.toFixed(1)} ${py.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}L${qx.toFixed(1)} ${qy.toFixed(1)}z"/>`;
  }).join('')}</g>`
  + `<path d="M100 52V28" stroke="#5a4326" stroke-width="9" stroke-linecap="round"/>`);

ICONS['rambutan'] = wrap('红毛丹',
  `<g stroke="#d24f4f" stroke-width="6" stroke-linecap="round">${Array.from({ length: 20 }, (_, i) => {
    const a = (i / 20) * Math.PI * 2;
    return `<path d="M${(100 + Math.cos(a) * 46).toFixed(1)} ${(108 + Math.sin(a) * 44).toFixed(1)}`
      + `L${(100 + Math.cos(a) * 76).toFixed(1)} ${(108 + Math.sin(a) * 72).toFixed(1)}"/>`;
  }).join('')}</g>`
  + `<ellipse cx="100" cy="108" rx="48" ry="46" fill="#c0392b"/>`
  + `<ellipse cx="86" cy="94" rx="14" ry="10" fill="#e8736a" opacity=".7"/>`);

ICONS['manggis'] = wrap('山竹',
  `<circle cx="100" cy="112" r="58" fill="#5b2740"/>`
  + `<g fill="#3f1a2c">${[0, 1, 2, 3].map((i) =>
    `<circle cx="${100 + Math.cos((i / 4) * 6.28) * 22}" cy="${72 + Math.sin((i / 4) * 6.28) * 8}" r="15"/>`).join('')}</g>`
  + `<circle cx="100" cy="66" r="18" fill="#4e7d3a"/>`
  + `<path d="M100 48V32" stroke="#4e7d3a" stroke-width="9" stroke-linecap="round"/>`);

ICONS['salak'] = wrap('蛇皮果',
  `<path d="M100 44c34 0 56 30 56 66s-24 46-56 46-56-10-56-46 22-66 56-66z" fill="#7a4a2a"/>`
  + `<g fill="none" stroke="#4a2c17" stroke-width="3.5" opacity=".85">${
    Array.from({ length: 7 }, (_, r) => `<path d="M50 ${64 + r * 16}q50 14 100 0"/>`).join('')
    + Array.from({ length: 5 }, (_, c) => `<path d="M${60 + c * 20} 56q-6 50 0 100"/>`).join('')}</g>`
  + `<path d="M100 44l-8-20h16z" fill="#3d2412"/>`);

ICONS['sirsak'] = wrap('刺果番荔枝',
  `<path d="M96 40c40 0 64 34 64 70s-30 52-64 52-58-20-58-54S56 40 96 40z" fill="#5d8f47"/>`
  + `<g fill="none" stroke="#3f6b30" stroke-width="4">${
    Array.from({ length: 12 }, (_, i) => `<path d="M${44 + (i % 4) * 32} ${64 + Math.floor(i / 4) * 30}l7-9 7 9"/>`).join('')}</g>`
  + `<path d="M96 40V22" stroke="#4a3218" stroke-width="9" stroke-linecap="round"/>`);

ICONS['belimbing'] = wrap('杨桃',
  `<path d="M100 22l20 50 54 8-38 38 10 54-46-28-46 28 10-54-38-38 54-8z" fill="#d8b12c"/>`
  + `<path d="M100 60v78" stroke="#a8871c" stroke-width="6" stroke-linecap="round" opacity=".7"/>`);

ICONS['kedondong'] = wrap('人面果',
  `<ellipse cx="100" cy="112" rx="50" ry="56" fill="#8fae3c"/>`
  + `<ellipse cx="84" cy="92" rx="14" ry="18" fill="#b3cc63" opacity=".7"/>`
  + `<path d="M100 56V30" stroke="#5a4326" stroke-width="8" stroke-linecap="round"/>`
  + `<path d="M100 40q22-14 34-2" fill="none" stroke="#4e7d3a" stroke-width="9" stroke-linecap="round"/>`);

ICONS['tahu'] = wrap('豆腐',
  `<path d="M40 78l60-26 60 26-60 26z" fill="#f2ead2"/>`
  + `<path d="M40 78v44l60 26v-44z" fill="#e0d5b4"/>`
  + `<path d="M160 78v44l-60 26v-44z" fill="#d0c39c"/>`);

ICONS['tempe'] = wrap('天贝',
  `<rect x="34" y="66" width="132" height="72" rx="12" fill="#e7dcc0"/>`
  + `<g fill="#b9a97f">${Array.from({ length: 12 }, (_, i) =>
    `<ellipse cx="${52 + (i % 4) * 32}" cy="${86 + Math.floor(i / 4) * 24}" rx="12" ry="8"/>`).join('')}</g>`
  + `<rect x="34" y="66" width="132" height="72" rx="12" fill="none" stroke="#8f8054" stroke-width="5"/>`);

ICONS['singkong'] = wrap('木薯',
  `<path d="M48 44c22-10 40 8 52 34s34 46 52 56c-14 16-36 14-56-6S66 88 42 76z" fill="#8a6b4a"/>`
  + `<path d="M56 60q34 22 66 68" fill="none" stroke="#6b5136" stroke-width="6" stroke-linecap="round"/>`);

ICONS['sagu'] = wrap('西米',
  `<path d="M46 96a54 54 0 0 1 108 0l-8 62H54z" fill="${PAPER}" stroke="${MOSS}" stroke-width="6"/>`
  + `<g fill="#d8d2bd">${Array.from({ length: 14 }, (_, i) =>
    `<circle cx="${66 + (i % 5) * 18}" cy="${110 + Math.floor(i / 5) * 18}" r="8"/>`).join('')}</g>`);

ICONS['arem-arem'] = wrap('馅心米卷',
  `<rect x="30" y="80" width="140" height="46" rx="23" fill="#4e7d3a"/>`
  + `<path d="M56 80v46M144 80v46" stroke="#3a5e2b" stroke-width="6"/>`
  + `<ellipse cx="100" cy="103" rx="14" ry="19" fill="#f2ead2"/>`);

ICONS['risoles'] = wrap('炸春卷饼',
  `<path d="M40 118l26-56h68l26 56z" fill="#d9a55a"/>`
  + `<rect x="40" y="112" width="120" height="34" rx="16" fill="#c98f42"/>`
  + `<g fill="#a8712c" opacity=".6">${[0, 1, 2, 3].map((i) => `<circle cx="${62 + i * 26}" cy="${96 + (i % 2) * 12}" r="5"/>`).join('')}</g>`);

ICONS['pempek'] = wrap('巨港鱼饼',
  `<ellipse cx="76" cy="106" rx="40" ry="34" fill="#e6d9b8"/>`
  + `<ellipse cx="138" cy="122" rx="28" ry="24" fill="#dccca6"/>`
  + `<path d="M30 152h140" stroke="#5b3a1c" stroke-width="10" stroke-linecap="round" opacity=".55"/>`);

ICONS['cilok'] = wrap('木薯粉丸',
  `<g fill="#b9b2a0">${[[70, 96], [116, 88], [94, 128], [136, 126]].map(([x, y]) =>
    `<circle cx="${x}" cy="${y}" r="24"/>`).join('')}</g>`
  + `<path d="M158 44L64 150" stroke="#8a6b4a" stroke-width="7" stroke-linecap="round"/>`);

ICONS['seblak'] = wrap('麻辣虾片汤',
  `<path d="M34 96h132l-12 52a18 18 0 0 1-18 14H64a18 18 0 0 1-18-14z" fill="#c0392b"/>`
  + `<path d="M26 92h148" stroke="${MOSS}" stroke-width="8" stroke-linecap="round"/>`
  + `<g stroke="#e8736a" stroke-width="6" stroke-linecap="round" fill="none">`
  + `<path d="M74 66q10-12 0-24"/><path d="M100 60q10-14 0-28"/><path d="M126 66q10-12 0-24"/></g>`);

ICONS['tempe mendoan'] = wrap('半熟炸天贝',
  `<path d="M32 78q34-16 68 0t68 0v40q-34 18-68 0t-68 0z" fill="#dcc98f"/>`
  + `<g fill="#b09a5c">${Array.from({ length: 8 }, (_, i) =>
    `<ellipse cx="${52 + (i % 4) * 32}" cy="${92 + Math.floor(i / 4) * 20}" rx="11" ry="7"/>`).join('')}</g>`
  + `<path d="M32 128q34 18 68 0t68 0" fill="none" stroke="#4e7d3a" stroke-width="7" stroke-linecap="round"/>`);


export { ICONS };

// ——————————————————————————————
// 写文件。文件名用词本身，空格与斜杠换成短横。
// ——————————————————————————————
export function fileNameFor(word) {
  return String(word).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const dir = join(dirname(fileURLToPath(import.meta.url)), '../assets/word-svg');
  mkdirSync(dir, { recursive: true });
  const map = {};
  for (const [word, svg] of Object.entries(ICONS)) {
    const name = fileNameFor(word);
    writeFileSync(join(dir, `${name}.svg`), svg);
    map[word.toLowerCase()] = name;
  }
  const lines = Object.entries(map).map(([k, v]) => `  '${k}': '${v}',`).join('\n');
  writeFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../lib/word-svg.js'),
    `// 词 → 自绘配图文件名。由 tools/build-word-svg.mjs 生成，不要手改。\n`
    + `// 这些词 OpenMoji 没有贴切的图形：要么没有实物（介词、连接词、程度副词），\n`
    + `// 要么是印尼特有的东西（榴莲、天贝、巨港鱼饼）。\n`
    + `export const WORD_SVG = {\n${lines}\n};\n`,
  );
  console.log(`自绘配图 ${Object.keys(map).length} 张 -> assets/word-svg/`);
}

