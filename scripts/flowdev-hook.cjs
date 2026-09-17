#!/usr/bin/env node

/**
 * FlowDev-AI Pre-Commit Git Hook & CLI Code Review Gatekeeper
 *
 * Lightweight script using 100% native Node.js modules:
 * - Extracts staged code files via `git diff --cached`
 * - Sends staged code to FlowDev FastAPI backend (/api/cli/scan)
 * - Intercepts commit with exit code 1 if critical defects are detected
 * - Allows commit with exit code 0 if all checks & sandbox unit tests pass
 */

const { execSync } = require("child_process");
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

// TTY and Color detection (disable ANSI escape codes in VS Code GUI popup/non-TTY to avoid □[36m garbled characters)
const isColorSupported = Boolean(
  process.stdout.isTTY &&
  !process.env.NO_COLOR &&
  process.env.TERM !== "dumb"
);

const c = {
  reset: isColorSupported ? "\x1b[0m" : "",
  bold: isColorSupported ? "\x1b[1m" : "",
  dim: isColorSupported ? "\x1b[2m" : "",
  red: isColorSupported ? "\x1b[31m" : "",
  green: isColorSupported ? "\x1b[32m" : "",
  yellow: isColorSupported ? "\x1b[33m" : "",
  cyan: isColorSupported ? "\x1b[36m" : "",
  blue: isColorSupported ? "\x1b[34m" : "",
  magenta: isColorSupported ? "\x1b[35m" : "",
  bgRed: isColorSupported ? "\x1b[41m" : "",
  bgGreen: isColorSupported ? "\x1b[42m" : "",
};

const SERVER_URL =
  process.env.FLOWDEV_SERVER_URL ||
  `http://${process.env.FLOWDEV_HOST || "127.0.0.1"}:${process.env.FLOWDEV_PORT || 8000}`;
const API_PATH = "/api/cli/scan";

// Set UTF-8 encoding for standard outputs if available
if (process.stdout && process.stdout.setEncoding) {
  try {
    process.stdout.setEncoding("utf-8");
  } catch (e) {}
}

function printBanner() {
  if (isColorSupported) {
    console.log("\n" + c.cyan + c.bold + "================================================================" + c.reset);
    console.log(c.cyan + c.bold + " [FlowDev-AI] Pre-Commit Guard 代码安全门禁" + c.reset);
    console.log(c.dim + " 基于 ReviewAgent 与 TestAgent 沙箱闭环的代码安全门禁" + c.reset);
    console.log(c.cyan + c.bold + "================================================================" + c.reset);
  }
}

function getStagedCodeFiles() {
  try {
    const output = execSync("git diff --cached --name-only --diff-filter=ACM", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    });

    const lines = output
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean);

    // Filter relevant code files
    const codeExts = /\.(js|jsx|ts|tsx|py|go|java)$/i;
    return lines.filter((file) => codeExts.test(file));
  } catch (e) {
    return [];
  }
}

function getStagedContent(filepath) {
  try {
    return execSync(`git show :${filepath}`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    });
  } catch (err) {
    // Fallback to reading file from disk
    const fs = require("fs");
    return fs.readFileSync(filepath, "utf-8");
  }
}

async function postJson(serverUrl, endpoint, data) {
  const fullUrl = serverUrl.replace(/\/+$/, "") + endpoint;

  // Use native global fetch if available (Node 18+)
  if (typeof fetch === "function") {
    const res = await fetch(fullUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`后端门禁服务异常 [HTTP ${res.status}]: ${errBody}`);
    }
    return await res.json();
  }

  // Fallback to Node.js built-in http / https modules
  const isHttps = fullUrl.startsWith("https:");
  const client = isHttps ? require("https") : require("http");
  const parsed = new URL(fullUrl);

  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const req = client.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + (parsed.search || ""),
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Length": Buffer.byteLength(payload, "utf-8"),
        },
        timeout: 30000,
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(body));
            } catch (e) {
              reject(new Error("无法解析后端门禁返回的 JSON 响应"));
            }
          } else {
            reject(
              new Error(
                `后端服务响应错误 [HTTP ${res.statusCode}]: ${body || res.statusMessage}`
              )
            );
          }
        });
      }
    );

    req.on("error", (err) => {
      reject(err);
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("请求后端门禁服务超时 (30s)"));
    });

    req.write(payload, "utf-8");
    req.end();
  });
}

