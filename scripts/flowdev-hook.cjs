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

async function main() {
  // Support quick environment bypass: FLOWDEV_DISABLE=1 git commit
  if (process.env.FLOWDEV_DISABLE === "1") {
    process.exit(0);
  }

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
      `\n${c.yellow}[操作提示] 请根据上述建议修复代码，重新执行 git add 后再尝试提交。${c.reset}\n`
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("执行 FlowDev 门禁检查发生未捕获异常:", err);
  process.exit(1);
});
