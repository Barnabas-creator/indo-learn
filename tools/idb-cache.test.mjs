import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createUnitCache } from '../lib/idb-cache.js';

// 内存假仓库：IndexedDB 在 Node 里没有实现，注入一个同接口的 Map 就够测逻辑。
function memStore() {
  const m = new Map();
  return {
    m,
    async get(k) { return m.get(k); },
    async put(k, v) { m.set(k, v); },
    async clear() { m.clear(); },
  };
}

test('存进去能取出来', async () => {
  const store = memStore();
  const cache = createUnitCache({ openDb: async () => store });
  await cache.put('packs/p-1', [{ w: 'satu' }]);
  assert.deepEqual(await cache.get('packs/p-1'), [{ w: 'satu' }]);
});

test('没存过的键取到 undefined，不抛错', async () => {
  const cache = createUnitCache({ openDb: async () => memStore() });
  assert.equal(await cache.get('packs/nope'), undefined);
});

test('版本变了就清空整库——逐条比对不值当', async () => {
  const store = memStore();
  const cache = createUnitCache({ openDb: async () => store });
  await cache.setMeta('c1');
  await cache.put('packs/p-1', 1);
  await cache.setMeta('c2');
  assert.equal(await cache.get('packs/p-1'), undefined);
  assert.equal(await cache.getMeta(), 'c2');
});

test('版本没变时不清空', async () => {
  const store = memStore();
  const cache = createUnitCache({ openDb: async () => store });
  await cache.setMeta('c1');
  await cache.put('packs/p-1', 1);
  await cache.setMeta('c1');
  assert.equal(await cache.get('packs/p-1'), 1);
});

test('打不开数据库时退化成不缓存，而不是整个应用挂掉', async () => {
  const cache = createUnitCache({ openDb: async () => { throw new Error('no idb'); } });
  await cache.put('packs/p-1', 1);          // 不抛
  assert.equal(await cache.get('packs/p-1'), undefined);
});

// 打不开数据库这件事应该只发现一次：openDb 抛错后 dead 标记生效，
// 后面所有调用直接空转，不会每次都重新尝试连接（重试意味着每次读写都多一轮失败的 I/O）。
test('打不开数据库只重试一次，之后的调用不再触发 openDb', async () => {
  let calls = 0;
  const cache = createUnitCache({
    openDb: async () => { calls += 1; throw new Error('no idb'); },
  });
  await cache.get('packs/p-1');
  await cache.put('packs/p-1', 1);
  await cache.getMeta();
  await cache.setMeta('c1');
  await cache.clear();
  assert.equal(calls, 1);
});

// 配额满等运行时错误：get/put/getMeta/setMeta/clear 各自都不该把仓库的异常
// 甩给调用方——缓存失败不该拖垮读单元这条主链路。
test('仓库读写抛异常时各接口都吞掉，不往外抛', async () => {
  const badStore = {
    async get() { throw new Error('boom'); },
    async put() { throw new Error('boom'); },
    async clear() { throw new Error('boom'); },
  };
  const cache = createUnitCache({ openDb: async () => badStore });
  await assert.doesNotReject(cache.get('packs/p-1'));
  assert.equal(await cache.get('packs/p-1'), undefined);
  await assert.doesNotReject(cache.put('packs/p-1', 1));
  await assert.doesNotReject(cache.getMeta());
  assert.equal(await cache.getMeta(), undefined);
  await assert.doesNotReject(cache.setMeta('c1'));
  await assert.doesNotReject(cache.clear());
});

// 版本切换时必须先清库、再落新版本号——顺序反了的话，如果清库这一步失败
// （比如配额/权限问题），仓库里会留下「版本号已经是新的，但内容还是旧的」这种
// 不一致状态，之后 get 会把旧内容当成新版本的内容吐出来。
test('setMeta 先清库再写新版本号：清库失败时新版本号不落地', async () => {
  const store = memStore();
  const cache = createUnitCache({ openDb: async () => store });
  await cache.setMeta('c1');        // 首次落版本号，clear 正常
  await cache.put('packs/p-1', 1);  // 存一条内容
  store.clear = async () => { throw new Error('quota'); }; // 之后清库开始失败
  await cache.setMeta('c2');        // 触发 clear（版本变了），clear 抛错
  // 清库失败 -> 整个 setMeta 走进 catch，新版本号没有落地，旧数据也还在
  // （没有变成"版本号是 c2 但内容其实是旧的"这种不一致态）。
  assert.equal(await cache.getMeta(), 'c1');
  assert.equal(store.m.get('packs/p-1'), 1);
});

// 直接验证调用顺序：clear 必须发生在新版本号的 put 之前。
test('setMeta 内部调用顺序是先 clear 后 put', async () => {
  const store = memStore();
  const order = [];
  const realClear = store.clear.bind(store);
  const realPut = store.put.bind(store);
  store.clear = async () => { order.push('clear'); return realClear(); };
  store.put = async (k, v) => { order.push(`put:${k}`); return realPut(k, v); };
  const cache = createUnitCache({ openDb: async () => store });
  await cache.setMeta('c1'); // 首次：old undefined !== 'c1'，触发 clear
  assert.deepEqual(order, ['clear', 'put:__version']);
});
