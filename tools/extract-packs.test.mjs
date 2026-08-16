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

test('只提取初级包', () => {
  const out = parsePackSkeleton(SAMPLE);
  assert.equal(out.length, 2);
  assert.ok(out.every((p) => p.id.startsWith('freq-beginner-')));
});

test('按 stage 升序排列', () => {
  const out = parsePackSkeleton(SAMPLE);
  assert.deepEqual(out.map((p) => p.stage), [1, 2]);
  assert.equal(out[0].title, '数字');
  assert.equal(out[0].subtitle, '1到10');
});

test('保留 theme 字段', () => {
  const out = parsePackSkeleton(SAMPLE);
  assert.equal(out[0].theme, 'blue');
});
