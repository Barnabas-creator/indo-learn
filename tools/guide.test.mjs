import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guideSeen, markGuideSeen, GUIDE_SEEN_KEY } from '../lib/views/guide.js';

const memStore = () => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
};

test('没看过手册时返回 false，标记后返回 true', () => {
  const s = memStore();
  assert.equal(guideSeen(s), false);
  markGuideSeen(s);
  assert.equal(guideSeen(s), true);
  assert.equal(s.getItem(GUIDE_SEEN_KEY), '1');
});

// 隐私模式下 localStorage 的读写会直接抛。手册弹不弹是小事，
// 整个界面因此崩掉才是大事。
test('storage 抛错时不崩：当作没看过，写入失败也不抛', () => {
  const bad = {
    getItem() { throw new Error('denied'); },
    setItem() { throw new Error('denied'); },
    removeItem() { throw new Error('denied'); },
  };
  assert.equal(guideSeen(bad), false);
  assert.doesNotThrow(() => markGuideSeen(bad));
});
