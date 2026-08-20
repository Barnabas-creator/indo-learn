import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hashPassword, verifyPassword, signToken, verifyToken, TOKEN_TTL_MS,
} from './crypto.js';

test('同一密码配同一盐得到同一哈希', async () => {
  const a = await hashPassword('rahasia123');
  const b = await hashPassword('rahasia123', a.salt);
  assert.equal(b.hash, a.hash);
});

test('每次不给盐都生成新盐', async () => {
  const a = await hashPassword('rahasia123');
  const b = await hashPassword('rahasia123');
  assert.notEqual(a.salt, b.salt);
  assert.notEqual(a.hash, b.hash);
});

test('密码正确校验通过，错误不通过', async () => {
  const { hash, salt } = await hashPassword('rahasia123');
  assert.equal(await verifyPassword('rahasia123', hash, salt), true);
  assert.equal(await verifyPassword('salah', hash, salt), false);
});

test('令牌能签发并解回账号 id', async () => {
  const token = await signToken(42, 'secret-kunci');
  assert.equal(await verifyToken(token, 'secret-kunci'), 42);
});

test('换了密钥的令牌无效', async () => {
  const token = await signToken(42, 'secret-kunci');
  assert.equal(await verifyToken(token, 'kunci-lain'), null);
});

test('过期令牌无效', async () => {
  const token = await signToken(42, 'secret-kunci', 0);
  assert.equal(await verifyToken(token, 'secret-kunci', TOKEN_TTL_MS + 1), null);
});

test('被改过的令牌无效', async () => {
  const token = await signToken(42, 'secret-kunci');
  const tampered = token.slice(0, -2) + (token.endsWith('a') ? 'b' : 'a');
  assert.equal(await verifyToken(tampered, 'secret-kunci'), null);
});
