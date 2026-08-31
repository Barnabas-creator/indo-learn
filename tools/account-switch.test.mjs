import { test } from 'node:test';
import assert from 'node:assert/strict';
import { refreshContentIndex, resetNavState } from '../lib/catalog-view.js';

// 回归测：review round 1 发现 app.js 里的 packWords 内存 Map 登出不清，
// 会把 Task 8 刚堵上的「跨账号读到缓存正文」漏洞在内存层重现一遍。
// app.js 本身没有测试（不引 jsdom），所以把「刷新清单要顺带清空词包缓存」
// 和「登出要归零导航状态」这两条抽成纯函数单测，app.js 里的调用点只是
// 薄薄一层转发（loadContentIndex / endSession），靠代码读一眼就能对上。

test('refreshContentIndex 清完 packWords 才去请求新清单，不是请求成功后才清', async () => {
  const packWords = new Map([['p-1', ['word-from-account-a']]]);
  let clearedBeforeFetch = false;
  const index = { modules: { packs: [] } };
  const getIndex = async () => {
    clearedBeforeFetch = packWords.size === 0; // 请求发出的那一刻，缓存应该已经空了
    return index;
  };
  const result = await refreshContentIndex({ getIndex, packWords });
  assert.equal(clearedBeforeFetch, true);
  assert.equal(result, index);
  assert.equal(packWords.size, 0);
});

test('getIndex 请求失败时 packWords 依然是空的——不会因为刷新失败就残留旧账号的词包', async () => {
  const packWords = new Map([['p-1', ['word-from-account-a']]]);
  await assert.rejects(
    () => refreshContentIndex({ getIndex: async () => { throw new Error('offline_uncached'); }, packWords }),
    /offline_uncached/,
  );
  assert.equal(packWords.size, 0);
});

test('refreshContentIndex 不清空以外的 Map 内容——只认自己拿到的那个 packWords 引用', async () => {
  const packWords = new Map();
  const other = new Map([['keep', 1]]); // 确认函数没有误清全局状态，只动传进去的那个
  await refreshContentIndex({ getIndex: async () => ({ modules: {} }), packWords });
  assert.deepEqual([...other.entries()], [['keep', 1]]);
});

test('resetNavState 回到首页，且不带着上一个账号停留的分级/包 id', () => {
  assert.deepEqual(resetNavState(), { view: 'home', level: null, packId: null });
});

test('resetNavState 每次都给一份新对象——调用方各自解构赋值，互不干扰', () => {
  assert.notEqual(resetNavState(), resetNavState());
});