function fetchText(urlStr) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const transport = parsed.protocol === "https:" ? https : http;
    const req = transport.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: "GET",
        timeout: 10000,
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(body);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body || res.statusMessage}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("请求超时 (10s)"));
    });
    req.end();
  });
}

async function syncSkills() {
  const { projectId } = getGitMetadata();
  const targetProject = process.env.FLOWDEV_PROJECT_ID || projectId || "rxjs";
  const gitRoot = execSync("git rev-parse --show-toplevel", { encoding: "utf-8" }).trim();

  console.log(`\n${c.cyan}${c.bold}================================================================${c.reset}`);
  console.log(`${c.cyan}${c.bold} [FlowDev-AI] 正在同步仓库 '${targetProject}' 的 Agent Skills...${c.reset}`);
  console.log(`${c.dim} 门禁中台: ${SERVER_URL}${c.reset}`);
  console.log(`${c.cyan}${c.bold}================================================================${c.reset}\n`);

  try {
    // 1. Fetch .cursorrules
    const cursorRulesContent = await fetchText(`${SERVER_URL}/api/projects/${encodeURIComponent(targetProject)}/skills/export?format=cursorrules`);
    const cursorPath = path.join(gitRoot, ".cursorrules");
    fs.writeFileSync(cursorPath, cursorRulesContent, "utf8");
    console.log(`  ${c.green}✓ 已更新 Cursor 规范文件:${c.reset} ${cursorPath}`);

    // 2. Fetch CLAUDE.md
    const claudeContent = await fetchText(`${SERVER_URL}/api/projects/${encodeURIComponent(targetProject)}/skills/export?format=claude_md`);
    const claudePath = path.join(gitRoot, "CLAUDE.md");
    fs.writeFileSync(claudePath, claudeContent, "utf8");
    console.log(`  ${c.green}✓ 已更新 Claude Code 指南:${c.reset} ${claudePath}`);

    // 3. Optional: GitHub Copilot instructions if .github exists
    const githubDir = path.join(gitRoot, ".github");
    if (fs.existsSync(githubDir)) {
      const copilotContent = await fetchText(`${SERVER_URL}/api/projects/${encodeURIComponent(targetProject)}/skills/export?format=copilot`);
      const copilotPath = path.join(githubDir, "copilot-instructions.md");
      fs.writeFileSync(copilotPath, copilotContent, "utf8");
      console.log(`  ${c.green}✓ 已更新 Copilot 指令:${c.reset} ${copilotPath}`);
    }

    // 4. Windsurf rules
    const windsurfPath = path.join(gitRoot, ".windsurfrules");
    fs.writeFileSync(windsurfPath, cursorRulesContent, "utf8");
    console.log(`  ${c.green}✓ 已更新 Windsurf 规范:${c.reset} ${windsurfPath}`);

    console.log(`\n${c.green}${c.bold}✨ 技能同步成功！${c.reset}`);
    console.log(`${c.dim}提示: 建议将生成的文件执行 git commit 提交入库，团队其他成员 git pull 后将全员生效。${c.reset}\n`);
    process.exit(0);
  } catch (err) {
    console.error(`\n${c.red}[错误] 同步 Agent Skills 失败: ${err.message}${c.reset}\n`);
    process.exit(1);
  }
}

