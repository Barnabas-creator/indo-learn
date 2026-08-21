# 印尼语学习

纯前端离线 PWA。三个模块：**单词包**、**场景对话**、**语法学习**。
内容经 AES-GCM 加密，需登录后台激活才能解锁。手机上「添加到主屏幕」后可全屏离线使用。

当前内容规模：

| 模块 | 内容 |
|---|---|
| 单词包 | 初级 102 包 + 中级 100 包 = 2020 词条（词 + 词性 + 中文释义 + 例句 + 例句翻译）；高级 60 包只有主题骨架 |
| 场景对话 | 25 组 / 364 轮。每组含场景说明、12–16 轮对话、6 条关键句（标可替换部分）、8 个生词、2–3 条本地贴士 |
| 语法学习 | 8 个模块 / 61 课 / 217 条词缀条目（meN- / ber- / ter- / peN- / di- 体系） |
| 配图 | 557 个 OpenMoji SVG，词条专属配图覆盖 1465/2020（73%），其余走主题图（每个主题都有专属图）|

## 授权模式

`lib/config.js` 里的 `AUTH_MODE` 决定走哪种：

- `'remote'`（当前线上用的）：账号 + 激活码，服务器（Cloudflare Workers + D1）能吊销单个账号。见下面「账号系统」。
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
  失效」在物理上不可能——这是可吊销与可离线之间的必然取舍。

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
accounts(id, email UNIQUE, password_hash, salt, status, created_at)
codes(code_hash UNIQUE, account_id NULL, issued_at, used_at, expires_at NULL)
content_keys(version, cek, is_current, created_at)
attempts(ip, endpoint, ts)          -- 限流用，见 idx_attempts 索引
error_log(id, ts, method, path, name, message)  -- 未被业务逻辑捕获的异常，纯排障用
```

完整建表语句见 `server/schema.sql`；`status` 取值 `pending`（未激活）/ `active` /
`disabled`（吊销）。

日常查账号状态、停用/启用账号、重置密码、查激活码绑定情况，用 `tools/admin.mjs`
（见下面「运维」），不要手写 SQL——它会带上安全的字段筛选（比如查账号从不选
`password_hash`/`salt`）。真要跑一次性排查 SQL，走：

```bash
cd server
export $(cat ~/.cloudflare-token) && npx wrangler d1 execute indo-learn --remote --command "SELECT ..."
```

## 两种发码模式

`server/wrangler.toml` 的 `[vars] AUTO_ISSUE_CODE` 控制，改了要 `npx wrangler deploy` 重新部署。
**两种模式下 `/register` 都会当场生成一张码、直接绑定到刚建的账号**（一张码只能激活它
所属的那个账号），码 30 分钟内不激活就失效，且**都会推送到负责人的 Telegram**
（见下面「Telegram 通知配置」）；区别只在于明文码是否也直接返回给注册者本人：

- `"true"`（前期，自己人用）：`/register` 响应里带明文码，注册页直接显示 + 提供
  复制按钮，用户自己走完注册 → 激活。
- `"false"`（后期，卖码模式）：`/register` 响应里**没有**明文码（服务器只存哈希，给了
  也白给）——注册页提示「激活码将由管理员发放，请联系管理员获取」，明文码只在
  Telegram 推送里能看到，由负责人手动告知买家。

  这个模式下不再需要靠 `tools/issue-code.mjs` 预先批量生码——每次注册都会自动生成
  绑定好的码。`issue-code.mjs` 仍然保留，用于批量生成**不绑定任何账号**的散码（`account_id`
  为空、永不过期），给老式「先发码后注册」的场景用：

  ```bash
  cd /home/barnabas/印尼语学习
  node tools/issue-code.mjs --count 20
  ```

### 待激活用户拿不到码怎么办：`POST /request-code`

负责人可能在睡觉，注册者不能干等 30 分钟码过期。激活页有「重新申请激活码」按钮，
调 `POST /request-code`（需要 Bearer 令牌）：账号还是 `pending` 状态时，作废该账号名下
所有未使用的旧码，生成一张新码（30 分钟有效）重新绑定 + 推送 Telegram；账号已经是
`active` 直接返回 `{ok:true, status:'active'}`；`disabled` 账号返回 403。限流：同一 IP
每小时最多 3 次。

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

## 运维：`tools/admin.mjs`

```bash
cd /home/barnabas/印尼语学习

