import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeCourse } from './merge-course.mjs';

const UNITS = [
  { id: 'u01', number: '01', title: 'Menyapa', titleZh: '打招呼', goal: 'g' },
  { id: 'u02', number: '02', title: 'Berkenalan', titleZh: '认识', goal: 'g' },
];
const lesson = (id, unit, order) => ({ id, unit, order, title: id, words: [], scene: {}, points: [], quiz: [] });

test('按课的 unit 字段归位', () => {
  const out = mergeCourse(UNITS, [
    ['a.json', [lesson('u01l1', 'u01', '01'), lesson('u02l1', 'u02', '01')]],
  ]);
  assert.deepEqual(out.map((u) => u.id), ['u01', 'u02']);
  assert.deepEqual(out[0].lessons.map((l) => l.id), ['u01l1']);
});

test('单元内按 order 排，不看文件里的顺序', () => {
  const out = mergeCourse(UNITS, [
    ['a.json', [lesson('c', 'u01', '03'), lesson('a', 'u01', '01'), lesson('b', 'u01', '02')]],
  ]);
  assert.deepEqual(out[0].lessons.map((l) => l.id), ['a', 'b', 'c']);
});

// 还没写的单元不该在 UI 上占一行「0 课」。
test('没有课的单元不输出', () => {
  const out = mergeCourse(UNITS, [['a.json', [lesson('x', 'u01', '01')]]]);
  assert.deepEqual(out.map((u) => u.id), ['u01']);
});

test('unit 对不上任何单元的课被跳过，不会混进别的单元', () => {
  const out = mergeCourse(UNITS, [
    ['a.json', [lesson('ok', 'u01', '01'), lesson('bad', 'u99', '01'), lesson('none', undefined, '01')]],
  ]);
  assert.deepEqual(out[0].lessons.map((l) => l.id), ['ok']);
  assert.equal(out.length, 1);
});
