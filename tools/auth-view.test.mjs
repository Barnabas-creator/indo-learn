import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AUTH_ERRORS } from '../lib/views/auth.js';

test('每个服务端错误码都有中文文案', () => {
  for (const code of [
    'invalid_email', 'weak_password', 'email_taken', 'bad_credentials',
    'account_disabled', 'bad_code', 'code_used', 'too_many_attempts',
    'unauthorized', 'not_activated', 'no_content_key', 'server_error',
    'content_outdated',
  ]) {
    assert.ok(AUTH_ERRORS[code], `缺 ${code} 的文案`);
  }
});

test('未知错误码有兜底文案', () => {
  assert.ok(AUTH_ERRORS.default);
});
