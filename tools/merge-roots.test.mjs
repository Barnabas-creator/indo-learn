import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeRoots } from './merge-roots.mjs';

const pack = (id) => ({ id, title: id, subtitle: '', words: [] });

test('多个文件按文件名顺序合并', () => {
  const out = mergeRoots([
    ['roots-01.json', [pack('root-01')]],
    ['roots-02.json', [pack('root-02')]],
  ]);
  assert.deepEqual(out.map((p) => p.id), ['root-01', 'root-02']);
});

test('编号按合并后的位置补两位，跟屏幕上看到的一致', () => {
  const out = mergeRoots([
    ['roots-01.json', [pack('a'), pack('b')]],
    ['roots-02.json', [pack('c')]],
  ]);
  assert.deepEqual(out.map((p) => p.no), ['01', '02', '03']);
});

test('id 重复时两份都保留，交给校验去报错', () => {
  const out = mergeRoots([
    ['roots-01.json', [pack('a')]],
    ['roots-02.json', [pack('a')]],
  ]);
  assert.equal(out.length, 2);
});
