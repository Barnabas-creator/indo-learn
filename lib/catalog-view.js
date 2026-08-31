// 「这个包开放了没有」以前看 wordsByPack 里有没有词条——那要求先把全部词条拉到手。
// 现在看清单：清单里有这个 id 就是开放，没有就是准备中。UI 表现不变。
export function packsWithStatus(skeletonPacks, index) {
  const known = new Map((index.packs ?? []).map((u) => [u.id, u]));
  return skeletonPacks.map((p, i) => ({
    ...p,
    no: String(i + 1).padStart(2, '0'),
    open: known.has(p.id),
    tier: known.get(p.id)?.tier ?? null,
  }));
}

export function levelCountsFrom(packsByLevel, index) {
  const out = {};
  for (const [level, packs] of Object.entries(packsByLevel)) {
    const withStatus = packsWithStatus(packs, index);
    out[level] = { open: withStatus.filter((p) => p.open).length, total: withStatus.length };
  }
  return out;
}
