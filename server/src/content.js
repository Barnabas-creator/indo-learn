// 内容下发：清单与单元。授权判定复用 routes.js 里那套（requireAccount + 试用期），
// 不另起一套——两套判定迟早会跑偏。
import { listContentUnits, currentContentVersion } from './db.js';
import { requireAccount, json } from './routes.js';

// 能看全部内容的账号：active，或还在试用期内的 trial。
// 与 handleContentKey 的判定同源，只是这里不需要区分「过期」和「没激活」——
// 清单页对谁都有内容可给（至少有 free 那几个），退回 free 比报错友好。
export async function canSeePaid(request, env, now) {
  const account = await requireAccount(request, env, now);
  if (!account || account.status === 'disabled') return false;
  if (account.status === 'active') return true;
  return account.status === 'trial' && account.trial_ends_at > now;
}

export async function handleContentIndex(request, env, now = Date.now()) {
  const includePaid = await canSeePaid(request, env, now);
  const [rows, version] = await Promise.all([
    listContentUnits(env.DB, { includePaid }),
    currentContentVersion(env.DB),
  ]);

  const modules = {};
  for (const r of rows) {
    (modules[r.module] ??= []).push({ id: r.unit_id, tier: r.tier, title: r.title ?? null });
  }

  const res = json({ version, modules });
  // 清单是所有页面的入口，五分钟私有缓存能把 Workers 的请求数压下来一大截；
  // private 是必须的——不同账号看到的清单不一样，不能进共享缓存。
  res.headers.set('cache-control', 'private, max-age=300');
  return res;
}
