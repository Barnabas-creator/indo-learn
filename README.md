# 印尼语学习

纯前端离线 PWA。三个模块：**单词包**、**场景对话**、**语法学习**。
内容经 AES-GCM 加密，需密码解锁。手机上「添加到主屏幕」后可全屏离线使用。

当前内容规模：

| 模块 | 内容 |
|---|---|
| 单词包 | 100 个主题包 × 10 词 = 1000 词条（词 + 词性 + 中文释义 + 例句 + 例句翻译） |
| 场景对话 | 10 组（打招呼 / 买东西 / 点餐 / 问路 / 看病 / 坐车 / 租房 / 银行 / 学校 / 教会），每组 10 轮 + 关键句 + 生词 |
| 语法学习 | 8 个模块 / 61 课 / 217 条词缀条目（meN- / ber- / ter- / peN- / di- 体系） |
| 配图 | 400 个 OpenMoji SVG，词条专属配图覆盖 854/1000（85%），其余走主题图 |

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

## 本地开发

```bash
python3 -m http.server 8123
```

浏览器打开 <http://localhost:8123>。

## 跑测试

```bash
node --test tools/*.test.mjs
```

## 重新生成内容

```bash
node tools/extract-packs.mjs                       # 从 reference/ 提取 100 个包骨架
node tools/extract-grammar.mjs                     # 提取语法课程 + SVG 插图
node tools/merge-batches.mjs                       # 合并 content-src/batches/*.json 成 packs.json
node tools/check-content.mjs                       # 校验词库与对话（--partial 只校验已填词的包）
node tools/fetch-openmoji.mjs                      # 按映射表拉取用到的 OpenMoji SVG
node tools/pack-content.mjs --password '密码' --version v1
```

## 目录

| 路径 | 说明 |
|---|---|
| `index.html` / `app.js` / `styles.css` | 外壳与路由 |
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
发现问题改 `content-src/batches/batch-*.json`，然后重跑合并、校验、打包三步。

## 授权

配图来自 [OpenMoji](https://openmoji.org)，授权
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)。
