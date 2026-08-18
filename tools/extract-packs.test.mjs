import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePackSkeleton } from './extract-packs.mjs';

const SAMPLE = `
  wordPackCards: [
    { id: "freq-beginner-002", title: "饮料", subtitle: "水茶咖啡", total: 10,
      added: 0, icon: "/images/home/icon-pack-daily.svg", theme: "blue",
      category: "beginner", level: "beginner", stage: 2 },
    { id: "freq-beginner-001", title: "数字", subtitle: "1到10", total: 10,
      added: 0, icon: "/images/home/icon-pack-daily.svg", theme: "blue",
      category: "beginner", level: "beginner", stage: 1 },
    { id: "freq-inter-001", title: "人际", subtitle: "亲友关系", total: 10,
      added: 0, icon: "/images/home/icon-pack-daily.svg", theme: "blue",
      category: "intermediate", level: "intermediate", stage: 1 },
  ],
`;

test('默认提取全部三级', () => {
  const out = parsePackSkeleton(SAMPLE);
  assert.equal(out.length, 3);
  assert.deepEqual(out.map((p) => p.level), ['beginner', 'beginner', 'intermediate']);
});

test('给了 level 只提取那一级', () => {
  const out = parsePackSkeleton(SAMPLE, 'intermediate');
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 'freq-inter-001');
});

test('同级内按 stage 升序排列', () => {
  const out = parsePackSkeleton(SAMPLE, 'beginner');
  assert.deepEqual(out.map((p) => p.stage), [1, 2]);
  assert.equal(out[0].title, '数字');
  assert.equal(out[0].subtitle, '1到10');
});

test('保留 theme 字段', () => {
  const out = parsePackSkeleton(SAMPLE)[0];
  assert.equal(out.theme, 'blue');
});
