# 印尼语学习

纯前端离线 PWA。四个模块：**课程学习**、**单词包**、**场景对话**、**语法学习**。
内容经 AES-GCM 加密，需登录后台激活才能解锁。手机上「添加到主屏幕」后可全屏离线使用。

当前内容规模：

| 模块 | 内容 |
|---|---|
| 单词包 | 初级 102 包 + 中级 100 包 = 2020 词条（词 + 词性 + 中文释义 + 例句 + 例句翻译）；高级 60 包只有主题骨架 |
| 场景对话 | 25 组 / 364 轮。每组含场景说明、12–16 轮对话、6 条关键句（标可替换部分）、8 个生词、2–3 条本地贴士 |
| 课程学习 | BIPA A1 10 单元 / 30 课 ＋ A2 12 单元（已填 1 个）。每课含生词、情景对话、要点、小测 |
| 语法学习 | 4 篇 / 89 课 / 519 条，全部转写自《我的第一本印尼语文法》（发音 / 基础 / 词缀 / 语法） |
| 配图 | 557 个 OpenMoji SVG，词条专属配图覆盖 1465/2020（73%），其余走主题图（每个主题都有专属图）|

## 授权模式

`lib/config.js` 里的 `AUTH_MODE` 决定走哪种：

- `'remote'`（当前线上用的）：账号 + 激活码，服务器（Cloudflare Workers + D1）能吊销单个账号。
  **注册即送 7 天全量试用**，不用等激活码就能立刻用。见下面「账号系统」「试用机制」。
- `'password'`（旧模式，仍保留代码，紧急回退用）：全员共用一个内容密码，纯静态站做不到吊销。见下面「安全边界」。

## 打包内容

密码从命令行参数或 `CONTENT_PASSWORD` 环境变量读取，**绝不写进仓库任何文件**：

```bash
node tools/pack-content.mjs --password "$(cat ~/.indo-pass)" --version v1
```

（`~/.indo-pass` 是本机上保存密码的文件，在仓库之外。）

这一步无论用哪种 `AUTH_MODE` 都要跑：`password` 模式靠它生成的 `keys.json` 在浏览器本地解密；
`remote` 模式靠它生成的 `keys.json` + 密码，在本机算出同一把 CEK 明文，再由
`tools/push-content-key.mjs` 灌进 D1，让服务器能下发给已激活用户。**两种模式共享同一套
加密内容和同一把 CEK**，切换 `AUTH_MODE` 不需要重新打包。

## 换密码

换密码**必须同时提高版本号** —— 脚本每次都生成全新的 CEK 并重新加密全部内容：

```bash
node tools/pack-content.mjs --password '新密码' --version v2
```

只换 `keys.json` 而复用同一个 CEK 是无效的：保留了旧 `keys.json` 的人用旧密码
仍能解出同一个 CEK，进而解开新数据。重新加密全部内容只需几秒。

换版本后 `data/v1/` 可以删掉，也可以留着（旧客户端在缓存过期前还会用）。

换了版本记得走一遍下面「发布流程」——尤其别漏了 `push-content-key.mjs`，否则
`remote` 模式的用户会全部卡在登录页（详见该节）。

## 安全边界

**`remote` 模式**（当前线上模式）能做到真正的账号级吊销：后台把某账号 `status` 置
`disabled`，该账号的会话令牌与内容密钥最长 30 天内失效（见「账号系统」）。局限仍然存在——

- 拿到密钥、下载过加密包的人技术上总能导出明文并转发。账号 + 激活码挡的是随手转发，
  挡不住蓄意扒取。
- 离线状态下客户端用的是本地缓存的密钥，30 天内联不上网也能继续用；要做到「离线也立即
  失效」在物理上不可能——这是可吊销与可离线之间的必然取舍。**准确的说法是**：每次
  成功联网时，能不能用完全由服务端说了算（吊销、试用到期都会被立刻拒掉）；纯离线场景
  下退化成本地缓存的过期时间（`expiresAt`）兜底判断，而这个值存在浏览器 localStorage
  里，用户手改它、并且此后一直不再联网触发服务端校验，理论上能绕开本地这道拦截、
  一直用下去。这不是漏洞、也不是本次改动引入的问题，是「可离线 + 可吊销」这个设计
  取舍必然带来的口子，写文档时不要说成「判定权只在服务端」这类更绝对的话。

**`password` 模式**（旧模式，仅作紧急回退用）没有吊销能力，这些限制是设计使然：

- 纯静态离线应用**做不到吊销**。用户一旦下载过加密包并拿到过密码，那份数据就永久在其
  手中，更换密码不影响已持有的副本。
- 密码轮换只保护**此后发布的内容**。
- 离线状态下应用会回落到缓存的旧 `manifest.json` 与 `keys.json`，此时旧密码仍然有效。

