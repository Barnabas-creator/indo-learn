import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBundle, PBKDF2_ITERATIONS } from './pack-content.mjs';
import { deriveKek, unwrapCek, decryptJson } from '../lib/crypto.js';

const CONTENT = {
  packs: [{ id: 'p1', title: '数字', subtitle: '1到10', theme: 'blue', words: [] }],
  dialogs: [{ id: 'd1', scene: 'Sapaan', sceneZh: '打招呼', lines: [] }],
  grammar: [{ id: 'g1', title: '词根与词缀', lessons: [] }],
};

test('产出 manifest 指向给定版本', async () => {
  const b = await buildBundle(CONTENT, '密码A', 'v1');
  assert.equal(b.manifest.contentVersion, 'v1');
});

test('keys.json 带 salt 与固定迭代次数', async () => {
  const b = await buildBundle(CONTENT, '密码A', 'v1');
  assert.equal(b.keys.kdf.iterations, PBKDF2_ITERATIONS);
  assert.ok(b.keys.kdf.salt.length > 0);
});

test('三个内容文件都被加密', async () => {
  const b = await buildBundle(CONTENT, '密码A', 'v1');
  assert.deepEqual(Object.keys(b.files).sort(), [
    'dialogs.enc', 'grammar.enc', 'packs.enc',
  ]);
});

test('用正确密码可还原内容', async () => {
  const b = await buildBundle(CONTENT, '密码A', 'v1');
  const kek = await deriveKek('密码A', b.keys.kdf.salt, b.keys.kdf.iterations);
  const cek = await unwrapCek(b.keys.wrapped, b.keys.iv, kek);
  const packs = await decryptJson(
    b.files['packs.enc'].data,
    b.files['packs.enc'].iv,
    cek,
  );
  assert.deepEqual(packs, CONTENT.packs);
});

test('错误密码无法还原', async () => {
  const b = await buildBundle(CONTENT, '密码A', 'v1');
  const kek = await deriveKek('密码B', b.keys.kdf.salt, b.keys.kdf.iterations);
  await assert.rejects(() => unwrapCek(b.keys.wrapped, b.keys.iv, kek));
});

test('换密码时同时换 CEK —— 旧密码解不开新包', async () => {
  const v1 = await buildBundle(CONTENT, '密码A', 'v1');
  const v2 = await buildBundle(CONTENT, '密码B', 'v2');

  const oldKek = await deriveKek('密码A', v1.keys.kdf.salt, v1.keys.kdf.iterations);
  const oldCek = await unwrapCek(v1.keys.wrapped, v1.keys.iv, oldKek);

  await assert.rejects(() =>
    decryptJson(v2.files['packs.enc'].data, v2.files['packs.enc'].iv, oldCek),
  );
});
