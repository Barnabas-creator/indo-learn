// 激活码：16 位，去掉易混字符，四位一组显示。库里只存哈希。
const enc = new TextEncoder();

export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 16;

export function generateCode() {
  const threshold = Math.floor(256 / CODE_ALPHABET.length) * CODE_ALPHABET.length;
  let out = '';
  let bytes = globalThis.crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  let byteIdx = 0;

  while (out.length < CODE_LENGTH) {
    if (byteIdx >= bytes.length) {
      bytes = globalThis.crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
      byteIdx = 0;
    }
    const b = bytes[byteIdx++];
    if (b < threshold) {
      out += CODE_ALPHABET[b % CODE_ALPHABET.length];
    }
  }
  return out.match(/.{4}/g).join('-');
}

export function normalizeCode(input) {
  return String(input ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

export async function hashCode(code) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', enc.encode(normalizeCode(code)));
  return btoa(String.fromCharCode(...new Uint8Array(digest)));
}