## 账号系统（`remote` 模式）

后端是 Cloudflare Workers + D1，代码在 `server/`：

- 线上地址：`https://indo-learn-api.barnabas7223.workers.dev`
- D1 数据库名：`indo-learn`
- 五个接口：`POST /register`、`POST /login`、`POST /activate`、`POST /request-code`、
  `GET /content-key`（入参出参见 `docs/superpowers/specs/2026-08-20-账号激活码授权-design.md`）

### 部署 Worker

```bash
cd server
export $(cat ~/.cloudflare-token) && npx wrangler deploy
```

`~/.cloudflare-token` 是本机保存 Cloudflare API Token 的文件（`CLOUDFLARE_API_TOKEN=...`
一行），在仓库之外，**任何时候都不要打印它的内容**。

`SESSION_SECRET`（签会话令牌用的密钥）是 Workers Secret，不进 `wrangler.toml`：

```bash
cd server
export $(cat ~/.cloudflare-token) && npx wrangler secret put SESSION_SECRET
# 交互式输入一串随机字符串，例如 openssl rand -base64 32 生成的值
```

改了 `SESSION_SECRET` 会让所有已签发的会话令牌失效，相当于强制全员重新登录（内容密钥
本身不受影响，重新登录后照常能拿到）。

`ALLOWED_ORIGIN`、`AUTO_ISSUE_CODE` 走 `server/wrangler.toml` 的 `[vars]`，改配置后要
`npx wrangler deploy` 才生效。核实线上实际生效值（而不是只看 `wrangler.toml` 里写的）：

```bash
cd server
export $(cat ~/.cloudflare-token) && npx wrangler versions view <最新 Version ID>
# Version ID 从 npx wrangler deployments list 的输出里取最后一条
```

### D1 表结构（五张）

```sql
accounts(id, email UNIQUE, password_hash, salt, status, trial_ends_at, created_at)
codes(code_hash UNIQUE, account_id NULL, issued_at, used_at, expires_at NULL)  -- 新码 expires_at 恒为 NULL（已取消过期，见下）
content_keys(version, cek, is_current, created_at)
attempts(ip, endpoint, ts)          -- 限流用，见 idx_attempts 索引
error_log(id, ts, method, path, name, message)  -- 未被业务逻辑捕获的异常，纯排障用
```

完整建表语句见 `server/schema.sql`；`status` 是个四态状态机：

- `pending`（未激活，遗留值）——`createAccount` 不传 `status` 时的默认值，当前
  `/register` 已经不会再产出这个状态（见下面「试用机制」），只有旧调用方/测试还会用到。
- `trial`（试用中）——`/register` 建的新账号从一开始就是这个状态。
- `active`（已激活/已付费）——输对激活码之后。
- `disabled`（吊销）——负责人用 `tools/admin.mjs disable` 手动设置。

`trial_ends_at` 只有 `trial` 状态的账号会写值（毫秒时间戳），其余状态不使用（`active`
账号保留历史值不清空，方便日后统计试用转化，但不再参与任何判断）。

日常查账号状态、停用/启用账号、重置密码、查激活码绑定情况，用 `tools/admin.mjs`
（见下面「运维」），不要手写 SQL——它会带上安全的字段筛选（比如查账号从不选
`password_hash`/`salt`）。真要跑一次性排查 SQL，走：

```bash
cd server
export $(cat ~/.cloudflare-token) && npx wrangler d1 execute indo-learn --remote --command "SELECT ..."
```

### 试用机制：注册即送 7 天全量试用

`server/src/routes.js` 里的 `TRIAL_DAYS = 7`。`/register` 建账号时直接把 `status`
设成 `trial`、`trial_ends_at = now + 7 天`，同时照常生成一张激活码绑定到这个账号——
但试用期间**不发给用户本人**，负责人先攥着，等对方确认付费了再手动告知（Telegram
推送文案里会写清楚「付费后发给他」）。前端注册成功后自动登录，直接进首页，不再
经过「显示码/待发放提示 → 激活页」那一步；激活页仍然可达，用户付费后从首页横幅的
「输入激活码」按钮进去输码。

`GET /content-key` 对 `trial` 账号的处理：

- `now < trial_ends_at`：正常放行，返回内容密钥；但 `expiresAt`（客户端本地缓存密钥
  的有效期）**截断到 `Math.min(now + 30 天, trial_ends_at)`**，不是固定 30 天。
- `now >= trial_ends_at`：返回 `403 { error: 'trial_expired' }`，前端清会话、回登录页，
  显示「试用已结束，请联系管理员购买完整版」。

