# FlowDev-AI 使用手册

> **核心承诺**: 守门员沉淀规则 → 团队开发者下次 git commit 自动同步 → 无需任何手动操作

本手册由 `docs/gen-handbook.js` 自动从源代码注释生成。最后同步: hook v2.0.4 (sha:a6e979a3)

## 📖 目录

- [push-mode](#push-mode)
- [hook-self-upgrade](#hook-self-upgrade)
- [hook-version-api](#hook-version-api)

## push-mode

<!-- source: scripts/flowdev-hook.js -->

服务端升级规则后, **主动下发**到所有本地仓库, 开发者下次 commit 自动同步。

触发点: `POST /api/projects/{id}/push` 或 `apply` 操作自动伴随推送。
拉取点: hook 启动时调 `GET /api/projects/{id}/sync-status` 检查 pending。
应用点: 开发者 commit 时被询问 Y/n, 按 Y 后写入 8 个 IDE 规则文件 + ack。

可用端点:
  GET    /sync-status       查询推送状态
  POST   /push              手动推送 (仅给服务端触发)
  POST   /ack-push          本地确认应用
  POST   /cancel-push       本地拒绝 (pending 清空, 不再打扰)
  PUT    /push-enabled      启用/关闭项目推送

关闭推送 (三层任选):
  - 环境变量: `FLOWDEV_DISABLE_PUSH=1`
  - 仓库级: `git config flowdev.pushmode false`
  - 项目级: Web 端切换 push_enabled = false

## hook-self-upgrade

<!-- source: scripts/flowdev-hook.js -->

每次 hook 启动时, 自检服务端 `/api/hook/version`, 发现新版本则:
  1. 下载 `/scripts/flowdev-hook.js` 全文
  2. 备份当前 hook 到 `.git/hooks/pre-commit.bak`
  3. 写入新版本到当前 hook
  4. `spawnSync` 重新跑一遍新 hook
  5. 失败自动回滚

**对开发者完全透明**: 团队升级 hook 无需任何运维操作, 下次 commit 自动用新版。

手动触发: `node .git/hooks/pre-commit --upgrade`
服务端版本端点: `GET /api/hook/version` → `{version, sha, size, download_url}`
备份文件: `.git/hooks/pre-commit.bak` (每次升级覆写)

## hook-version-api

<!-- source: backend/main.py -->

**Hook 自升级协议的源头端点。**

Hook 启动时调这里, 服务器返回当前 hook 版本号 + sha + size + 下载地址。
Hook 端比对 local_version vs server.version, 如需升级:
  1. GET /scripts/flowdev-hook.js 下载新脚本
  2. 备份 .git/hooks/pre-commit.bak
  3. 写入新脚本 + 重新 spawn

零运维: 改完 hook 代码, 改顶部 const HOOK_VERSION = "X.Y.Z", 团队所有项目下次 commit 自动升级。
