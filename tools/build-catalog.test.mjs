import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCatalogSource } from './build-catalog.mjs';

const SKELETON = [
  { id: 'b1', level: 'beginner', title: '数字', subtitle: '1到10', stage: 1 },
  { id: 'i1', level: 'intermediate', title: '人际', subtitle: '亲友关系', stage: 1 },
];

test('三级都出现在 PACKS 里，空的一级也留位置', () => {
  const src = buildCatalogSource(SKELETON);
  assert.match(src, /beginner: \[\n\s+\{ id: "b1"/);
  assert.match(src, /intermediate: \[\n\s+\{ id: "i1"/);
  assert.match(src, /advanced: \[/);
});

test('骨架不带 ready 标志：开放与否看有没有词条', () => {
  assert.doesNotMatch(buildCatalogSource(SKELETON), /ready/);
});
