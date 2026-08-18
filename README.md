# 印尼语学习

纯前端离线 PWA。三个模块：**单词包**、**场景对话**、**语法学习**。
内容经 AES-GCM 加密，需密码解锁。手机上「添加到主屏幕」后可全屏离线使用。

当前内容规模：

| 模块 | 内容 |
|---|---|
| 单词包 | 初级 102 包 + 中级 100 包 = 2020 词条（词 + 词性 + 中文释义 + 例句 + 例句翻译）；高级 60 包只有主题骨架 |
| 场景对话 | 10 组（打招呼 / 买东西 / 点餐 / 问路 / 看病 / 坐车 / 租房 / 银行 / 学校 / 教会），每组 10 轮 + 关键句 + 生词 |
| 语法学习 | 8 个模块 / 61 课 / 217 条词缀条目（meN- / ber- / ter- / peN- / di- 体系） |
| 配图 | 557 个 OpenMoji SVG，词条专属配图覆盖 1465/2020（73%），其余走主题图（每个主题都有专属图）|

## 打包内容

密码从命令行参数或 `CONTENT_PASSWORD` 环境变量读取，**绝不写进仓库任何文件**：

```bash
node tools/pack-content.mjs --password "$(cat ~/.indo-pass)" --version v1
```

（`~/.indo-pass` 是本机上保存密码的文件，在仓库之外。）

## 换密码

换密码**必须同时提高版本号** —— 脚本每次都生成全新的 CEK 并重新加密全部内容：

```bash
node tools/pack-content.mjs --password '新密码' --version v2
```

只换 `keys.json` 而复用同一个 CEK 是无效的：保留了旧 `keys.json` 的人用旧密码
仍能解出同一个 CEK，进而解开新数据。重新加密全部内容只需几秒。

换版本后 `data/v1/` 可以删掉，也可以留着（旧客户端在缓存过期前还会用）。

## 安全边界

这些限制是设计使然，不是缺陷：

- 纯静态离线应用**做不到真正的吊销**。用户一旦下载过加密包并拿到过密码，
  那份数据就永久在其手中，更换密码不影响已持有的副本。
- 密码轮换只保护**此后发布的内容**。
- 离线状态下应用会回落到缓存的旧 `manifest.json` 与 `keys.json`，
  此时旧密码仍然有效。要做到离线也立即失效，在物理上不可能。
- 拿到密码的人可以导出明文并转发。加密挡的是随手复制，挡不住蓄意获取。
- 要实现即时吊销，唯一途径是服务器下发短期令牌 —— `lib/provider.js`
  已为此预留了接口，届时新增 `RemoteProvider` 替换即可，UI 层不用改。

## 部署

已上线：<https://barnabas-creator.github.io/indo-learn/>

GitHub Pages 走「从 `main` 分支根目录部署」，没有构建步骤、没有 Actions 工作流。
推到 `main` 即自动发布。

改完内容后的发布流程：

```bash
node tools/check-content.mjs
node tools/pack-content.mjs --password "$(cat ~/.indo-pass)" --version v1
node --test tools/*.test.mjs
git add data && git commit -m "chore: 更新内容" && git push
```

## 本地开发

```bash
python3 -m http.server 8123
```

浏览器打开 <http://localhost:8123>。

## 跑测试

```bash
node --test tools/*.test.mjs
```

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
node tools/check-content.mjs                       # 校验词库与对话，并列出例句里的生词
node tools/fetch-openmoji.mjs                      # 按映射表拉取用到的 OpenMoji SVG
node tools/pack-content.mjs --password '密码' --version v1
```

## 目录

| 路径 | 说明 |
|---|---|
| `index.html` / `app.js` / `styles.css` | 外壳与路由 |
| `lib/catalog.js` | 三级主题骨架（生成物，勿手改）。哪个包已开放看有没有词条 |
| `lib/crypto.js` | AES-GCM / PBKDF2，浏览器与 Node 共用 |
| `lib/provider.js` | 内容访问接口、解锁凭据管理（有效期 30 天） |
| `lib/tts.js` | Web Speech `id-ID` 封装 |
| `lib/icons.js` / `lib/emoji-map.js` | 词 → OpenMoji 映射，三级回退 |
| `lib/views/` | 四个视图：解锁、单词包、对话、语法 |
| `tools/` | 提取、生成、校验、打包脚本（本机运行） |
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

改完后回填 `content-src/batches/batch-*.json`，再重跑：

```bash
node tools/merge-batches.mjs && node tools/check-content.mjs
node tools/pack-content.mjs --password "$(cat ~/.indo-pass)" --version v1
git add data && git commit -m "chore: 内容修订" && git push
```

## 授权

配图来自 [OpenMoji](https://openmoji.org)，授权
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)。
