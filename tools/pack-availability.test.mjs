import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  packsWithStatus, levelCountsFrom, needsUnlock, canSeePaidLocally, categoryLocked,
} from '../lib/catalog-view.js';

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

// 11.5：判定口径要跟服务端 server/src/content.js 的 handleContentUnit 里
// 那段账号判定逐条对齐——两处不一致会让 UI 上的锁和实际能不能取到内容对不上。
// 试用期边界用同一个比较方向：trialEndsAt > now（服务端是
// account.trial_ends_at > now），「还没到期」才算能看，不是「不晚于」。
const NOW = 1_000_000;

test('canSeePaidLocally：active 账号能看付费内容', () => {
  assert.equal(canSeePaidLocally({ status: 'active', trialEndsAt: null }, NOW), true);
});

test('canSeePaidLocally：试用期内（trialEndsAt 还没到）能看', () => {
  assert.equal(canSeePaidLocally({ status: 'trial', trialEndsAt: NOW + 1 }, NOW), true);
});

test('canSeePaidLocally：试用过期（trialEndsAt 已过）不能看', () => {
  assert.equal(canSeePaidLocally({ status: 'trial', trialEndsAt: NOW - 1 }, NOW), false);
});

// 边界：恰好等于 now 算已过期（跟服务端 trial_ends_at > now 的严格大于同一个方向）。
test('canSeePaidLocally：trialEndsAt 恰好等于 now 算过期，不能看', () => {
  assert.equal(canSeePaidLocally({ status: 'trial', trialEndsAt: NOW }, NOW), false);
});

test('canSeePaidLocally：pending 账号不能看', () => {
  assert.equal(canSeePaidLocally({ status: 'pending', trialEndsAt: null }, NOW), false);
});

test('canSeePaidLocally：disabled 账号不能看', () => {
  assert.equal(canSeePaidLocally({ status: 'disabled', trialEndsAt: null }, NOW), false);
});

test('canSeePaidLocally：无账号（undefined/空对象）不能看，不崩', () => {
  assert.equal(canSeePaidLocally(undefined, NOW), false);
  assert.equal(canSeePaidLocally({}, NOW), false);
});

test('needsUnlock：paid 且无权限要锁', () => {
  assert.equal(needsUnlock({ tier: 'paid' }, undefined, NOW), true);
});

test('needsUnlock：paid 但账号 active 不锁', () => {
  assert.equal(needsUnlock({ tier: 'paid' }, { status: 'active', trialEndsAt: null }, NOW), false);
});

test('needsUnlock：free 单元无账号也不锁', () => {
  assert.equal(needsUnlock({ tier: 'free' }, undefined, NOW), false);
});

// 准备中的包（清单里没有这个 id）tier 是 null，不是 'paid'——不当成要解锁，
// 它是另一种状态（灰、点不动），跟「需登录」不能混成同一种视觉。
test('准备中的包（清单里没有，tier 为 null）不当成要解锁', () => {
  assert.equal(needsUnlock({ tier: null, open: false }, undefined, NOW), false);
});

test('needsUnlock 传 undefined 不崩——unit 缺失时的兜底', () => {
  assert.equal(needsUnlock(undefined, undefined, NOW), false);
  assert.equal(needsUnlock({}, undefined, NOW), false);
});

// categoryLocked：听力/对话分类卡用的整类判定——一类里所有条目都要登录才算
// 整个分类锁住；只要有一条免费，分类卡本身仍可点，锁留给列表里逐条挂
// （dialogs.js 已经在列表层做了，这里不重复判「部分锁」）。
test('categoryLocked：全部条目都要登录时，整个分类算锁住', () => {
  const units = [{ tier: 'paid' }, { tier: 'paid' }];
  assert.equal(categoryLocked(units, undefined, NOW), true);
});

test('categoryLocked：只要有一条免费或账号能看，分类就不算锁住', () => {
  const mixed = [{ tier: 'paid' }, { tier: 'free' }];
  assert.equal(categoryLocked(mixed, undefined, NOW), false);
  const allPaidButActive = [{ tier: 'paid' }, { tier: 'paid' }];
  assert.equal(categoryLocked(allPaidButActive, { status: 'active', trialEndsAt: null }, NOW), false);
});

test('categoryLocked：空数组或缺失不算锁住（那是「准备中」，不是「需登录」）', () => {
  assert.equal(categoryLocked([], undefined, NOW), false);
  assert.equal(categoryLocked(undefined, undefined, NOW), false);
});
