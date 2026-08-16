import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateCek, deriveKek, wrapCek, unwrapCek,
  encryptJson, decryptJson, randomB64, exportCek, importCek,
} from '../lib/crypto.js';

test('往返加解密还原原对象', async () => {
  const cek = await generateCek();
  const payload = { packs: [{ id: 'p1', words: ['satu', 'dua'] }] };
  const { iv, data } = await encryptJson(payload, cek);
  assert.deepEqual(await decryptJson(data, iv, cek), payload);
});

test('每次加密的 IV 都不同', async () => {
  const cek = await generateCek();
  const a = await encryptJson({ x: 1 }, cek);
  const b = await encryptJson({ x: 1 }, cek);
  assert.notEqual(a.iv, b.iv);
  assert.notEqual(a.data, b.data);
});

test('正确密码可以解出 CEK，且能解密内容', async () => {
  const cek = await generateCek();
  const salt = randomB64(16);
  const kek = await deriveKek('正确密码', salt, 250000);
  const { iv, wrapped } = await wrapCek(cek, kek);

  const kek2 = await deriveKek('正确密码', salt, 250000);
  const cek2 = await unwrapCek(wrapped, iv, kek2);

  const enc = await encryptJson({ ok: true }, cek);
  assert.deepEqual(await decryptJson(enc.data, enc.iv, cek2), { ok: true });
});

test('错误密码解 CEK 时抛异常', async () => {
  const cek = await generateCek();
  const salt = randomB64(16);
  const kek = await deriveKek('正确密码', salt, 250000);
  const { iv, wrapped } = await wrapCek(cek, kek);

  const bad = await deriveKek('错误密码', salt, 250000);
  await assert.rejects(() => unwrapCek(wrapped, iv, bad));
});

test('CEK 可导出再导入，仍能解密', async () => {
  const cek = await generateCek();
  const enc = await encryptJson({ v: 42 }, cek);
  const restored = await importCek(await exportCek(cek));
  assert.deepEqual(await decryptJson(enc.data, enc.iv, restored), { v: 42 });
});
