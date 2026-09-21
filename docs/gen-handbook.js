#!/usr/bin/env node
/**
 * gen-handbook.js — 自动从源文件注释生成使用手册
 *
 * 单一事实源: 每个功能的说明在对应源文件的 // == HANDBOOK == 块里,
 *            本脚本读取所有块, 拼接生成 docs/HANDBOOK.md.
 *
 * 运行: node docs/gen-handbook.js
 *
 * 文档块格式:
 *   // == HANDBOOK: <section-id> ==
 *   // ... markdown content ...
 *   // == /HANDBOOK ==
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(__dirname, "HANDBOOK.md");

// Each handbook block: { id, content }
// Source files to scan: { path, label }
const SOURCES = [
  { path: "scripts/flowdev-hook.js", label: "Hook (前端/本地)" },
  { path: "backend/main.py",          label: "后端 API" },
  { path: "backend/database.py",     label: "数据库 Schema" },
  { path: "src/components/modal/RuleEvolutionModal.tsx", label: "前端 UI" },
];

const blocks = new Map();
const sectionOrder = [];

for (const src of SOURCES) {
  const fp = path.join(ROOT, src.path);
  if (!fs.existsSync(fp)) continue;
  const text = fs.readFileSync(fp, "utf-8");
  const lines = text.split(/\r?\n/);
  let inBlock = false;
  let currentId = null;
  let buf = [];
  for (const line of lines) {
    // Match: // == HANDBOOK: <id> ==  OR  # == HANDBOOK: <id> ==
    // Match: // == /HANDBOOK ==     OR  # == /HANDBOOK ==
    // Both JavaScript-style and Python-style comment markers are accepted so
    // handbook blocks live next to the code they describe in either language.
    const startMatch = line.match(/^\s*(?:\/\/|#)\s*==\s*HANDBOOK:\s*(\S+?)\s*==/);
    const endMatch   = line.match(/^\s*(?:\/\/|#)\s*==\s*\/HANDBOOK\s*==/);
    if (!inBlock && startMatch) {
      inBlock = true;
      currentId = startMatch[1];
      buf = [];
      if (!sectionOrder.includes(currentId)) sectionOrder.push(currentId);
      continue;
    }
    if (inBlock && endMatch) {
      inBlock = false;
      blocks.set(currentId, { content: buf.join("\n").trim(), source: src.path });
      currentId = null;
      buf = [];
      continue;
    }
    if (inBlock) {
      // Strip leading // (any indentation) and Python # comment style
      buf.push(line.replace(/^[\s]*\/\/\s?/, "").replace(/^\s*#\s?/, ""));
    }
  }
}

// Read hook version for footer
let hookVersion = "unknown";
const hookText = fs.readFileSync(path.join(ROOT, "scripts/flowdev-hook.js"), "utf-8");
const v = hookText.match(/const\s+HOOK_VERSION\s*=\s*"([^"]+)"/);
if (v) hookVersion = v[1];

const sha = crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT, "scripts/flowdev-hook.js"))).digest("hex").slice(0, 8);

// Build markdown
const md = [];
md.push("# FlowDev-AI 使用手册");
md.push("");
md.push(`> **核心承诺**: 守门员沉淀规则 → 团队开发者下次 git commit 自动同步 → 无需任何手动操作`);
md.push("");
md.push(`本手册由 \`docs/gen-handbook.js\` 自动从源代码注释生成。最后同步: hook v${hookVersion} (sha:${sha})`);
md.push("");
md.push("## 📖 目录");
md.push("");
for (const id of sectionOrder) {
  md.push(`- [${id}](#${id.toLowerCase().replace(/[^a-z0-9]/g, "-")})`);
}
md.push("");
for (const id of sectionOrder) {
  const b = blocks.get(id);
  if (!b) continue;
  md.push(`## ${id}`);
  md.push("");
  md.push(`<!-- source: ${b.source} -->`);
  md.push("");
  md.push(b.content);
  md.push("");
}

fs.writeFileSync(OUT, md.join("\n"), "utf-8");
console.log(`[gen-handbook] wrote ${OUT}`);
console.log(`[gen-handbook] sections: ${sectionOrder.length}, hook: v${hookVersion}`);