**为什么 `expiresAt` 要截断到试用结束，而不是照常给 30 天**：客户端离线时靠本地缓存的
密钥继续用，这是整个账号系统「可吊销 vs 可离线」权衡下故意留的口子（见「安全边界」）。
如果试用账号也按普通账号给 30 天缓存有效期，用户断网后能拿着这把钥匙把 7 天试用
白嫖成一个月——`trial_ends_at` 形同虚设。截断之后，本地缓存最多撑到试用真正到期
那一刻——前端 `lib/remote-provider.js` 的 `init()` 里，本地时钟一过 `expiresAt` 就地
清会话，不用等联网时服务器再拒一次。但跟「安全边界」里说的一样，这道截断挡住的是
「正常使用会联网」的场景，不是密码学意义上不可绕过：`expiresAt` 存在 localStorage
里，用户手改这个值、并且此后一直不再联网触发服务端重新判定，理论上能绕过它，把
试用继续用下去。

`active` 状态不受这条限制，仍然是固定 30 天。

手动给账号补/延长试用期（比如老用户续期、内测账号重新给一段）：

```bash
node tools/admin.mjs grant-trial someone@example.com --days 7
```

会把该账号 `status` 设为 `trial`、`trial_ends_at` 设为 `now + 7 天`（覆盖旧值，不叠加）。

## 两种发码模式

`server/wrangler.toml` 的 `[vars] AUTO_ISSUE_CODE` 控制，改了要 `npx wrangler deploy` 重新部署。
**两种模式下 `/register` 都会当场生成一张码、直接绑定到刚建的账号**（一张码只能激活它
所属的那个账号），**码不设过期时间、长期有效**，且**都会推送到负责人的 Telegram**
（见下面「Telegram 通知配置」）；区别只在于明文码是否也直接返回给注册者本人：

- `"true"`（前期，自己人用）：`/register` 响应里带明文码。前端注册成功、自动登录后
  （此时账号已是 `trial`，能直接用）显示 `renderCodeIssued`——码 + 复制按钮，点「下一步」
  才进首页。
- `"false"`（后期，卖码模式，线上默认）：`/register` 响应里**没有**明文码（服务器只存
  哈希，给了也白给）——前端直接进首页，靠首页横幅提示试用还剩几天、怎么买；明文码
  只在 Telegram 推送里能看到，由负责人手动告知买家，用户付费后从首页横幅的
  「输入激活码」按钮进激活页输入。

  这个模式下不再需要靠 `tools/issue-code.mjs` 预先批量生码——每次注册都会自动生成
  绑定好的码。`issue-code.mjs` 仍然保留，用于批量生成**不绑定任何账号**的散码（`account_id`
  为空、同样不设过期），给老式「先发码后注册」的场景用：

  ```bash
  cd /home/barnabas/印尼语学习
  node tools/issue-code.mjs --count 20
  ```

### 为什么取消了过期时间

早先版本码有 3 小时有效期（后来一度改成 30 分钟），设计初衷是防止码被滥用囤积。
但这套系统本来就是「一码一账号」：注册时生成的码从一开始就绑定到那个账号，且
`/activate` 要求先登录（必须有有效令牌）才能提交码——光有码明文没用，还得有那个
账号的邮箱和密码。也就是说，过期时间能挡住的场景，早就被「码绑定账号」+「必须
先登录」这两道锁挡住了，它挡不住任何过期时间之外的实际威胁。而代价是真实的：
半夜注册、负责人在睡觉，几小时后码作废，用户只能自己摸索重新登录、点「重新
申请激活码」。因此改为**码永不过期**，僵尸码（已绑账号但一直没激活的码）改由
负责人定期用 `tools/admin.mjs` 人工清理（见下面「运维」）。

库里仍留着一批取消过期之前发出的旧码（30 分钟版、3 小时版），它们的 `expires_at`
是具体时间戳，到期后 `/activate` 仍然会报 `code_expired`——这条校验没有删，只是
新码不会再带过期时间。

### 待激活用户拿不到码怎么办：`POST /request-code`

负责人可能没及时看到通知，注册者不该无限期干等。激活页有「重新申请激活码」按钮，
调 `POST /request-code`（需要 Bearer 令牌）：账号是 `pending` 或 `trial` 状态时，作废该
账号名下所有未使用的旧码（`expires_at` 从 NULL 置成 0，等同立即报 `code_expired`），
生成一张新码（同样不设过期）重新绑定 + 推送 Telegram（`trial` 账号推送里会带上试用
到期时间）；账号已经是 `active` 直接返回 `{ok:true, status:'active'}`；`disabled`
账号返回 403。限流：同一 IP 每小时最多 3 次。

### Telegram 通知配置

推送用的凭据是两个 Workers Secret，不进 `wrangler.toml`、不进仓库：

```bash
cd server
export $(cat ~/.cloudflare-token) && npx wrangler secret put TELEGRAM_BOT_TOKEN
# 交互式输入 bot token
export $(cat ~/.cloudflare-token) && npx wrangler secret put TELEGRAM_CHAT_ID
# 交互式输入负责人的 Telegram chat id
```

