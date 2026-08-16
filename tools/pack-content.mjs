// 把明文内容加密打包成 data/<version>/*.enc + keys.json + manifest.json。
//
// 用法：
//   node tools/pack-content.mjs --password '你的密码' --version v1
//
// 换密码时必须同时提高版本号：本脚本每次都生成全新的 CEK 并重新加密全部内容。
// 只换 keys.json 而复用 CEK 是无效的 —— 保留旧 keys.json 的人用旧密码
// 仍能解出同一个 CEK，进而解开新数据。
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  generateCek, deriveKek, wrapCek, encryptJson, randomB64,
} from '../lib/crypto.js';

export const PBKDF2_ITERATIONS = 250000;

export async function buildBundle(content, password, version) {
  const cek = await generateCek();
  const salt = randomB64(16);
  const kek = await deriveKek(password, salt, PBKDF2_ITERATIONS);
  const { iv, wrapped } = await wrapCek(cek, kek);

  const files = {};
  for (const [name, value] of [
    ['packs.enc', content.packs],
    ['dialogs.enc', content.dialogs],
    ['grammar.enc', content.grammar],
  ]) {
    files[name] = await encryptJson(value, cek);
  }

  return {
    manifest: { contentVersion: version, builtAt: new Date().toISOString() },
    keys: {
      version,
      kdf: {
        name: 'PBKDF2',
        hash: 'SHA-256',
        salt,
        iterations: PBKDF2_ITERATIONS,
      },
      iv,
      wrapped,
    },
    files,
  };
}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const password = arg('password', process.env.CONTENT_PASSWORD);
  const version = arg('version', 'v1');

  if (!password) {
    console.error(
      '缺少密码。用法：node tools/pack-content.mjs --password <密码> --version v1',
    );
    process.exit(1);
  }

  const read = (f) =>
    JSON.parse(readFileSync(join(root, 'content-src', f), 'utf8'));
  const bundle = await buildBundle(
    {
      packs: read('packs.json'),
      dialogs: read('dialogs.json'),
      grammar: read('grammar.json'),
    },
    password,
    version,
  );

  mkdirSync(join(root, 'data', version), { recursive: true });
  writeFileSync(
    join(root, 'data/manifest.json'),
    JSON.stringify(bundle.manifest, null, 2),
  );
  writeFileSync(
    join(root, 'data/keys.json'),
    JSON.stringify(bundle.keys, null, 2),
  );
  for (const [name, payload] of Object.entries(bundle.files)) {
    writeFileSync(join(root, 'data', version, name), JSON.stringify(payload));
  }
  console.log(`打包完成 -> data/${version}/（packs, dialogs, grammar）`);
}
