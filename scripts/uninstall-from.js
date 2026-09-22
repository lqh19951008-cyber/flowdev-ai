#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const targetRepoArg = process.argv[2];

if (!targetRepoArg) {
  console.log('\n❌ 请指定目标 Git 项目的绝对或相对路径！\n');
  console.log('使用方式:');
  console.log('  node scripts/uninstall-from.js <目标项目路径>\n');
  process.exit(1);
}

const targetDir = path.resolve(process.cwd(), targetRepoArg);
const hookPath = path.join(targetDir, '.git', 'hooks', 'pre-commit');
const backupPath = hookPath + '.flowdev-orig';

console.log('\n============================================================');
console.log('🧹 FlowDev-AI 个人门禁无痕卸载工具');
console.log('============================================================');
console.log('目标项目目录: ' + targetDir);

if (!fs.existsSync(hookPath)) {
  console.log('\nℹ 未在目标仓库中检测到 pre-commit 钩子，无需卸载。');
  process.exit(0);
}

try {
  if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, hookPath);
    fs.unlinkSync(backupPath);
    console.log('\n✔ 成功卸载 FlowDev-AI 门禁，并已完整恢复仓库原有 hook！');
  } else {
    const content = fs.readFileSync(hookPath, 'utf-8');
    if (content.includes('FlowDev-AI')) {
      fs.unlinkSync(hookPath);
      console.log('\n✔ 成功移除 FlowDev-AI pre-commit 钩子，仓库已恢复初始纯净状态！');
    } else {
      console.log('\n⚠️ 目标仓库的 pre-commit 并非 FlowDev-AI 钩子，未做任何修改以保安全。');
    }
  }
} catch (e) {
  console.error('\n❌ 卸载失败: ' + e.message);
  process.exit(1);
}
