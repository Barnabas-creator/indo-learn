import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildInsertSql } from './push-content-key.mjs';

test('插入新密钥并标记为当前', () => {
  const sql = buildInsertSql({ version: 'v5', cek: 'KUNCI' });
  assert.match(sql, /INSERT OR REPLACE INTO content_keys/);
  assert.match(sql, /'v5'/);
  assert.match(sql, /'KUNCI'/);
});

test('生成的 SQL 再把旧密钥置为非当前', () => {
  const sql = buildInsertSql({ version: 'v5', cek: 'KUNCI' });
  assert.match(sql, /UPDATE content_keys SET is_current = 0 WHERE version != 'v5'/);
});

test('INSERT 先于 UPDATE，避免中途失败时一行都没有', () => {
  const sql = buildInsertSql({ version: 'v5', cek: 'KUNCI' });
  const insertAt = sql.indexOf('INSERT OR REPLACE INTO content_keys');
  const updateAt = sql.indexOf('UPDATE content_keys SET is_current = 0');
  assert.ok(insertAt >= 0 && updateAt >= 0);
  assert.ok(insertAt < updateAt);
});

test('单引号被转义，防 SQL 拼接出错', () => {
  const sql = buildInsertSql({ version: "v'5", cek: "KU'NCI" });
  assert.match(sql, /'v''5'/);
  assert.match(sql, /'KU''NCI'/);
});

test('UPDATE 里 WHERE version != 的版本号也被转义', () => {
  const sql = buildInsertSql({ version: "v'5", cek: 'KUNCI' });
  assert.match(sql, /WHERE version != 'v''5'/);
});
