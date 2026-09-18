/**
 * FlowDev 跨平台服务管理 - macOS / Linux 实现
 * ----------------------------------------
 * 使用 child_process.spawn 直接拉起 uvicorn 与 next dev。
 * 日志重定向到 logs/backend.log 与 logs/frontend.log。
 * 进程 PID 持久化到 logs/pids.json，便于后续 stop / status。
 */

const { spawn, execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const http = require("http");

const LOG_DIR = path.join(__dirname, "..", "logs");
const PID_FILE = path.join(LOG_DIR, "pids.json");
const BACKEND_LOG = path.join(LOG_DIR, "backend.log");
const FRONTEND_LOG = path.join(LOG_DIR, "frontend.log");

const C = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};
const color = (s, c) => (process.stdout.isTTY ? `${c}${s}${C.reset}` : s);

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
}

function which(cmd) {
  try {
    return execSync(`command -v ${cmd}`, { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] })
      .trim() || null;
  } catch {
    return null;
  }
}

function detectPython() {
  return which("python3") ? "python3" : which("python") ? "python" : null;
}

function detectPkgManager() {
  return which("pnpm") ? "pnpm" : which("npm") ? "npm" : null;
}

function killByPort(port) {
  try {
    if (process.platform === "darwin" || which("lsof")) {
      execSync(`lsof -ti:${port} 2>/dev/null | xargs -r kill -9`, {
        stdio: ["ignore", "ignore", "ignore"],
        shell: "/bin/bash",
      });
    } else if (which("fuser")) {
      execSync(`fuser -k ${port}/tcp 2>/dev/null`, { stdio: ["ignore", "ignore", "ignore"] });
    } else {
      execSync(`(ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null) | grep -E ':${port}\\s'`, {
        stdio: ["ignore", "pipe", "ignore"],
        shell: "/bin/bash",
      });
    }
  } catch {
    /* 端口可能本来就没被占用 */
  }
}

function killByPid(pid) {
  if (!pid) return;
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    /* 进程可能已退出 */
  }
}

function readPids() {
  if (!fs.existsSync(PID_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(PID_FILE, "utf-8"));
  } catch {
    return null;
  }
}

function writePids(data) {
  ensureLogDir();
  fs.writeFileSync(PID_FILE, JSON.stringify(data, null, 2));
}

function clearPids() {
  if (fs.existsSync(PID_FILE)) {
    try { fs.unlinkSync(PID_FILE); } catch { /* ignore */ }
  }
}

function httpGet(url) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: 2000 }, (res) => {
      resolve({ ok: res.statusCode >= 200 && res.statusCode < 400, status: res.statusCode });
      res.resume();
    });
    req.on("error", () => resolve({ ok: false }));
    req.on("timeout", () => { req.destroy(); resolve({ ok: false }); });
  });
}

async function waitForReady(url, timeoutSec = 30, label = "") {
  const start = Date.now();
  process.stdout.write(color(`  等待 ${label || url} 就绪 (最多 ${timeoutSec}s) `, "dim"));
  while ((Date.now() - start) / 1000 < timeoutSec) {
    const r = await httpGet(url);
    if (r.ok) {
      process.stdout.write(color(" ✓ 就绪\n", "green"));
      return true;
    }
    process.stdout.write(".");
    await new Promise((r) => setTimeout(r, 1000));
  }
  process.stdout.write(color(" ✗ 超时\n", "yellow"));
  return false;
}

async function spawnBackground(name, cmd, args, cwd, logFile) {
  ensureLogDir();
  const banner = `\n==================== FlowDev ${name} Log [${new Date().toISOString()}] ====================\n`;
  fs.appendFileSync(logFile, banner);

  const out = fs.openSync(logFile, "a");
  const err = fs.openSync(logFile, "a");
  const proc = spawn(cmd, args, {
    cwd,
    stdio: ["ignore", out, err],
    detached: true, // 脱离父进程，npm 退出后继续运行
    shell: false,
    env: process.env,
  });
  proc.unref();
  return proc.pid;
}

