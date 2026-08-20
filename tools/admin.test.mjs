import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildListSql, buildSetStatusSql, buildResetPasswordSql, buildCodesSql,
} from './admin.mjs';

test('list 不带关键字时查全部账号，只选安全字段', () => {
  const sql = buildListSql();
  assert.equal(sql, 'SELECT id, email, status, created_at FROM accounts ORDER BY id;');
  assert.doesNotMatch(sql, /password_hash|salt/);
});

test('list 带关键字时按邮箱模糊匹配', () => {
  const sql = buildListSql('rebecca');
  assert.match(sql, /WHERE email LIKE '%rebecca%'/);
});

test('list 关键字里带单引号会被转义', () => {
  const sql = buildListSql("o'reilly");
  assert.match(sql, /LIKE '%o''reilly%'/);
});

test('disable 生成把 status 改为 disabled 的 UPDATE', () => {
  const sql = buildSetStatusSql('a@b.com', 'disabled');
  assert.equal(sql, "UPDATE accounts SET status = 'disabled' WHERE email = 'a@b.com';");
});

test('enable 生成把 status 改为 active 的 UPDATE', () => {
  const sql = buildSetStatusSql('a@b.com', 'active');
  assert.equal(sql, "UPDATE accounts SET status = 'active' WHERE email = 'a@b.com';");
});

test('邮箱带单引号时 status 更新也会转义', () => {
  const sql = buildSetStatusSql("o'reilly@b.com", 'disabled');
  assert.match(sql, /WHERE email = 'o''reilly@b\.com'/);
});

test('reset-password 生成写 password_hash 与 salt 的 UPDATE', () => {
  const sql = buildResetPasswordSql('a@b.com', 'HASH==', 'SALT==');
  assert.equal(sql, "UPDATE accounts SET password_hash = 'HASH==', salt = 'SALT==' WHERE email = 'a@b.com';");
});

test('reset-password 的哈希/盐/邮箱都各自转义', () => {
  const sql = buildResetPasswordSql("a'b@b.com", "HA'SH", "SA'LT");
  assert.match(sql, /password_hash = 'HA''SH'/);
  assert.match(sql, /salt = 'SA''LT'/);
  assert.match(sql, /email = 'a''b@b\.com'/);
});

test('codes 默认列出全部，只截取哈希前 8 位', () => {
  const sql = buildCodesSql(false);
  assert.match(sql, /SUBSTR\(code_hash, 1, 8\) AS hash_prefix/);
  assert.doesNotMatch(sql, /SELECT code_hash\b/);
  assert.doesNotMatch(sql, /WHERE/);
});

test('codes --unused 只筛未绑定账号的码', () => {
  const sql = buildCodesSql(true);
  assert.match(sql, /WHERE account_id IS NULL/);
});
