import { test } from 'node:test';
import assert from 'node:assert/strict';
import { packsWithStatus, levelCountsFrom } from '../lib/catalog-view.js';

const CATALOG = {
  beginner: [{ id: 'p-1', title: '数字' }, { id: 'p-2', title: '饮料' }],
};
const INDEX = { packs: [{ id: 'p-1', tier: 'free' }] };

test('清单里有的包算开放，没有的算准备中', () => {
  const packs = packsWithStatus(CATALOG.beginner, INDEX);
  assert.deepEqual(packs.map((p) => p.open), [true, false]);
});

test('序号按骨架顺序编，含准备中的包', () => {
  assert.deepEqual(packsWithStatus(CATALOG.beginner, INDEX).map((p) => p.no), ['01', '02']);
});

test('tier 带出来，UI 才知道要不要挂锁', () => {
  assert.equal(packsWithStatus(CATALOG.beginner, INDEX)[0].tier, 'free');
});

test('清单里没有的包 tier 给 null，不是 undefined——UI 判断挂不挂锁不用再多写一层 ?? ', () => {
  assert.equal(packsWithStatus(CATALOG.beginner, INDEX)[1].tier, null);
});

test('分级计数按开放数/总数', () => {
  assert.deepEqual(
    levelCountsFrom({ beginner: CATALOG.beginner }, INDEX),
    { beginner: { open: 1, total: 2 } },
  );
});

test('清单为空时全部准备中，不抛错', () => {
  assert.deepEqual(packsWithStatus(CATALOG.beginner, {}).map((p) => p.open), [false, false]);
});

test('清单对象里没有 packs 字段（不是空对象也不是数组）时同样不抛错', () => {
  assert.deepEqual(packsWithStatus(CATALOG.beginner, { modules: {} }).map((p) => p.open), [false, false]);
});

test('骨架为空数组时返回空数组', () => {
  assert.deepEqual(packsWithStatus([], INDEX), []);
});

test('清单里多出骨架没有的 id，不会凭空多出一个包', () => {
  const index = { packs: [{ id: 'p-1', tier: 'free' }, { id: 'p-999', tier: 'paid' }] };
  const packs = packsWithStatus(CATALOG.beginner, index);
  assert.equal(packs.length, 2);
  assert.deepEqual(packs.map((p) => p.id), ['p-1', 'p-2']);
});

test('levelCountsFrom 按级分别计数，互不影响', () => {
  const packsByLevel = {
    beginner: CATALOG.beginner,
    intermediate: [{ id: 'q-1', title: '天气' }],
  };
  const index = { packs: [{ id: 'p-1', tier: 'free' }] }; // intermediate 的 q-1 不在清单里
  assert.deepEqual(levelCountsFrom(packsByLevel, index), {
    beginner: { open: 1, total: 2 },
    intermediate: { open: 0, total: 1 },
  });
});

test('levelCountsFrom 传空对象时返回空对象', () => {
  assert.deepEqual(levelCountsFrom({}, INDEX), {});
});
