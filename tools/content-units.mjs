// 把六个模块的内容切成「用户一次点开要看的东西」。
//
// 粒度不按文件现在怎么存定：语法一个模块 38KB，切到课一级只是让翻课时多几十个
// 请求，防拷贝上也没多挡什么。listening 整块才 12KB，切了没意义。
//
// 词包和词根包的标题留空——它们在 lib/catalog.js 里已经是明文，清单不必重复一遍。

// 各模块怎么取单元 id 和标题。加模块时只改这张表。
const SHAPES = {
  packs: { kind: 'map', title: () => null },
  roots: { kind: 'list', title: () => null },
  dialogs: { kind: 'list', title: (x) => x.sceneZh ?? null },
  grammar: { kind: 'list', title: (x) => x.title ?? null },
  course: { kind: 'list', title: (x) => x.titleZh ?? null },
  listening: { kind: 'whole', title: () => null },
};

export function splitIntoUnits(content, freeIds = {}) {
  const units = [];
  for (const [module, shape] of Object.entries(SHAPES)) {
    const value = content[module];
    if (value === undefined) continue;
    const free = new Set(freeIds[module] ?? []);
    const push = (unitId, body, title) => {
      units.push({ module, unitId, tier: free.has(unitId) ? 'free' : 'paid', title, body });
    };

    if (shape.kind === 'whole') push('all', value, null);
    else if (shape.kind === 'map') {
      for (const [id, body] of Object.entries(value)) push(id, body, shape.title(body));
    } else {
      for (const item of value) push(item.id, item, shape.title(item));
    }
  }
  return units;
}
