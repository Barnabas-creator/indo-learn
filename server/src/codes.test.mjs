import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateCode, normalizeCode, hashCode, CODE_ALPHABET } from './codes.js';

test('生成的码是四组四位，用短横分隔', () => {
  assert.match(generateCode(), /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
});

test('字母表不含易混字符', () => {
  for (const ch of '01IOL') assert.ok(!CODE_ALPHABET.includes(ch), `不该含 ${ch}`);
});

test('两次生成不重复', () => {
  assert.notEqual(generateCode(), generateCode());
});

test('规范化去掉横线空格并转大写', () => {
  assert.equal(normalizeCode(' abcd-efgh jkmn-pqrs '), 'ABCDEFGHJKMNPQRS');
});

test('同一个码不同写法哈希相同', async () => {
  const a = await hashCode('ABCD-EFGH-JKMN-PQRS');
  const b = await hashCode('abcdefghjkmnpqrs');
  assert.equal(a, b);
});

test('不同码哈希不同', async () => {
  assert.notEqual(await hashCode('ABCD-EFGH-JKMN-PQRS'), await hashCode('ABCD-EFGH-JKMN-PQRT'));
});
