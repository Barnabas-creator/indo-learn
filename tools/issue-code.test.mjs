import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildInsertSql } from './issue-code.mjs';
import { generateCode, hashCode } from '../server/src/codes.js';

test('单张码：account_id 为 NULL，issued_at 是传入的时间戳', () => {
  const sql = buildInsertSql(['HASH1'], 1234);
  assert.equal(sql, "INSERT INTO codes (code_hash, account_id, issued_at) VALUES ('HASH1', NULL, 1234);");
});

test('多张码拼成一条批量 INSERT', () => {
  const sql = buildInsertSql(['HASH1', 'HASH2', 'HASH3'], 1234);
  assert.match(sql, /VALUES \('HASH1', NULL, 1234\), \('HASH2', NULL, 1234\), \('HASH3', NULL, 1234\);/);
});

test('哈希里带单引号会被转义，防 SQL 拼接出错', () => {
  const sql = buildInsertSql(["HA'SH"], 1234);
  assert.match(sql, /\('HA''SH', NULL, 1234\)/);
});

test('真实生成的码经 hashCode 后也能正常拼出合法 SQL', async () => {
  const code = generateCode();
  const hash = await hashCode(code);
  const sql = buildInsertSql([hash], 1234);
  assert.match(sql, /^INSERT INTO codes \(code_hash, account_id, issued_at\) VALUES \(/);
  assert.match(sql, /, NULL, 1234\);$/);
});