# 列出账号（id / email / status / created_at，不显示哈希与盐）
node tools/admin.mjs list
node tools/admin.mjs list --email rebecca      # 按邮箱关键字模糊筛选

# 停用 / 启用账号（吊销就是把 status 改成 disabled）
node tools/admin.mjs disable someone@example.com
node tools/admin.mjs enable someone@example.com

# 重置密码（本地算好 PBKDF2 哈希 + 盐再写库，不是明文入库）
node tools/admin.mjs reset-password someone@example.com --password '新密码'

# 查激活码绑定情况（哈希只显示前 8 位，account_id、used_at）
node tools/admin.mjs codes
node tools/admin.mjs codes --unused            # 只看还没被绑定的码
```

⚠️ 这个脚本直接改生产 D1（`indo-learn`），**只在个人开发机手动跑**，不接 CI、
不接共享机器——同机其他进程能在 `ps` 里看到命令行参数（包括 `reset-password` 时的
邮箱和算好的哈希/盐，虽然不是明文密码本身）。

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
```

**为什么第 2 步必须排在第 4 步前面、且不能跳过**：`remote` 模式下浏览器解密内容靠的是
服务器下发的密钥（CEK），不是本地密码。如果先推了 Pages（新版密文已经在线上），
D1 里还是旧版本的密钥，前端会先拿旧密钥去解新密文（失败），触发刷新密钥的逻辑，
但服务器给的还是旧版本号——版本对不上，前端会明确报 `content_outdated`（「内容已更新，
请联网后重新打开」），用户卡在这条提示上出不去，直到有人想起来去补第 2 步。反过来，
`push-content-key.mjs` 每次是**新增一行密钥并把旧行标记为非当前**（新旧密钥短暂并存），
所以第 2 步可以放心提前做，不会破坏还在用旧版本的客户端。

第 3 步（升级 `sw.js` 缓存名）漏了的后果：Service Worker 会继续用缓存里的旧 `app.js`/
视图文件，用户即使刷新页面也可能感知不到代码层面的更新（内容本身因为
`data/manifest.json` 是 network-first，通常还是能拿到新版本，但不能依赖这一点掩盖
该升级缓存名的事实）。

`password` 模式（`AUTH_MODE = 'password'`）不涉及 D1，跳过第 2 步即可，只走 1、3、4。

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
| `lib/tts.js` | Web Speech `id-ID` 封装 |
| `lib/icons.js` / `lib/emoji-map.js` | 词 → OpenMoji 映射，三级回退 |
| `lib/views/` | 视图：解锁（旧模式）、注册/登录/激活（`auth.js`，新模式）、单词包、对话、语法 |
| `server/` | Cloudflare Workers + D1 后端：`src/routes.js`（四个接口）、`src/crypto.js`（密码哈希/令牌）、`src/codes.js`（激活码生成/哈希）、`src/db.js`（SQL 封装）、`schema.sql`（建表）、`wrangler.toml`（部署配置） |
| `tools/` | 提取、生成、校验、打包脚本（本机运行） |
| `tools/push-content-key.mjs` | 把内容密钥灌进 D1（发布流程第 2 步，见上） |
| `tools/issue-code.mjs` | 卖码模式下本地批量生成激活码，明文只打印一次 |
| `tools/admin.mjs` | 运维：查账号、停用/启用、重置密码、查激活码绑定 |
| `content-src/` | 明文内容，**不提交** |
| `reference/` | 参考资料，**不提交** |
| `data/` | 加密产物，提交并发布 |
| `sw.js` | Service Worker，缓存策略见文件内注释 |

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