本地开发/测试环境没配这两个变量时，`notifyOwner`（`server/src/notify.js`）直接跳过，
不报错；推送失败（网络问题、Telegram 侧故障）也绝不影响注册/激活主流程，只留一条
`error_log` 供排障。

注册即送试用起，`/register` 的推送文案改成「🔑 新用户试用中」，带上试用到期时间
（固定按雅加达时区 UTC+7 显示，不依赖 Workers 运行时自己的时区）：

```
🔑 新用户试用中

邮箱：xxx@example.com
激活码：XXXX-XXXX-XXXX-XXXX（付费后发给他）
试用到期：8月29日 14:30
```

`/request-code` 的「🔄 重新申请激活码」文案不变，只是 `trial` 账号会多带一行
「试用到期：…」；非试用账号（`trial_ends_at` 为空，比如走 `issue-code.mjs` 散码
流程的老式 pending 账号）不显示这一行。

## 运维：`tools/admin.mjs`

```bash
cd /home/barnabas/印尼语学习

# 列出账号（id / email / status / trial_ends_at / created_at，不显示哈希与盐）
node tools/admin.mjs list
node tools/admin.mjs list --email rebecca      # 按邮箱关键字模糊筛选

# 停用 / 启用账号（吊销就是把 status 改成 disabled）
node tools/admin.mjs disable someone@example.com
node tools/admin.mjs enable someone@example.com

# 重置密码（本地算好 PBKDF2 哈希 + 盐再写库，不是明文入库）
node tools/admin.mjs reset-password someone@example.com --password '新密码'

# 补/延长试用期（把账号设为 trial，trial_ends_at = now + N 天，覆盖旧值）
node tools/admin.mjs grant-trial someone@example.com --days 7

# 查激活码绑定情况（哈希只显示前 8 位，account_id、used_at、expires_at）
node tools/admin.mjs codes
node tools/admin.mjs codes --unused            # 只看还没被绑定的码
node tools/admin.mjs codes --stale             # 只看僵尸码：已绑账号但从未激活

# 清理僵尸码（码取消过期后，这批码不会再自动失效，得定期人工清）
node tools/admin.mjs prune-codes               # 不加 --yes 只打印将删除的条数，不会真删
node tools/admin.mjs prune-codes --yes         # 确认后真正删除
```

⚠️ 这个脚本直接改生产 D1（`indo-learn`），**只在个人开发机手动跑**，不接 CI、
不接共享机器——同机其他进程能在 `ps` 里看到命令行参数（包括 `reset-password` 时的
邮箱和算好的哈希/盐，虽然不是明文密码本身）。`prune-codes` 是删除操作，不加 `--yes`
时只查数不动库，确认过条数再补 `--yes`。

## 发布流程

分两条线：**代码/配置改动**照常 `git push` 到 `main`（GitHub Pages 自动发布，没有构建
步骤）；**内容改动**（词库、对话、语法有变化，或换了内容密码）必须按下面的顺序走，
**顺序不能乱、不能漏步**：

```bash
# 1. 打包新版本内容（生成 data/<version>/*.enc + keys.json + manifest.json）
node tools/check-content.mjs
node tools/pack-content.mjs --password "$(cat ~/.indo-pass)" --version v6
node --test tools/*.test.mjs server/src/*.test.mjs

# 2. 先把新版本的内容密钥灌进 D1——必须在发布 Pages 之前做
node tools/push-content-key.mjs --password "$(cat ~/.indo-pass)"

# 3. 升级 sw.js 的缓存名（CACHE 常量），让所有客户端的 Service Worker 感知到更新
#    手改 sw.js 第 6 行左右：const CACHE = 'indo-learn-v9';（版本号随便递增即可）

# 4. 提交并推送，触发 GitHub Pages 自动发布
git add data sw.js && git commit -m "chore: 发布内容 v6" && git push

# 5. 同步到 Cloudflare Pages（读的是已提交的文件，所以必须排在第 4 步之后）
bash tools/deploy-pages.sh
```

### 两个域名

站点同时挂在两处，内容一模一样：

| 地址 | 托管 | 发布方式 |
| --- | --- | --- |
| <https://indo-learn.pages.dev/> | Cloudflare Pages | `bash tools/deploy-pages.sh`（直传，不连 GitHub） |
| <https://barnabas-creator.github.io/indo-learn/> | GitHub Pages | `git push` 自动 |

pages.dev 是给用户的正式地址，github.io 留着不停（老用户的书签、装到桌面的 PWA
仍指着它）。**两边都要发**：只推 GitHub 的话 pages.dev 会停在旧版本。

Worker 的 `ALLOWED_ORIGIN`（`server/wrangler.toml`）是逗号分隔的白名单，两个域名都
在里面；少一个，那个域名上的登录会被浏览器按 CORS 拦掉。改完要 `wrangler deploy`。

