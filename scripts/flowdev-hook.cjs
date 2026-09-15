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
const path = require("path");

// ANSI color helpers
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
};

const API_HOST = process.env.FLOWDEV_HOST || "127.0.0.1";
const API_PORT = process.env.FLOWDEV_PORT || 8000;
const API_PATH = "/api/cli/scan";

function printBanner() {
  console.log("\n" + c.cyan + c.bold + "╔══════════════════════════════════════════════════════════════╗" + c.reset);
  console.log(c.cyan + c.bold + "║" + c.reset + "         🛡️  " + c.bold + "FlowDev-AI Pre-Commit Guard" + c.reset + "                      " + c.cyan + c.bold + "║" + c.reset);
  console.log(c.cyan + c.bold + "║" + c.reset + c.dim + "    基于 ReviewAgent 与 TestAgent 沙箱闭环的代码安全门禁    " + c.reset + c.cyan + c.bold + "║" + c.reset);
  console.log(c.cyan + c.bold + "╚══════════════════════════════════════════════════════════════╝" + c.reset);
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
    const codeExts = /\.(js|jsx|ts|tsx|py)$/i;
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

function postJson(host, port, endpoint, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);

    const req = http.request(
      {
        host,
        port,
        path: endpoint,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
        timeout: 25000,
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
      reject(new Error("请求后端门禁服务超时 (25s)"));
    });

    req.write(payload);
    req.end();
  });
}

function getUnstagedCodeFiles() {
  try {
    const output = execSync("git diff --name-only", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    });
    const codeExts = /\.(js|jsx|ts|tsx|py)$/i;
    return output.split("\n").map((f) => f.trim()).filter((f) => codeExts.test(f));
  } catch (e) {
    return [];
  }
}

function getGitMetadata() {
  let project_id = "default-project";
  let branch = "main";
  let committer = "developer";

  try {
    const topLevel = execSync("git rev-parse --show-toplevel", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
    if (topLevel) {
      project_id = path.basename(topLevel);
    }
  } catch (e) {}

  try {
    const b = execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
    if (b) branch = b;
  } catch (e) {}

  try {
    const email = execSync("git config user.email", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
    const name = execSync("git config user.name", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
    if (email) {
      committer = name ? `${name} <${email}>` : email;
    } else if (name) {
      committer = name;
    }
  } catch (e) {}

  return { project_id, branch, committer };
}

async function main() {
  printBanner();
  const stagedFiles = getStagedCodeFiles();
  const unstagedFiles = getUnstagedCodeFiles();
  const { project_id, branch, committer } = getGitMetadata();

  // If no code changes in staged index, inform user and exit 0
  if (stagedFiles.length === 0) {
    if (unstagedFiles.length > 0) {
      console.log(
        `\n${c.yellow}⚠️  [FlowDev-AI 提示] 检测到工作区有 ${unstagedFiles.length} 个未暂存的代码文件修改:`
      );
      unstagedFiles.forEach((f) => console.log(`   • ${f}`));
      console.log(
        `   💡 Git 门禁仅对已执行 ${c.bold}git add${c.reset}${c.yellow} 的暂存区代码进行审查。如需审查请先运行: ${c.bold}git add <文件>${c.reset}\n`
      );
    } else {
      console.log(
        `\n${c.dim}ℹ️  [FlowDev-AI] 暂存区无任何 JS/TS/PY 源码文件变更，自动放行提交。${c.reset}\n`
      );
    }
    process.exit(0);
  }

  console.log(
    `\n🔍 检测到暂存区包含 ${c.bold}${stagedFiles.length}${c.reset} 个待提交源码文件 (项目: ${c.cyan}${project_id}${c.reset}, 分支: ${c.magenta}${branch}${c.reset}, 提交人: ${committer}):`
  );
  stagedFiles.forEach((f) => console.log(`   ${c.dim}•${c.reset} ${f}`));

  console.log(
    `\n⏳ 正在将暂存代码发送至 FlowDev-AI 门禁服务 (http://${API_HOST}:${API_PORT}/api/cli/scan)...`
  );
  console.log(
    `   🤖 ${c.magenta}ReviewAgent${c.reset} 深度语义与安全审查中...`
  );
  console.log(
    `   🧪 ${c.blue}TestAgent${c.reset} 自动化单测与沙箱运行中...`
  );

  const filesPayload = stagedFiles.map((file) => ({
    filename: file,
    content: getStagedContent(file),
  }));

  let scanResult;
  try {
    scanResult = await postJson(API_HOST, API_PORT, API_PATH, {
      project_id,
      branch,
      committer,
      files: filesPayload,
    });
  } catch (err) {
    console.error(
      `\n${c.yellow}⚠️  [FlowDev-AI 警告] 无法连接到门禁服务 (http://${API_HOST}:${API_PORT})${c.reset}`
    );
    console.error(`   原因: ${err.message}`);
    console.error(
      `   提示: 请确认已启动后端服务 (cd backend && python -m uvicorn main:app --port 8000)`
    );
    console.error(
      `   为保证提交安全，本次暂存代码未能完成 AI 审查。您可以使用 --no-verify 跳过，或启动后端重试。\n`
    );
    // Block commit by default when server is unreachable, protecting the repository
    process.exit(1);
  }

  console.log(
    "\n────────────────────────────────────────────────────────────────"
  );

  if (scanResult.passed) {
    // Passed successfully!
    console.log(
      `\n${c.green}${c.bold}✔ 代码审查通过，单测自愈验证合格，允许提交！${c.reset}`
    );
    console.log(`${c.dim}  ${scanResult.summary}${c.reset}`);

    if (scanResult.suggestions && scanResult.suggestions.length > 0) {
      console.log(`\n${c.cyan}💡 【优化建议】(非阻断项):${c.reset}`);
      scanResult.suggestions.forEach((sug, i) => {
        console.log(`   ${c.dim}${i + 1}.${c.reset} ${sug}`);
      });
    }

    console.log(
      "\n────────────────────────────────────────────────────────────────\n"
    );
    process.exit(0);
  } else {
    // Intercepted!
    console.log(
      `\n${c.red}${c.bold}✖ 发现严重问题，已拦截 Commit！${c.reset}`
    );
    console.log(`${c.yellow}${scanResult.summary}${c.reset}\n`);

    console.log(
      `${c.red}${c.bold}🚨 【阻断性致命缺陷 (Critical Issues)】:${c.reset}`
    );
    (scanResult.critical_issues || []).forEach((issue, idx) => {
      console.log(`   ${c.red}${c.bold}[${idx + 1}]${c.reset} ${issue}`);
    });

    if (scanResult.suggestions && scanResult.suggestions.length > 0) {
      console.log(`\n${c.cyan}💡 【修复建议 (Suggestions)】:${c.reset}`);
      scanResult.suggestions.forEach((sug, idx) => {
        console.log(`   ${c.dim}•${c.reset} ${sug}`);
      });
    }

    console.log(
      `\n${c.yellow}👉 请修复上述问题，重新执行 ${c.bold}git add <file>${c.reset}${c.yellow} 后再进行提交。${c.reset}`
    );
    console.log(
      "────────────────────────────────────────────────────────────────\n"
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("执行 FlowDev 门禁检查发生未捕获异常:", err);
  process.exit(1);
});
