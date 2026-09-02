// 把六个模块的内容切成「用户一次点开要看的东西」。
//
// 粒度不按文件现在怎么存定：语法一个模块 38KB，切到课一级只是让翻课时多几十个
// 请求，防拷贝上也没多挡什么。listening 整块才 12KB，切了没意义。
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
// dialogs 看 lines，packs 看词条数组本身，listening 看整个数组。
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
  // whole 型传给 meta 的是整个模块的数组（跟 body 是同一个东西），count 就是数组长度。
  // isEmpty 看的也是这整个数组：listening 只有一个 all 单元，数组空了这一个单元就该
  // 整个不进清单，不是进去了再显示「0 段」。
  listening: {
    kind: 'whole', title: () => null, meta: (arr) => ({ count: arr.length }), isEmpty: (arr) => (arr ?? []).length === 0,
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