**为什么第 2 步必须排在第 4 步前面、且不能跳过**：`remote` 模式下浏览器解密内容靠的是
服务器下发的密钥（CEK），不是本地密码。如果先推了 Pages（新版密文已经在线上），
D1 里还是旧版本的密钥，前端会先拿旧密钥去解新密文（失败），触发刷新密钥的逻辑，
但服务器给的还是旧版本号——版本对不上，前端会明确报 `content_outdated`（「内容已更新，
请联网后重新打开」），用户卡在这条提示上出不去，直到有人想起来去补第 2 步。反过来，
`push-content-key.mjs` 每次是**新增一行密钥并把旧行标记为非当前**（新旧密钥短暂并存），
所以第 2 步可以放心提前做，不会破坏还在用旧版本的客户端。

第 3 步（升级 `sw.js` 缓存名）漏了的后果：只有 `install` 时预缓存的清单不会更新，
**不会**再把用户钉在旧代码上——外壳（`index.html` / `app.js` / `lib/**` / `styles.css`）
现在是 network-first（见下节）。新增/删除外壳文件时仍然要改缓存名，因为 `SHELL`
数组变了；只改代码内容时改不改都行。

### 缓存策略：为什么外壳是 network-first

`sw.js` 把请求分成三类：

| 类型 | 策略 | 原因 |
|---|---|---|
| `data/manifest.json`、`data/keys.json` | network-first | 密码轮换靠它们生效 |
| `data/<version>/*.enc`、`assets/**` | cache-first | URL 变了内容才会变，是离线体积的大头 |
| 其余（外壳：html / js / css / webmanifest） | network-first | URL 不带版本号但内容会变 |

外壳原本是 cache-first，代价在 2026-08 暴露出来：前端早就发了「注册即送 7 天试用」
那一版，但 `sw.js` 的 `CACHE` 名从「接入账号 + 激活码登录流程」之后就没再动过，
装过 PWA 的安卓手机一直在跑旧的 `app.js`——注册完不给试用、被强制要激活码才能进。
改成 network-first 之后，只要联得上网就一定拿新代码，断网才回落缓存，离线可用不受影响。

**已经中招的手机怎么恢复**：联网打开一次（新的 Service Worker 会安装并接管），
再打开第二次就是新代码了。急的话直接在浏览器里清掉该站点数据，或卸载重装 PWA。

`password` 模式（`AUTH_MODE = 'password'`）不涉及 D1，跳过第 2 步即可，只走 1、3、4。

## 课程内容：BIPA Sahabatku Indonesia A1

课程模块转写自印尼教育部（Badan Pengembangan dan Pembinaan Bahasa / PPSDK）的官方免费
教材 **Sahabatku Indonesia**，CEFR 六级里的 A1 册：
`D:\01Christ\03YNB学习\03印尼语\BIPA-Sahabatku-Indonesia\Sahabatku-Indonesia-A1.pdf`。

**这本 PDF 有文字层**（跟语法书那本扫描件不同），能直接 `extract_text()`。抽出来会有
字间空格噪音（`MENY APA`），清洗一下就能用。

> [!tip] 最有价值的是 p144–154 的 Transkrip Simakan
> 全书十个单元的听力原文都集中在这十一页——干净、完整、成段的真实对话。
> 课文页的情景对话全部取自这里，不是自己编的。

**A2 那本官方仓库挂错文件**：仓库 id 190 那条标题写 tingkat A2，挂的附件却是
`BIPA A1 PPSDK.pdf`，新旧域名都一样，直接猜 `BIPA A2 PPSDK.pdf` 是 404。上游数据就是错的。

