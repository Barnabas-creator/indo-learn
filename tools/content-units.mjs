// 把六个模块的内容切成「用户一次点开要看的东西」。
//
// 粒度不按文件现在怎么存定：语法一个模块 38KB，切到课一级只是让翻课时多几十个
// 请求，防拷贝上也没多挡什么。listening 按段切是例外——不是图请求数好看，是
// 整块撑到 144.6KB 会超 D1 单条 INSERT 的上限（见下面 listening 那条注释）。
//
// 词包和词根包的标题留空——它们在 lib/catalog.js 里已经是明文，清单不必重复一遍。

// 各模块怎么取单元 id、标题、meta、以及「这个单元算不算空」。加模块时只改这张表。
//
// meta 只装列表页看得见的小字段（课数、轮数、副标题……），绝不能装正文——
// 传给 title/meta 的参数跟存成 u.body 的是同一个东西，所以每条 meta 取值
// 都要显式挑字段、挑长度，不能整个对象转手倒过去。
//
// isEmpty 判「这个单元有没有内容可学」——course.json 里 u202–u212 这批单元
// 是占位（lessons 是空数组，书还没写），以前不管有没有内容一律进清单，
// 「清单里有这个 id」对这些单元根本不成立为「能学」：点进去只会看到一个空
// 课列表，不崩，但是个死路。isEmpty 为 true 的单元不进清单——这样「清单里
// 有没有这个 id」重新成为「开放与否」唯一可靠的依据，词包那套
// packsWithStatus「有就是开放、没有就是准备中」的语义对所有模块统一了。
// 判定按各模块的实际形状来：course/grammar 看 lessons，roots 看 words，
// dialogs 看 lines，packs 看词条数组本身，listening 看每一段自己的 lines。
const SHAPES = {
  packs: { kind: 'map', title: () => null, meta: () => null, isEmpty: (words) => (words ?? []).length === 0 },
  // 词根包没有 lib/catalog.js 那样的明文骨架，标题不给列表页就是空白卡片。
  roots: {
    kind: 'list',
    title: (x) => x.title ?? null,
    meta: (x) => ({ subtitle: x.subtitle ?? null, count: (x.words ?? []).length }),
    isEmpty: (x) => (x.words ?? []).length === 0,
  },
  dialogs: {
    kind: 'list',
    title: (x) => x.sceneZh ?? null,
    meta: (x) => ({ scene: x.scene ?? null, rounds: (x.lines ?? []).length }),
    isEmpty: (x) => (x.lines ?? []).length === 0,
  },
  grammar: {
    kind: 'list',
    title: (x) => x.title ?? null,
    meta: (x) => ({
      number: x.number ?? null, subtitle: x.subtitle ?? null, visual: x.visual ?? null,
      lessons: (x.lessons ?? []).length,
    }),
    isEmpty: (x) => (x.lessons ?? []).length === 0,
  },
  // meta.title 是印尼语原名（item.title），跟单元的中文 title（item.titleZh）分开放，
  // 列表页两个都要显示。
  course: {
    kind: 'list',
    title: (x) => x.titleZh ?? null,
    meta: (x) => ({
      number: x.number ?? null, title: x.title ?? null, goal: x.goal ?? null, level: x.level ?? null,
      lessons: (x.lessons ?? []).length,
    }),
    isEmpty: (x) => (x.lessons ?? []).length === 0,
  },
  // 曾经是 whole 型（整个模块揉成一个 unitId:'all' 的单元）：A1 教材听力从 3 段
  // 扩到 33 段后，这一个单元撑到 144.6KB，单条 INSERT 超了 D1 的 SQLITE_TOOBIG
  // 上限。改成按段切——一段 3~6KB，安全，而且「单元 = 用户一次点开要看的东西」
  // 这套架构原则下，一段听力本来就该是一个单元，跟对话/语法/教材同一个「list」
  // 路子，不用给切分逻辑加新分支。
  //
  // meta 摊平 unitZh/code/seconds：列表页要按课（unitZh）分组、显示教材编号
  // 和时长，这三样以前混在正文里，现在从清单直接摊平出来，不用为了分组先把
  // 33 段正文全取一遍。
  listening: {
    kind: 'list',
    title: (x) => x.titleZh ?? null,
    meta: (x) => ({ unitZh: x.unitZh ?? null, code: x.code ?? null, seconds: x.seconds ?? null }),
    isEmpty: (x) => (x.lines ?? []).length === 0,
  },
};

export function splitIntoUnits(content, freeIds = {}) {
  const units = [];
  for (const [module, shape] of Object.entries(SHAPES)) {
    const value = content[module];
    if (value === undefined) continue;
    const free = new Set(freeIds[module] ?? []);
    const push = (unitId, body, title, meta) => {
      units.push({
        module, unitId, tier: free.has(unitId) ? 'free' : 'paid', title, body, meta,
      });
    };

    if (shape.kind === 'whole') {
      if (!shape.isEmpty(value)) push('all', value, null, shape.meta(value));
    } else if (shape.kind === 'map') {
      for (const [id, body] of Object.entries(value)) {
        if (shape.isEmpty(body)) continue;
        push(id, body, shape.title(body), shape.meta(body));
      }
    } else {
      for (const item of value) {
        if (shape.isEmpty(item)) continue;
        push(item.id, item, shape.title(item), shape.meta(item));
      }
    }
  }
  return units;
}