function getGitMetadata() {
  try {
    const toplevel = execSync("git rev-parse --show-toplevel", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
    const committer =
      execSync("git config user.name", {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "ignore"],
      }).trim() || "developer";
    const committerEmail = execSync("git config user.email", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
    const fullCommitter = committerEmail ? `${committer} <${committerEmail}>` : committer;
    const projectId = path.basename(toplevel) || "unknown";
    return { projectId, branch, committer: fullCommitter };
  } catch (e) {
    return { projectId: "default-project", branch: "main", committer: "developer" };
  }
}

function handleCliCommands() {
  const args = process.argv.slice(2);
  if (args.includes("--disable") || args.includes("disable") || args.includes("--off")) {
    try {
      execSync("git config flowdev.enabled false");
      console.log(`\n${c.green}✔ 已成功关闭当前仓库的 FlowDev 门禁！${c.reset}`);
      console.log(`${c.dim}后续 git commit 将完全跳过门禁检查，秒速直接提交。${c.reset}`);
      console.log(`如需重新开启门禁，请运行: ${c.cyan}node .git/hooks/pre-commit --enable${c.reset}\n`);
      process.exit(0);
    } catch (e) {
      console.error("执行 git config 失败:", e.message);
      process.exit(1);
    }
  }

  if (args.includes("--enable") || args.includes("enable") || args.includes("--on")) {
    try {
      execSync("git config flowdev.enabled true");
      console.log(`\n${c.green}✔ 已成功恢复 FlowDev 代码安全门禁！${c.reset}`);
      console.log(`${c.dim}提交时将进行智能审查与防空指针拦截。${c.reset}\n`);
      process.exit(0);
    } catch (e) {
      console.error("执行 git config 失败:", e.message);
      process.exit(1);
    }
  }

  if (args.includes("--warn") || args.includes("--warn-only") || args.includes("warn")) {
    try {
      execSync("git config flowdev.enabled true");
      execSync("git config flowdev.mode warn");
      console.log(`\n${c.green}✔ 已切换为「仅告警不阻断 (Warn Only)」模式！${c.reset}`);
      console.log(`${c.dim}AI 审查建议照常输出，但 100% 自动放行提交，绝不卡住你的开发进度！${c.reset}`);
      console.log(`如需恢复严格阻断，请运行: ${c.cyan}node .git/hooks/pre-commit --block${c.reset}\n`);
      process.exit(0);
    } catch (e) {
      console.error("执行 git config 失败:", e.message);
      process.exit(1);
    }
  }

  if (args.includes("--block") || args.includes("block")) {
    try {
      execSync("git config flowdev.enabled true");
      execSync("git config flowdev.mode block");
      console.log(`\n${c.green}✔ 已切换为「严格阻断 (Block)」模式！${c.reset}`);
      console.log(`${c.dim}检测到致命缺陷将拦截 Commit，确保仓库代码质量。${c.reset}\n`);
      process.exit(0);
    } catch (e) {
      console.error("执行 git config 失败:", e.message);
      process.exit(1);
    }
  }

  if (args.includes("--status") || args.includes("status")) {
    let enabled = "true";
    let mode = "block";
    try {
      enabled = execSync("git config --get flowdev.enabled", { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }).trim();
    } catch (e) {}
    try {
      mode = execSync("git config --get flowdev.mode", { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }).trim();
    } catch (e) {}

    const isEnabled = enabled !== "false" && enabled !== "0" && enabled !== "off";
    console.log(`\n${c.cyan}=== FlowDev Git Hook 本地配置状态 ===${c.reset}`);
    console.log(`门禁总开关: ${isEnabled ? c.green + "已开启 (ON)" : c.yellow + "已关闭 (OFF) - 秒级直接提交"}${c.reset}`);
    console.log(`本地模式: ${mode === "warn" ? c.yellow + "仅提示不阻断 (Warn Only)" : c.red + "严格阻断 (Block)"}${c.reset}`);
    console.log(`门禁中台: ${SERVER_URL}`);
    console.log(`\n快捷管理指令:`);
    console.log(`  node .git/hooks/pre-commit --warn    (推荐开发期：仅提示，不卡提交)`);
    console.log(`  node .git/hooks/pre-commit --disable (完全关闭门禁)`);
    console.log(`  node .git/hooks/pre-commit --enable  (恢复严格门禁)`);
    console.log(`  git commit -m "..." --no-verify     (原生单次跳过)\n`);
    process.exit(0);
  }
}

async function main() {
  // Support quick environment bypass
  if (process.env.FLOWDEV_DISABLE === "1" || process.env.FLOWDEV_BYPASS === "1" || process.env.SKIP_FLOWDEV === "1") {
    console.log(`${c.yellow}[FlowDev-AI] 检测到环境变量 FLOWDEV_DISABLE，已快速跳过门禁放行提交。${c.reset}`);
    process.exit(0);
  }

  // Support local git config bypass
  let localConfigEnabled = "";
  try {
    localConfigEnabled = execSync("git config --get flowdev.enabled", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim().toLowerCase();
  } catch (e) {}
  if (localConfigEnabled === "false" || localConfigEnabled === "0" || localConfigEnabled === "off" || localConfigEnabled === "no") {
    console.log(`${c.yellow}[FlowDev-AI] 当前仓库已通过 git config 关闭门禁，快速跳过审查放行提交。${c.reset}`);
    process.exit(0);
  }

  // Support local warn-only mode
  let localMode = "";
  try {
    localMode = execSync("git config --get flowdev.mode", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim().toLowerCase();
  } catch (e) {}

  const stagedFiles = getStagedCodeFiles();

  // If no code changes in staged index, quietly allow commit
  if (stagedFiles.length === 0) {
    process.exit(0);
  }

  const { projectId, branch, committer } = getGitMetadata();

  printBanner();
  console.log(
    `\n[扫描] [${c.cyan}${projectId}${c.reset} / ${c.yellow}${branch}${c.reset}] 暂存区包含 ${c.bold}${stagedFiles.length}${c.reset} 个待提交源码文件:`
  );
  stagedFiles.forEach((f) => console.log(`   - ${f}`));

  console.log(
    `\n[审查中] 正在将暂存代码交由 ${c.magenta}ReviewAgent${c.reset} 审查并在 ${c.blue}TestSandbox${c.reset} 中运行验证...`
  );

  const filesPayload = stagedFiles.map((file) => ({
    filename: file,
    content: getStagedContent(file),
  }));

  let scanResult;
  try {
    scanResult = await postJson(SERVER_URL, API_PATH, {
      project_id: projectId,
      committer,
      branch,
      files: filesPayload,
    });
  } catch (err) {
    const isStrict = process.env.FLOWDEV_STRICT === "1";
    if (isStrict) {
      console.error(
        `\n${c.yellow}[FlowDev-AI 警告] 无法连接到门禁服务 (${SERVER_URL})${c.reset}`
      );
      console.error(`   原因: ${err.message}`);
      console.error(
        `   提示: 当前处于严格门禁模式 (FLOWDEV_STRICT=1)，阻断提交。\n`
      );
      process.exit(1);
    } else {
      console.warn(
        `\n${c.yellow}[FlowDev-AI 提示] 无法连接到门禁服务 (${SERVER_URL}): ${err.message}${c.reset}`
      );
      console.warn(
        `   降级策略: 本地无阻断放行提交。如需强制拦截请设置 export FLOWDEV_STRICT=1\n`
      );
      process.exit(0);
    }
  }

  console.log(
    "\n----------------------------------------------------------------"
  );

  if (scanResult.passed) {
    // Passed successfully!
    console.log(
      `[FlowDev 门禁通过] 代码审查合格，单测自愈验证通过，允许提交！`
    );
    if (isColorSupported) {
      console.log(`${c.dim}  ${scanResult.summary}${c.reset}`);
    }

    if (scanResult.suggestions && scanResult.suggestions.length > 0) {
      console.log(`\n${c.cyan}[建议] 优化建议 (非阻断项):${c.reset}`);
      scanResult.suggestions.forEach((sug, i) => {
        console.log(`   ${c.dim}${i + 1}.${c.reset} ${sug}`);
      });
    }

    if (isColorSupported) {
      console.log(
        "\n----------------------------------------------------------------\n"
      );
    }
    process.exit(0);
  } else {
    // Check if local repo is configured for warn-only mode
    let isWarnOnly = false;
    try {
      const mode = execSync("git config --get flowdev.mode", { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }).trim().toLowerCase();
      if (mode === "warn" || mode === "warn_only") isWarnOnly = true;
    } catch (e) {}
    if (process.env.FLOWDEV_WARN === "1" || process.env.FLOWDEV_WARN_ONLY === "1") isWarnOnly = true;

    if (isWarnOnly) {
      console.log(`\n${c.yellow}================================================================${c.reset}`);
      console.log(`${c.yellow}[FlowDev 提示] 检测到潜在缺陷，但当前处于「仅提示不拦截 (Warn Only)」模式，已放行本次提交！${c.reset}`);
      if (scanResult.critical_issues && scanResult.critical_issues.length > 0) {
        console.log(`${c.red}待关注隐患:${c.reset}`);
        scanResult.critical_issues.forEach((iss) => console.log(`  • ${iss}`));
      }
      if (scanResult.suggestions && scanResult.suggestions.length > 0) {
        console.log(`${c.cyan}优化建议:${c.reset}`);
        scanResult.suggestions.forEach((sug) => console.log(`  - ${sug}`));
      }
      console.log(`${c.yellow}================================================================\n${c.reset}`);
      process.exit(0);
    }

    // Intercepted!
    const issues = scanResult.critical_issues || [];
    const issueCount = issues.length;

    // First line is critical for VS Code popup toast: Keep it concise, clear, without escape codes
    console.error(
      `[FlowDev 门禁拦截] 发现 ${issueCount} 项阻断性风险，已阻止 Commit！`
    );

    console.log(`\n原因概述: ${scanResult.summary}\n`);

    console.log(
      `${c.red}${c.bold}【阻断性致命缺陷 (Critical Issues)】:${c.reset}`
    );
    issues.forEach((issue, idx) => {
      console.log(`  [${idx + 1}] ${issue}`);
    });

    if (scanResult.suggestions && scanResult.suggestions.length > 0) {
      console.log(`\n${c.cyan}【修复建议 (Suggestions)】:${c.reset}`);
      scanResult.suggestions.forEach((sug, idx) => {
        console.log(`  - ${sug}`);
      });
    }

    console.log(
      `\n${c.yellow}================================================================${c.reset}`
    );
    console.log(
      `${c.yellow}💡 [极速提交通行证] 如当前急需提交代码，可通过以下任一方式跳过：${c.reset}`
    );
    console.log(`  1. 原生单次跳过: ${c.cyan}git commit -m "..." --no-verify${c.reset} (或 -n)`);
    console.log(`  2. 切换为仅提示模式: ${c.cyan}node .git/hooks/pre-commit --warn${c.reset} (不卡提交)`);
    console.log(`  3. 临时关闭门禁: ${c.cyan}node .git/hooks/pre-commit --disable${c.reset}`);
    console.log(`  4. 或在 FlowDev 控制台首页卡片上一键切换为「仅提示」或「关闭」`);
    console.log(
      `${c.yellow}================================================================${c.reset}\n`
    );
    process.exit(1);
  }
}

// 1. Check CLI management subcommands (--disable, --enable, --warn, --status)
handleCliCommands();

// 2. Main execution / skills sync
if (process.argv.includes("--sync-skills") || process.argv.includes("-s") || process.argv.includes("sync")) {
  syncSkills().catch((err) => {
    console.error("同步 Agent Skills 失败:", err);
    process.exit(1);
  });
} else {
  main().catch((err) => {
    console.error("执行 FlowDev 门禁检查发生未捕获异常:", err);
    process.exit(1);
  });
}
