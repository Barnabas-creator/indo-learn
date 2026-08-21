import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildListSql, buildSetStatusSql, buildResetPasswordSql, buildCodesSql,
  buildPruneCodesSql, buildStaleCountSql, buildGrantTrialSql,
} from './admin.mjs';

test('list 不带关键字时查全部账号，只选安全字段，含 status 与 trial_ends_at', () => {
  const sql = buildListSql();
  assert.equal(sql, 'SELECT id, email, status, trial_ends_at, created_at FROM accounts ORDER BY id;');
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

test('codes --stale 只筛已绑定账号但从未激活的僵尸码', () => {
  const sql = buildCodesSql(false, true);
  assert.match(sql, /WHERE account_id IS NOT NULL AND used_at IS NULL/);
});

test('--stale 优先于 --unused（两者语义互斥，stale 更具体）', () => {
  const sql = buildCodesSql(true, true);
  assert.match(sql, /WHERE account_id IS NOT NULL AND used_at IS NULL/);
  assert.doesNotMatch(sql, /account_id IS NULL ORDER/);
});

test('prune-codes 生成删除僵尸码的 DELETE，条件与 --stale 一致', () => {
  const sql = buildPruneCodesSql();
  assert.equal(sql, 'DELETE FROM codes WHERE account_id IS NOT NULL AND used_at IS NULL;');
});

test('prune-codes 不带 --yes 时用的计数 SQL，只查数不删', () => {
  const sql = buildStaleCountSql();
  assert.match(sql, /^SELECT COUNT\(\*\) AS n FROM codes WHERE account_id IS NOT NULL AND used_at IS NULL;$/);
  assert.doesNotMatch(sql, /DELETE/);
});

// --- grant-trial：手动把账号设成 trial 并延长/补发试用期 ---

test('grant-trial 生成把 status 改为 trial、写入 trial_ends_at 的 UPDATE', () => {
  const sql = buildGrantTrialSql('a@b.com', 1700000000000);
  assert.equal(sql, "UPDATE accounts SET status = 'trial', trial_ends_at = 1700000000000 WHERE email = 'a@b.com';");
});

test('grant-trial 的邮箱带单引号时会被转义', () => {
  const sql = buildGrantTrialSql("o'reilly@b.com", 1700000000000);
  assert.match(sql, /WHERE email = 'o''reilly@b\.com'/);
});
