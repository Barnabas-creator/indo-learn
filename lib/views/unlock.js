export function renderUnlock(root, { onSubmit, error = '', busy = false }) {
  root.innerHTML = `
    <section class="unlock">
      <div class="unlock-logo">📖</div>
      <h1>印尼语学习</h1>
      <p class="unlock-hint">输入密码解锁内容</p>
      <form class="unlock-form">
        <input type="password" name="password" autocomplete="current-password"
               placeholder="密码" required ${busy ? 'disabled' : ''}>
        <button type="submit" ${busy ? 'disabled' : ''}>${busy ? '解锁中…' : '解锁'}</button>
      </form>
      <p class="unlock-error">${error}</p>
    </section>
  `;
  const form = root.querySelector('.unlock-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    onSubmit(new FormData(form).get('password'));
  });
  if (!busy) root.querySelector('input')?.focus();
}