async function startBackend(onlyOne) {
  const py = detectPython();
  if (!py) {
    throw new Error(
      "未检测到 python3 / python。请先安装 Python 3.10+，并将其加入 PATH。",
    );
  }

  // 检测 uvicorn / fastapi 是否就绪
  try {
    execSync(`${py} -c "import uvicorn, fastapi"`, { stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    console.log(color("  → 正在安装 backend 依赖 (pip install -r backend/requirements.txt)…", "cyan"));
    execSync(`${py} -m pip install -r ${path.join(__dirname, "..", "backend", "requirements.txt")}`, {
      stdio: "inherit",
    });
  }

  killByPort(8000);

  console.log(color("→ 启动后端 (FastAPI / Uvicorn, 端口 8000)", "cyan"));
  const pid = await spawnBackground(
    "Backend",
    py,
    ["-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000"],
    path.join(__dirname, "..", "backend"),
    BACKEND_LOG,
  );
  console.log(`  PID: ${pid} | 日志: ${path.relative(process.cwd(), BACKEND_LOG)}`);
  return pid;
}

async function startFrontend() {
  const pkg = detectPkgManager();
  if (!pkg) {
    throw new Error("未检测到 pnpm 或 npm，请先安装 Node.js 18+ 与包管理器。");
  }

  killByPort(3000);

  console.log(color("→ 启动前端 (Next.js, 端口 3000)", "cyan"));
  const pid = await spawnBackground(
    "Frontend",
    pkg,
    ["run", "dev"],
    path.join(__dirname, ".."),
    FRONTEND_LOG,
  );
  console.log(`  PID: ${pid} | 日志: ${path.relative(process.cwd(), FRONTEND_LOG)}`);
  return pid;
}

async function actionAll() {
  console.log(color("\n================================================================", "cyan"));
  console.log(color(" FlowDev-AI 一键启动 (跨平台版 / macOS · Linux)", "cyan"));
  console.log(color("================================================================\n", "cyan"));

  const py = detectPython();
  const pkg = detectPkgManager();
  console.log(`[环境检查] Python: ${py ? color(py, "green") : color("✗ 未安装", "red")} | 包管理器: ${pkg ? color(pkg, "green") : color("✗ 未安装", "red")}`);
  if (!py || !pkg) {
    throw new Error("前置依赖缺失，请先安装 Python 3.10+ 与 Node.js 18+ (pnpm/npm)");
  }

  const backendPid = await startBackend();
  const frontendPid = await startFrontend();

  writePids({
    backend: { pid: backendPid, port: 8000, url: "http://127.0.0.1:8000" },
    frontend: { pid: frontendPid, port: 3000, url: "http://localhost:3000" },
    started_at: new Date().toISOString(),
  });

  const backendOk = await waitForReady("http://127.0.0.1:8000/api/health", 30, "后端 /api/health");
  const frontendOk = await waitForReady("http://localhost:3000", 60, "前端 :3000");

  console.log();
  console.log(color("================================================================", "cyan"));
  console.log(color(" FlowDev-AI 服务启动完成", "bold"));
  console.log(color("================================================================", "cyan"));
  console.log(`  前端:    ${color("http://localhost:3000", "green")}  ${frontendOk ? "✓" : "(尚未就绪)"}`);
  console.log(`  后端:    ${color("http://127.0.0.1:8000", "green")}  ${backendOk ? "✓" : "(尚未就绪)"}`);
  console.log(`  API 文档: ${color("http://127.0.0.1:8000/docs", "dim")}`);
  console.log(color("================================================================\n", "cyan"));
  console.log(color("服务已在后台运行 (spawn detached)。可用以下命令管理：", "dim"));
  console.log("  pnpm dev:status  查看状态");
  console.log("  pnpm dev:logs    查看日志");
  console.log("  pnpm dev:stop    停止服务");
  console.log("  pnpm dev:restart 重启服务\n");
}

async function actionBackend() {
  const backendPid = await startBackend(true);
  writePids({ backend: { pid: backendPid, port: 8000, url: "http://127.0.0.1:8000" }, started_at: new Date().toISOString() });
  await waitForReady("http://127.0.0.1:8000/api/health", 30, "后端 /api/health");
}

async function actionFrontend() {
  const frontendPid = await startFrontend();
  writePids({ frontend: { pid: frontendPid, port: 3000, url: "http://localhost:3000" }, started_at: new Date().toISOString() });
  await waitForReady("http://localhost:3000", 60, "前端 :3000");
}

async function actionStop() {
  console.log(color("→ 停止所有服务…", "yellow"));
  const pids = readPids();
  if (pids?.backend?.pid) killByPid(pids.backend.pid);
  if (pids?.frontend?.pid) killByPid(pids.frontend.pid);
  killByPort(8000);
  killByPort(3000);
  clearPids();
  console.log(color("✓ 已停止所有服务 (端口 8000 / 3000 已释放)", "green"));
}

async function actionStatus() {
  console.log(color("================================================================", "cyan"));
  console.log(color(" FlowDev-AI 服务状态", "bold"));
  console.log(color("================================================================\n", "cyan"));

  const backendHealth = await httpGet("http://127.0.0.1:8000/api/health");
  const frontendPage = await httpGet("http://localhost:3000");

  const backendLine = backendHealth.ok
    ? color("✓ 运行中", "green") + color(` (HTTP ${backendHealth.status})`, "dim")
    : color("✗ 未运行", "red");
  const frontendLine = frontendPage.ok
    ? color("✓ 运行中", "green") + color(` (HTTP ${frontendPage.status})`, "dim")
    : color("✗ 未运行", "red");

  console.log(`  [后端] :8000  ${backendLine}`);
  console.log(`  [前端] :3000  ${frontendLine}`);

  const pids = readPids();
  if (pids) {
    console.log(color("\n  记录的 PID:", "dim"));
    if (pids.backend?.pid) console.log(`    后端 PID: ${pids.backend.pid}`);
    if (pids.frontend?.pid) console.log(`    前端 PID: ${pids.frontend.pid}`);
    if (pids.started_at) console.log(`    启动时间: ${pids.started_at}`);
  }

  console.log(color("\n  日志:", "dim"));
  for (const [name, p] of [["后端", BACKEND_LOG], ["前端", FRONTEND_LOG]]) {
    if (fs.existsSync(p)) {
      const s = fs.statSync(p);
      console.log(`    ${name}: ${path.relative(process.cwd(), p)} (${(s.size / 1024).toFixed(1)} KB)`);
    } else {
      console.log(`    ${name}: (无日志文件)`);
    }
  }
  console.log();
}

async function actionLogs() {
  ensureLogDir();
  for (const [name, file] of [["backend", BACKEND_LOG], ["frontend", FRONTEND_LOG]]) {
    console.log(color(`\n=== ${name}.log (tail 30 行) ===`, "cyan"));
    if (fs.existsSync(file)) {
      const lines = fs.readFileSync(file, "utf-8").split("\n");
      console.log(lines.slice(-30).join("\n"));
    } else {
      console.log(color("(无日志文件)", "dim"));
    }
  }
  console.log();
}

async function actionRestart() {
  await actionStop();
  await new Promise((r) => setTimeout(r, 1500));
  await actionAll();
}

module.exports = async function (root, action) {
  switch (action) {
    case "all":      return actionAll();
    case "backend":  return actionBackend();
    case "frontend": return actionFrontend();
    case "stop":     return actionStop();
    case "status":   return actionStatus();
    case "logs":     return actionLogs();
    case "restart":  return actionRestart();
    default:
      console.error(`✗ 未知 action: ${action}`);
      console.error("  可用: all | backend | frontend | stop | status | logs | restart");
      process.exit(1);
  }
};