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

// Generate pre-commit hook content for the target repo
const hookContent = `#!/bin/sh
# FlowDev-AI External Pre-Commit Hook
# Auto-installed by FlowDev-AI for project: ${path.basename(targetDir)}

node "${flowDevHookScript}"
`;

try {
  fs.writeFileSync(hookPath, hookContent, { encoding: "utf-8", mode: 0o755 });
  try {
    fs.chmodSync(hookPath, 0o755);
  } catch (e) {}

  console.log("\n✔ 成功为外部项目安装 FlowDev-AI 门禁钩子！");
  console.log(`   钩子路径: ${hookPath}`);
  console.log(`   引用的审查引擎: ${flowDevHookScript}`);
  console.log("\n🎉 即刻生效！只要 FlowDev 后端正在运行 (http://localhost:8000):");
  console.log(`   在 ${path.basename(targetDir)} 目录执行 'git commit' 时即可享受全自动多 Agent 安全与单测门禁！\n`);
} catch (err) {
  console.error(`\n❌ 安装失败: ${err.message}`);
  process.exit(1);
}
