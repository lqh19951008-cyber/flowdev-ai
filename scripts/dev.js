#!/usr/bin/env node
/**
 * FlowDev 跨平台服务管理入口
 * ----------------------------------------
 *  - Windows   : 委托给 manage.ps1 / start.ps1 (PowerShell)
 *  - macOS/Linux: 使用 scripts/dev-unix.js (Node 实现)
 *
 * 用法:
 *   node scripts/dev.js <action>
 *
 * 可用 action:
 *   all       一键启动前后端 (默认)
 *   backend   只启动后端
 *   frontend  只启动前端
 *   stop      停止所有服务
 *   status    查看服务状态
 *   logs      查看最新日志
 *   restart   重启所有服务
 *   menu      打开交互式菜单 (仅 Windows)
 */

const path = require("path");
const { spawn } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const isWin = process.platform === "win32";
const action = (process.argv[2] || "all").toLowerCase();

const START_ACTIONS = new Set(["all", "backend", "frontend"]);

function runWindows() {
  const psArgs = ["-NoProfile", "-ExecutionPolicy", "Bypass"];

  if (START_ACTIONS.has(action)) {
    psArgs.push("-File", path.join(ROOT, "start.ps1"), "-NoBrowser");
    if (action === "backend") psArgs.push("-BackendOnly");
    if (action === "frontend") psArgs.push("-FrontendOnly");
  } else if (action === "menu") {
    psArgs.push("-File", path.join(ROOT, "manage.ps1"), "-Action", "menu");
  } else {
    psArgs.push("-File", path.join(ROOT, "manage.ps1"), "-Action", action);
  }

  const ps = spawn("powershell.exe", psArgs, { stdio: "inherit", cwd: ROOT });
  ps.on("exit", (code) => process.exit(code ?? 0));
}

(async () => {
  if (isWin) {
    runWindows();
    return;
  }

  // macOS / Linux 路径
  if (action === "menu") {
    console.log("ℹ️  交互式菜单仅在 Windows 上可用。");
    console.log("   在 macOS / Linux 上请使用: dev:status / dev:logs / dev:stop / dev:restart");
    process.exit(0);
  }

  await require("./dev-unix")(ROOT, action);
})().catch((err) => {
  console.error("\n✗ [FlowDev] 错误:", err?.message ?? err);
  if (process.env?.FLOWDEV_DEBUG) console.error(err?.stack);
  process.exit(1);
});