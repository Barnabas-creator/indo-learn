import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AUTH_ERRORS, renderLogin, renderRegister, renderActivate, renderCodeIssued } from '../lib/views/auth.js';

// 极小的手写假 DOM：够 render* 函数 innerHTML 赋值后调 querySelector 绑事件即可，
// 不引入 jsdom 之类的依赖。断言只看渲染出来的 HTML 字符串。
function fakeRoot() {
  const stub = { addEventListener() {}, classList: { add() {}, remove() {} } };
  return {
    innerHTML: '',
    querySelector() { return stub; },
  };
}

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

test('登录/注册在 busy 时禁用切换按钮，避免请求进行中切走视图', () => {
  const loginRoot = fakeRoot();
  renderLogin(loginRoot, { onSubmit() {}, onSwitch() {}, busy: true });
  assert.match(loginRoot.innerHTML, /class="link-btn switch"\s+disabled/);

  const registerRoot = fakeRoot();
  renderRegister(registerRoot, { onSubmit() {}, onSwitch() {}, busy: true });
  assert.match(registerRoot.innerHTML, /class="link-btn switch"\s+disabled/);
});

test('激活视图在 busy 时禁用退出登录按钮', () => {
  const root = fakeRoot();
  renderActivate(root, { onSubmit() {}, onLogout() {}, busy: true });
  assert.match(root.innerHTML, /class="link-btn logout"\s+disabled/);
});

test('激活码展示视图含激活码本身和复制按钮', () => {
  const root = fakeRoot();
  renderCodeIssued(root, { code: 'ABCD-EFGH-IJKL-MNOP', onNext() {} });
  assert.match(root.innerHTML, /ABCD-EFGH-IJKL-MNOP/);
  assert.match(root.innerHTML, /class="copy-code"/);
});

test('激活视图传入 code 时输入框带默认值且页面显示该码', () => {
  const root = fakeRoot();
  renderActivate(root, { onSubmit() {}, onLogout() {}, code: 'WXYZ-1234-5678-90AB' });
  assert.match(root.innerHTML, /value="WXYZ-1234-5678-90AB"/);
  assert.match(root.innerHTML, /你的激活码：WXYZ-1234-5678-90AB/);
});

test('激活视图不传 code 时输入框为空、不显示激活码提示行', () => {
  const root = fakeRoot();
  renderActivate(root, { onSubmit() {}, onLogout() {} });
  assert.match(root.innerHTML, /value=""/);
  assert.doesNotMatch(root.innerHTML, /你的激活码：/);
});

// 激活失败重渲染时 code/inputCode 是用户手输的内容，error 也不能假设一定
// 来自 AUTH_ERRORS 固定表：两处都要转义，否则输入里带个引号/尖括号就是 self-XSS。
const XSS_PAYLOAD = '"><script>x</script>';

test('激活视图的 code（手输回填）被转义，不含未转义的 <script>', () => {
  const root = fakeRoot();
  renderActivate(root, { onSubmit() {}, onLogout() {}, code: XSS_PAYLOAD });
  assert.doesNotMatch(root.innerHTML, /<script>x<\/script>/);
  assert.match(root.innerHTML, /&lt;script&gt;/);
});

test('激活视图的 error 被转义，不含未转义的 <script>', () => {
  const root = fakeRoot();
  renderActivate(root, { onSubmit() {}, onLogout() {}, error: XSS_PAYLOAD });
  assert.doesNotMatch(root.innerHTML, /<script>x<\/script>/);
  assert.match(root.innerHTML, /&lt;script&gt;/);
});

test('登录视图的 error 被转义，不含未转义的 <script>', () => {
  const root = fakeRoot();
  renderLogin(root, { onSubmit() {}, onSwitch() {}, error: XSS_PAYLOAD });
  assert.doesNotMatch(root.innerHTML, /<script>x<\/script>/);
});

test('注册视图的 error 被转义，不含未转义的 <script>', () => {
  const root = fakeRoot();
  renderRegister(root, { onSubmit() {}, onSwitch() {}, error: XSS_PAYLOAD });
  assert.doesNotMatch(root.innerHTML, /<script>x<\/script>/);
});

test('激活码展示视图的 code 被转义，不含未转义的 <script>', () => {
  const root = fakeRoot();
  renderCodeIssued(root, { code: XSS_PAYLOAD, onNext() {} });
  assert.doesNotMatch(root.innerHTML, /<script>x<\/script>/);
});
