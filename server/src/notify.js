// 推送给负责人的 Telegram 通知：新注册/重新申请激活码时，把明文码发到负责人手机，
// 而不是显示给注册者本人（卖码模式）。
import { recordError } from './db.js';

const NOTIFY_TIMEOUT_MS = 5000;

export async function notifyOwner(env, text) {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  // 本地测试/开发环境没配这两个变量：直接跳过，不当成错误。
  if (!token || !chatId) return;

  // 推送失败（网络抖动、Telegram 侧故障）绝不能影响注册/激活主流程，
  // 只留一条 error_log 供排障；连日志都记不下去也吞掉。
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: AbortSignal.timeout(NOTIFY_TIMEOUT_MS),
    });
    if (!res.ok) {
      await recordError(env.DB, {
        ts: Date.now(),
        method: 'POST',
        path: 'telegram:sendMessage',
        name: 'telegram_notify_failed',
        message: `status ${res.status}`,
      });
    }
  } catch (err) {
    try {
      await recordError(env.DB, {
        ts: Date.now(),
        method: 'POST',
        path: 'telegram:sendMessage',
        name: err?.name,
        message: err?.message,
      });
    } catch {
      // 日志也记不下去就算了
    }
  }
}
