// AES-GCM / PBKDF2 原语。同一份代码在浏览器和 Node 打包脚本中共用。

const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder();
const dec = new TextDecoder();

const IV_BYTES = 12;

function toB64(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(b64) {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

export function randomB64(bytes) {
  return toB64(globalThis.crypto.getRandomValues(new Uint8Array(bytes)));
}

export function generateCek() {
  return subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
}

export async function exportCek(cek) {
  return toB64(await subtle.exportKey('raw', cek));
}

export function importCek(b64) {
  return subtle.importKey('raw', fromB64(b64), { name: 'AES-GCM' }, true, [
    'encrypt',
    'decrypt',
  ]);
}

export async function deriveKek(password, saltB64, iterations) {
  const base = await subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: fromB64(saltB64),
      iterations,
      hash: 'SHA-256',
    },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey', 'unwrapKey'],
  );
}

export async function wrapCek(cek, kek) {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const wrapped = await subtle.wrapKey('raw', cek, kek, {
    name: 'AES-GCM',
    iv,
  });
  return { iv: toB64(iv), wrapped: toB64(wrapped) };
}

export function unwrapCek(wrappedB64, ivB64, kek) {
  return subtle.unwrapKey(
    'raw',
    fromB64(wrappedB64),
    kek,
    { name: 'AES-GCM', iv: fromB64(ivB64) },
    { name: 'AES-GCM' },
    true,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptJson(obj, cek) {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const data = await subtle.encrypt(
    { name: 'AES-GCM', iv },
    cek,
    enc.encode(JSON.stringify(obj)),
  );
  return { iv: toB64(iv), data: toB64(data) };
}

export async function decryptJson(dataB64, ivB64, cek) {
  const plain = await subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(ivB64) },
    cek,
    fromB64(dataB64),
  );
  return JSON.parse(dec.decode(plain));
}