> [!tip] A2 是从 Wayback Machine 挖出来的
> 旧域名 `badanbahasa.kemdikbud.go.id` 当年把六册打包成 zip 放在
> `/lamanbahasa/sites/default/files/BIPA A2.zip`，站点后来整个下线了，但
> 2017-07-14 的快照还在：`http://web.archive.org/web/20170714203543/…/BIPA%20A2.zip`。
> **zip 里除了 PDF 还有 14 个官方音频**（12 个单元的听力，m4a/wav/mp3）——
> 官方仓库那边只放 PDF，音频只有这个 zip 里有。以后要做听力练习，这是现成的真人录音。
> 音频解到 `D:\01Christ\03YNB学习\03印尼语\BIPA-Sahabatku-Indonesia\A2-audio\`。

六册都在本地了。

### 为什么要自己写中文

BIPA 是给「在印尼上课、有老师讲」的人用的**练习册**——满页是填空题和活动指令，
全印尼文，一个中文字都没有。所以：对话与生词照搬教材，**要点与小测是自己写的**，
写的时候对着教材前面的能力对照表（PEMETAAN KOMPETENSI，A-1.1 … A-1.10）定每一课的目标。

### 一课四块

`words` 生词 → `scene` 情景对话（可逐句朗读、也可整段连播）→ `points` 要点
→ `quiz` 小测（选择题，本地判对错，只解释不记分、不落盘）。四块缺一块，
`validateCourse` 会拦下来——不然课文页会渲染出一个空白框，用户分不清是内容没写还是 bug。

小测强制**正好一个**正确答案：两个 `ok: true` 或零个都会报错。

### 分文件写 + 合并

一个单元一个文件，放 `content-src/course/`（`.gitignore` 里，明文不进仓库）：

```
00-units.json                十个单元的元信息
u01-menyapa.json … u10-lagu-populer.json
```

单元带 `level` 字段（A1／A2），列表页按级分组。课靠自己的 `unit` 字段归位
（不像语法篇那样靠文件名前缀——课程文件名带印尼语单元名，前缀匹配会脆）。合并：

```bash
node tools/merge-course.mjs    # -> content-src/course.json
node tools/check-content.mjs   # validateCourse
```

单元内按 `order` 排。**没有课的单元照样输出**，UI 上显示成「准备中」、点不进去——
跟单词包里没填词的包是同一套约定：先让人看见整套课程有多少单元，再一个一个填。

### 加内容模块要改哪些地方

`lib/content-modules.js` 是加密内容的唯一清单，打包脚本和两个 provider 的取数出口
都从它读——加一份加密内容只改那一行。**其余五处仍要各自加**，因为每个模块本来就不一样：

1. `content-src/<新>/` ＋ `tools/merge-<新>.mjs`（明文怎么写、怎么合并）
2. `tools/check-content.mjs` 的 `validate<新>`（这个模块的内容规则）
3. `lib/views/<新>.js`（视图）
4. `app.js` 的 `render()` 分支 ＋ `lib/nav.js` 的 `PARENT` 层级
5. `lib/views/home.js` 的首页卡片 ＋ `sw.js` 的 `SHELL`

## 语法内容：《我的第一本印尼语文法》

语法模块的内容全部转写自这本书（台湾版，繁体中文，`D:\01Christ\03YNB学习\03印尼语\我的第一本印尼语文法.pdf`）。
2026-08-27 整本替换掉了原先从小程序 `curriculum.js` 扒来的 8 模块 / 61 课 / 217 条。

| | 旧（小程序） | 新（书） |
|---|---|---|
| 规模 | 8 模块 / 61 课 / 217 条 | 4 篇 / 89 课 / 519 条 |
| 覆盖词缀 | meN- / ber- / ter- / peN- / di- 五个 | 16 个，是超集 |
| 除词缀外 | 无 | 发音篇、基础篇、语法篇（疑问 / 被动 / yang / 命令 / 比较 / 介词 / 连接词）|
| 出处 | 来路不明 | 正式出版物 |

> [!warning] 这本书是纯扫描件，没有文字层
> 每页都是 4280×3070 的 1-bit 黑白扫描图，`extract_text()` 全部返回空——抽不了文字，
> 只能逐页看图转写。整本 127 个 PDF 页（跨页排版，约 254 个书页）。好消息是书签完好，
> 44 条，整本目录白送。要补内容时照着书签定位页码即可。

**转写约定**（以后续写务必沿用）：

- 繁体转简体，台湾用语换成大陆说法：文法→语法、子音→辅音、母音→元音、書面體→书面语、
  受詞→宾语、主詞→主语、字根→词根、前綴詞→前缀。
- 书上用注音符号标发音，对大陆用户没用，一律换成拼音式的近似音（C 念 ce「册」）。
- 发现书里的错字直接改：`Kalimatan Timur` → `Kalimantan Timur`。
- 例句、中译、生词注全部照搬原书，不自己造句；只有书上没给例句的对照表条目才补写。

### 分文件写 + 合并

一节一个文件，放 `content-src/grammar-book/`（`.gitignore` 里，明文不进仓库）：

```
00-modules.json          四篇的元信息 + 文件名前缀
phonetic-01-alphabet.json
basic-01-panggilan.json
affix-01-ber.json …… affix-16-bare-verbs.json
syntax-01-question.json …… syntax-08-conjunction.json
```

文件名前缀决定落进哪一篇，篇内按文件名排序。合并：

```bash
node tools/merge-grammar-book.mjs   # -> content-src/grammar.json
node tools/check-content.mjs        # validateGrammar 会查字段缺失、id 重复、例句是不是误填了中文
```

没有任何课的篇不会输出——转写还没做到的篇不该在 UI 上占一行「0 课」。

### 配图

语法讲的都是抽象的东西（词缀、语序、从句），没有实物可画，所以四篇各配一张
手写的 SVG，放 `assets/grammar-svg/book/`（`phonetic` / `basic` / `affix` / `syntax`），
由 `lib/views/grammar.js` 的 `visualFor()` 解析，找不到就退回 `affix.svg`，绝不挂断链。
配色沿用 app 的苔绿 / 丁香棕 / 金——都是中间调，浅底深底都看得清，所以不随主题切换。

（`assets/grammar-svg/` 下的 `modules/` `lessons/` `builders/` `scenes/` 是从小程序扒来的旧图，
对应已经删掉的 8 模块结构，现在没人引用，留着只是因为 `tools/extract-grammar.mjs` 会重新拷贝。）

## 朗读（TTS）

用浏览器自带的 Web Speech API，不打包任何音频。音色由系统提供：

- iOS Safari 自带 id-ID（Damayanti），开箱即用。
- **安卓要手动装印尼语数据包**：设置 → 通用管理 / 系统 → 文字转语音（TTS）→
  Google 语音服务 → 安装语音数据 → Bahasa Indonesia。没装就是纯静音、不报错。
  应用检测到没有印尼语音色时会在主界面顶部挂一条提示（`.voice-hint`），写明上面这串路径。

`lib/tts.js` 另外挡掉两个安卓上会导致「点朗读没声音」的坑，改动时别退回去：

- `getVoices()` 首次同步调用返回空数组，音色要等 `voiceschanged` 才到齐；早于它
  `speak()` 会静音。所以音色没就绪时先等（最多 2 秒兜底）。
- Chrome 的老问题：`cancel()` 之后立刻 `speak()`，这条会被丢掉。所以只有确实在播时
  才 `cancel()`，并且隔 `CANCEL_GAP_MS` 再发。
- 但「音色已就绪且当前没在播」这条最常见路径必须保持**同步**发声：iOS Safari 要求
  首次 `speak()` 落在用户手势的同步调用栈里，一律 `setTimeout` 会把 iOS 弄哑。

## 导航：返回手势与桌面键

层级关系在 `lib/nav.js` 的 `PARENT` 表里，`app.js` 据此把 history 记录与层深一一对应：
下钻 `pushState`，同层（词卡 → 恭喜页）`replaceState`，上行一律 `history.go(-n)`，
`popstate` 里统一改 `view`。这样四件事走的是同一条路、history 也不会越点越深：

- 安卓手势导航的**左边缘右滑**（系统返回手势，网页拦不住，只会触发 popstate）
- 安卓**返回键**
- 页内的「← 返回」按钮
- 右下角的**桌面键**（`.home-key`，一下回首页；首页本身不画）

三键导航和普通浏览器标签页里系统不吃这个手势，`isBackSwipe()` 自己认一次作为补充
（起点必须落在左边缘 32px 内，避免跟词卡翻面、横向滚动抢）。

## 紧急回退到共享密码模式

`remote` 模式如果因为 Worker/D1 故障导致所有人登录不了，可以临时切回旧的共享密码模式
（不影响已经打包好的内容，两种模式共享同一份 `data/`）：

1. 编辑 `lib/config.js`，把 `AUTH_MODE` 改成 `'password'`。
2. 确认 `~/.indo-pass` 里的密码就是当前 `data/<最新版本>/` 对应的密码（如果不确定，
   看最近一次 `pack-content.mjs --password` 用的是哪个密码）。
3. 提交并推送到 `main`，等 GitHub Pages 自动发布。
4. 把 `~/.indo-pass` 里的密码告知用户（这就回到了「全员共用一个密码」，不再需要账号/
   激活码）。

故障排除后改回 `AUTH_MODE = 'remote'` 再推一次即可，不影响已有账号/激活码数据（都还在
D1 里）。

## 本地开发

```bash
python3 -m http.server 8123
```

浏览器打开 <http://localhost:8123>。`remote` 模式下前端会直连线上 Worker
（`lib/config.js` 里的 `API_BASE`），本地开发不需要额外起后端；要跑后端本身的改动，
在 `server/` 目录用 `npx wrangler dev` 起本地 Worker，并临时把 `API_BASE` 指过去。

## 跑测试

```bash
node --test tools/*.test.mjs server/src/*.test.mjs
```

前端工具/视图测试在 `tools/*.test.mjs`，Workers 路由/加密/激活码测试在
`server/src/*.test.mjs`（内存版假 D1，不连真实数据库）。

## 初级词表的补充包

小程序原本的 100 个初级包漏掉了一批核心词（membuat / butuh / lewat / hilang…）。
补的包写在 `content-src/extra-packs.json`（`extra-beginner-*`），
`extract-packs.mjs` 会把它们并进骨架，不动原有 100 包。

## 内容如何逐步开放

骨架（`lib/catalog.js`，明文）与词条（加密包，`{ 包id: [词条…] }`）分开存放。
某个包有没有词条，决定它在 UI 上是可点还是灰显「准备中」——
补一批词只需重打加密包，代码不用改。

## 重新生成内容

```bash
node tools/extract-packs.mjs                       # reference/packs.js + extra-packs.json -> skeleton.json
node tools/build-catalog.mjs                       # 骨架 -> lib/catalog.js（明文，App 直接 import）
node tools/extract-grammar.mjs                     # 提取语法课程 + SVG 插图
node tools/merge-batches.mjs                       # batches/*.json -> content-src/words.json（按包 id 索引）
node tools/merge-dialogs.mjs                       # dialogs/*.json -> content-src/dialogs.json
node tools/check-content.mjs                       # 校验词库与对话，并列出例句里的生词
node tools/fetch-openmoji.mjs                      # 按映射表拉取用到的 OpenMoji SVG
node tools/pack-content.mjs --password '密码' --version v1
node tools/push-content-key.mjs --password '密码'  # remote 模式：把新密钥灌进 D1（见「发布流程」）
```

## 目录

| 路径 | 说明 |
|---|---|
| `index.html` / `app.js` / `styles.css` | 外壳与路由 |
| `lib/catalog.js` | 三级主题骨架（生成物，勿手改）。哪个包已开放看有没有词条 |
| `lib/config.js` | 前端配置：`AUTH_MODE`（`remote`/`password`）、`API_BASE`（Worker 地址） |
| `lib/crypto.js` | AES-GCM / PBKDF2，浏览器与 Node 共用 |
| `lib/provider.js` | `password` 模式的内容访问接口、解锁凭据管理（有效期 30 天） |
| `lib/remote-provider.js` | `remote` 模式的内容访问接口：账号登录 + 服务器下发密钥 |
| `lib/tts.js` | Web Speech `id-ID` 封装，含安卓静音坑的规避（见「朗读（TTS）」） |
| `lib/nav.js` | 层级父子关系 + 左边缘返回手势判定（见「导航」） |
| `lib/icons.js` / `lib/emoji-map.js` | 词 → OpenMoji 映射，三级回退 |
| `lib/views/` | 视图：解锁（旧模式）、注册/登录/激活（`auth.js`，新模式）、单词包、对话、语法 |
| `server/` | Cloudflare Workers + D1 后端：`src/routes.js`（五个接口：`POST /register`、`POST /login`、`POST /activate`、`POST /request-code`、`GET /content-key`）、`src/crypto.js`（密码哈希/令牌）、`src/codes.js`（激活码生成/哈希）、`src/db.js`（SQL 封装）、`schema.sql`（建表）、`wrangler.toml`（部署配置） |
| `tools/` | 提取、生成、校验、打包脚本（本机运行） |
| `lib/content-modules.js` | 加密内容的唯一清单，加一份内容只改这里 |
| `lib/views/course.js` | 课程视图：单元列表 → 课列表 → 课文页（生词/对话/要点/小测） |
| `tools/merge-course.mjs` | 把 `content-src/course/*.json` 合并成 `course.json`（见「课程内容」） |
| `tools/merge-grammar-book.mjs` | 把 `content-src/grammar-book/*.json` 合并成 `grammar.json`（见「语法内容」） |
| `tools/push-content-key.mjs` | 把内容密钥灌进 D1（发布流程第 2 步，见上） |
| `tools/issue-code.mjs` | 卖码模式下本地批量生成激活码，明文只打印一次 |
| `tools/admin.mjs` | 运维：查账号、停用/启用、重置密码、查激活码绑定、清理僵尸码（`--stale`/`prune-codes`） |
| `content-src/` | 明文内容，**不提交** |
| `reference/` | 参考资料，**不提交** |
| `data/` | 加密产物，提交并发布 |
| `sw.js` | Service Worker，缓存策略见「缓存策略：为什么外壳是 network-first」 |

## 关于内容质量

印尼语词条与例句由 AI 生成，可能存在不地道或出错之处，请抽查后再作正式使用。

导出一份可批注的审校表（需要 `openpyxl`，仅审校用）：

```bash
python3 tools/export-review.py
```

产出 `印尼语词库审校.xlsx`，四个工作表：说明 / 词条（1000 行）/ 对话（100 行）/
关键句与生词（100 行）。每行末尾有「判定」下拉和「修改建议」空白列，母语者可以直接填。

**这份表是全部内容的明文，已在 `.gitignore` 里 —— 绝不能提交到公开仓库**，
否则加密就白做了。

改完后回填 `content-src/batches/batch-*.json`，再重跑「重新生成内容」里的流程，
然后走一遍上面完整的「发布流程」（别漏了 `push-content-key.mjs` 和 `sw.js` 缓存名）。

## 授权

配图来自 [OpenMoji](https://openmoji.org)，授权
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)。
