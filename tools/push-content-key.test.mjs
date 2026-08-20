import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildInsertSql } from './push-content-key.mjs';

test('生成的 SQL 先把旧密钥置为非当前', () => {
  const sql = buildInsertSql({ version: 'v5', cek: 'KUNCI' });
  assert.match(sql, /UPDATE content_keys SET is_current = 0/);
});

test('插入新密钥并标记为当前', () => {
  const sql = buildInsertSql({ version: 'v5', cek: 'KUNCI' });
  assert.match(sql, /INSERT OR REPLACE INTO content_keys/);
  assert.match(sql, /'v5'/);
  assert.match(sql, /'KUNCI'/);
});

test('单引号被转义，防 SQL 拼接出错', () => {
  const sql = buildInsertSql({ version: "v'5", cek: "KU'NCI" });
  assert.match(sql, /'v''5'/);
  assert.match(sql, /'KU''NCI'/);
});
