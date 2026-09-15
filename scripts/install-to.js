#!/usr/bin/env node

/**
 * Installs FlowDev-AI Pre-Commit Hook into any other Git repository on your machine.
 *
 * Usage:
 *   node scripts/install-to.js <path-to-other-git-project>
 *   pnpm run install-to <path-to-other-git-project>
 *
 * Example:
 *   node scripts/install-to.js "C:\Users\Administrator\Desktop\my-vue-app"
 */

const fs = require("fs");
const path = require("path");

const targetRepoArg = process.argv[2];

if (!targetRepoArg) {
  console.log("\n❌ 请指定目标 Git 项目的绝对或相对路径！\n");
  console.log("使用方式:");
  console.log("  node scripts/install-to.js <目标项目路径>");
  console.log("示例:");
  console.log('  node scripts/install-to.js "D:\\projects\\my-backend"');
  console.log('  pnpm run install-to "C:\\workspace\\frontend-app"\n');
  process.exit(1);
}

const targetDir = path.resolve(process.cwd(), targetRepoArg);
const gitDir = path.join(targetDir, ".git");
const hooksDir = path.join(gitDir, "hooks");
const hookPath = path.join(hooksDir, "pre-commit");

console.log("\n============================================================");
console.log("🛡️  FlowDev-AI 外部项目 Git 门禁安装工具");
console.log("============================================================");
console.log(`目标项目目录: ${targetDir}`);

if (!fs.existsSync(targetDir)) {
  console.error(`\n❌ 目标目录不存在: ${targetDir}`);
  process.exit(1);
}

if (!fs.existsSync(gitDir)) {
  console.error(`\n❌ 目标目录不是一个 Git 仓库 (未找到 .git 文件夹): ${targetDir}`);
  console.log("💡 提示: 请先在目标项目中执行 'git init' 初始化仓库。");
  process.exit(1);
}

if (!fs.existsSync(hooksDir)) {
  fs.mkdirSync(hooksDir, { recursive: true });
}

// Absolute path to this FlowDev hook script
const flowDevHookScript = path.resolve(__dirname, "flowdev-hook.js").replace(/\\/g, "/");
const backupPath = hookPath + ".flowdev-orig";

let hasExistingHook = false;
if (fs.existsSync(hookPath)) {
  const existing = fs.readFileSync(hookPath, "utf-8");
  if (!existing.includes("flowdev-hook.js")) {
    hasExistingHook = true;
    fs.writeFileSync(backupPath, existing, { encoding: "utf-8", mode: 0o755 });
    console.log(`ℹ 检测到目标仓库已有原 pre-commit 钩子，已自动备份至: ${backupPath}`);
  }
}

// Generate pre-commit hook content for the target repo with chain support
const hookContent = `#!/bin/sh
# FlowDev-AI Pre-Commit Guard (Local Personal Probe)
# 100% 本地个人专属，不会被 Git 提交，对团队其他成员零污染、零感知

export LANG="zh_CN.UTF-8"
export LC_ALL="zh_CN.UTF-8"

node "${flowDevHookScript}"
FLOWDEV_EXIT=$?

if [ $FLOWDEV_EXIT -ne 0 ]; then
  exit $FLOWDEV_EXIT
fi

# 若存在原先团队钩子 (如 husky/lint-staged)，无缝继续串联执行
if [ -f "$0.flowdev-orig" ]; then
  sh "$0.flowdev-orig" "$@"
fi
`;

try {
  fs.writeFileSync(hookPath, hookContent, { encoding: "utf-8", mode: 0o755 });
  try {
    fs.chmodSync(hookPath, 0o755);
  } catch (e) {}

  console.log("\n✔ 成功为目标项目安装 FlowDev-AI 本地个人门禁！");
  console.log(`   钩子路径: ${hookPath}`);
  console.log(`   引用的审查引擎: ${flowDevHookScript}`);
  if (hasExistingHook) {
    console.log(`   🔗 钩子串联: FlowDev-AI 审查通过后将自动执行原有的团队钩子，双重保障！`);
  }
  console.log("\n🔒 零污染保障说明:");
  console.log("   1. 钩子位于 .git/hooks/ 内部，Git 默认忽略此目录，绝对不会被 git commit 提交到远程仓库；");
  console.log("   2. 未向目标项目引入任何 npm 包，未修改 package.json，其他同事完全不受影响；");
  console.log("   3. 若本地未启动 FlowDev-AI 服务，提交将自动静默放行，绝不阻碍正常研发；");
  console.log("   4. 随时可通过 'node scripts/uninstall-from.js <路径>' 一键无痕卸载。\n");
} catch (err) {
  console.error(`\n❌ 安装失败: ${err.message}`);
  process.exit(1);
}
