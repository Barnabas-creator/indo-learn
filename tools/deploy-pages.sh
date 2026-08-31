#!/usr/bin/env bash
# 把站点发布到 Cloudflare Pages（https://indo-learn.pages.dev）。
#
# 为什么不用 Pages 连 GitHub 自动部署：那要在网页面板里授权 GitHub OAuth，
# 而本机只有 API 令牌。直传省掉这层授权，代价是每次发布要手动跑一次。
#
# 上传清单来自 git ls-files，再剔掉 server/ tools/ docs/ README —— 明文内容
# （content-src/ reference/ *审校*）本来就在 .gitignore 里，跟着这份清单走
# 就不会误传。**只上传已提交的文件**：没 commit 的改动不会发出去。
#
# 用法：bash tools/deploy-pages.sh
set -euo pipefail

cd "$(dirname "$0")/.."
export $(cat ~/.cloudflare-token)

STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT

git ls-files -z | grep -zv '^\(server/\|tools/\|docs/\|README.md\|.gitignore\)' |
  while IFS= read -r -d '' f; do
    mkdir -p "$STAGE/$(dirname "$f")"
    cp "$f" "$STAGE/$f"
  done

npx --yes wrangler@latest pages deploy "$STAGE" \
  --project-name indo-learn --branch main --commit-dirty=true
