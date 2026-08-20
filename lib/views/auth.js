// 注册 / 登录 / 激活三个视图。与其他视图一样：只渲染 + 绑事件，不碰网络。
export const AUTH_ERRORS = {
  invalid_email: '邮箱格式不对',
  weak_password: '密码至少 8 位',
  email_taken: '这个邮箱已经注册过了',
  bad_credentials: '邮箱或密码不对',
  account_disabled: '这个账号已被停用',
  bad_code: '激活码不存在，请检查有没有输错',
  code_used: '这个激活码已经绑定了别的账号',
  too_many_attempts: '尝试太频繁，请等一分钟再试',
  unauthorized: '登录已过期，请重新登录',
  not_activated: '账号还没激活，请先输入激活码',
  no_content_key: '服务器还没配置内容密钥，请联系管理员',
  server_error: '服务器出错了，请稍后再试',
  content_outdated: '内容已更新，请联网后重新打开',
  default: '出了点问题，请稍后再试',
};

function shell(title, hint, inner) {
  return `
    <section class="unlock">
      <div class="unlock-logo">📖</div>
      <h1>${title}</h1>
      <p class="unlock-hint">${hint}</p>
      ${inner}
    </section>`;
}

export function renderLogin(root, { onSubmit, onSwitch, error = '', busy = false }) {
  root.innerHTML = shell('印尼语学习', '登录后使用', `
      <form class="unlock-form auth-form">
        <input type="email" name="email" autocomplete="username" placeholder="邮箱" required ${busy ? 'disabled' : ''}>
        <input type="password" name="password" autocomplete="current-password" placeholder="密码" required ${busy ? 'disabled' : ''}>
        <button type="submit" ${busy ? 'disabled' : ''}>${busy ? '登录中…' : '登录'}</button>
      </form>
      <p class="unlock-error">${error}</p>
      <button class="link-btn switch" ${busy ? 'disabled' : ''}>还没有账号？去注册</button>`);
  const form = root.querySelector('.auth-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(form);
    onSubmit(data.get('email'), data.get('password'));
  });
  root.querySelector('.switch').addEventListener('click', onSwitch);
}

export function renderRegister(root, { onSubmit, onSwitch, error = '', busy = false }) {
  root.innerHTML = shell('注册账号', '邮箱 + 密码，密码至少 8 位', `
      <form class="unlock-form auth-form">
        <input type="email" name="email" autocomplete="username" placeholder="邮箱" required ${busy ? 'disabled' : ''}>
        <input type="password" name="password" autocomplete="new-password" placeholder="密码" required ${busy ? 'disabled' : ''}>
        <input type="password" name="password2" autocomplete="new-password" placeholder="再输一次密码" required ${busy ? 'disabled' : ''}>
        <button type="submit" ${busy ? 'disabled' : ''}>${busy ? '注册中…' : '注册'}</button>
      </form>
      <p class="unlock-error">${error}</p>
      <button class="link-btn switch" ${busy ? 'disabled' : ''}>已有账号？去登录</button>`);
  const form = root.querySelector('.auth-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(form);
    if (data.get('password') !== data.get('password2')) {
      root.querySelector('.unlock-error').textContent = '两次密码不一致';
      return;
    }
    onSubmit(data.get('email'), data.get('password'));
  });
  root.querySelector('.switch').addEventListener('click', onSwitch);
}

export function renderCodeIssued(root, { code, onNext }) {
  root.innerHTML = shell('注册成功', '这是你的激活码，请复制保存', `
      <div class="code-box">${code}</div>
      <button class="copy-code">复制激活码</button>
      <p class="unlock-hint">下一步输入它激活账号</p>
      <button class="next primary">去激活</button>`);
  root.querySelector('.copy-code').addEventListener('click', async (e) => {
    try {
      if (!navigator.clipboard) throw new Error('no clipboard api');
      await navigator.clipboard.writeText(code);
      e.target.textContent = '已复制 ✓';
    } catch {
      // 非 HTTPS、权限被拒或浏览器不支持时会走到这里：激活码是注册流程的关键一步，
      // 不能让用户以为复制成功了却拿到空剪贴板，所以要给出明确提示并让他手动选中。
      e.target.textContent = '复制失败，请手动选中';
      root.querySelector('.code-box').classList.add('highlight');
    }
  });
  root.querySelector('.next').addEventListener('click', onNext);
}

export function renderActivate(root, { onSubmit, onLogout, error = '', busy = false }) {
  root.innerHTML = shell('激活账号', '输入激活码，一码绑定一个账号', `
      <form class="unlock-form auth-form">
        <input type="text" name="code" placeholder="XXXX-XXXX-XXXX-XXXX" autocomplete="off" required ${busy ? 'disabled' : ''}>
        <button type="submit" ${busy ? 'disabled' : ''}>${busy ? '激活中…' : '激活'}</button>
      </form>
      <p class="unlock-error">${error}</p>
      <button class="link-btn logout" ${busy ? 'disabled' : ''}>退出登录</button>`);
  const form = root.querySelector('.auth-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    onSubmit(new FormData(form).get('code'));
  });
  root.querySelector('.logout').addEventListener('click', onLogout);
}
