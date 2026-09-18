"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Terminal,
  Copy,
  Check,
  FolderGit2,
  Cpu,
  GitPullRequest,
  CheckCircle2,
  ShieldCheck,
  Radio,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useFlowStore } from "@/stores/useFlowStore";

interface IntegrationGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function IntegrationGuideModal({
  isOpen,
  onClose,
}: IntegrationGuideModalProps) {
  const selectedProjectId = useFlowStore((s) => s?.selectedProjectId);
  const projects = useFlowStore((s) => s?.projects);
  const [mounted, setMounted] = useState(false);
  const [serverUrl, setServerUrl] = useState("http://127.0.0.1:8000");
  const [activeTab, setActiveTab] = useState<"git_hook" | "husky" | "ci_cd">(
    "git_hook"
  );
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const currentHost = window?.location?.hostname ?? "";
      const protocol = window?.location?.protocol ?? "http:";
      if (currentHost === "localhost" || currentHost === "127.0.0.1") {
        setServerUrl("http://127.0.0.1:8000");
      } else {
        const host = window?.location?.host ?? "127.0.0.1:8000";
        setServerUrl(`${protocol}//${host}`);
      }
    }
  }, [isOpen]);

  if (!isOpen || !mounted) return null;
  if (typeof document === "undefined" || !document?.body) return null;

  const currentProjectName =
    selectedProjectId === "all"
      ? (projects?.[0]?.id ?? "my-repo")
      : (selectedProjectId ?? "my-repo");

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const gitHookScriptCmd = `# 1. 一键将探针接入当前 Git 仓库
curl -s "${serverUrl}/scripts/flowdev-hook.js" -o .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit

# 2. ⚡ 门禁控制开关 (随需切换，绝不阻断开发速度)：
node .git/hooks/pre-commit --warn    # 切换为「仅提示不拦截」模式（推荐！AI照常给建议，但100%放行）
node .git/hooks/pre-commit --disable # 临时彻底关闭门禁（秒级直接提交）
node .git/hooks/pre-commit --enable  # 恢复严格卡点
git commit -m "..." --no-verify     # Git 原生单次跳过通行证`;

  const huskyScriptCmd = `# 1. 安装与初始化 Husky (全团队成员克隆后自动生效)
npm install --save-dev husky
npx husky init

# 2. 写入门禁调用脚本到 .husky/pre-commit
cat << 'EOF' > .husky/pre-commit
#!/bin/sh
export FLOWDEV_SERVER_URL="${serverUrl}"
node scripts/flowdev-hook.js
EOF

# 3. 赋予执行权限 (macOS / Linux)
chmod +x .husky/pre-commit`;

  const gitlabCiScriptCmd = `# .gitlab-ci.yml 企业集中式门禁流水线 (杜绝本地 --no-verify 绕过)
flowdev_gate_check:
  stage: test
  image: node:18-alpine
  script:
    - export FLOWDEV_SERVER_URL="${serverUrl}"
    - node scripts/flowdev-hook.js
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'
    - if: '$CI_COMMIT_BRANCH == "main" || $CI_COMMIT_BRANCH == "master"'`;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-2xl text-slate-800 dark:text-slate-200 select-none overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4 shrink-0 bg-slate-50/70 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20 shrink-0">
              <Terminal className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>代码仓库接入与门禁探针部署指引</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 font-mono font-medium">
                  Connect Guide
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                将外部 Git 仓库接入 FlowDev-AI，提交代码时享受秒级智能审查与质量大盘联动
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Server URL Input Banner */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Radio className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
                当前 FlowDev 服务端部署地址 (Server URL):
              </span>
              <span className="text-[11px] text-slate-400">
                当前绑定仓库: <code className="font-mono text-cyan-600 dark:text-cyan-400">{currentProjectName}</code>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                placeholder="https://flowdev.yourcompany.com"
              />
              <button
                onClick={() => handleCopy(serverUrl, "url")}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                {copiedKey === "url" ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                    <span>已复制</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>复制地址</span>
                  </>
                )}
              </button>
            </div>
          </div>

        {/* Integration Mode Tabs */}
        <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab("git_hook")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer",
              activeTab === "git_hook"
                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 font-semibold"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            )}
          >
            <FolderGit2 className="h-3.5 w-3.5" />
            <span>1. 本地 Pre-Commit 探针 (推荐·最快)</span>
          </button>
          <button
            onClick={() => setActiveTab("husky")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer",
              activeTab === "husky"
                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 font-semibold"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            )}
          >
            <Cpu className="h-3.5 w-3.5" />
            <span>2. 前端 Husky 工程化接入</span>
          </button>
          <button
            onClick={() => setActiveTab("ci_cd")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer",
              activeTab === "ci_cd"
                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 font-semibold"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            )}
          >
            <GitPullRequest className="h-3.5 w-3.5" />
            <span>3. CI/CD 服务端流水线门禁</span>
          </button>
        </div>

        {/* Tab 1: Git Hook */}
        {activeTab === "git_hook" && (
          <div className="space-y-3 animate-in fade-in duration-100">
            <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              适合个人或团队快速接入任何 Git 仓库。探针将自动写入当前项目的{" "}
              <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-900 font-mono text-slate-800 dark:text-slate-200">
                .git/hooks/pre-commit
              </code>
              。每次执行 <code className="font-mono text-cyan-600">git commit</code> 时毫秒级拦截致命隐患并上报大盘：
            </div>

            <div className="relative rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950 p-3.5 font-mono text-xs text-slate-200 shadow-inner">
              <pre className="overflow-x-auto whitespace-pre-wrap leading-5">{gitHookScriptCmd}</pre>
              <button
                onClick={() => handleCopy(gitHookScriptCmd, "git_hook")}
                className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 transition-colors cursor-pointer"
              >
                {copiedKey === "git_hook" ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-400" />
                    <span>已复制</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span>复制代码</span>
                  </>
                )}
              </button>
            </div>

            <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 text-xs text-blue-700 dark:text-blue-300 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />
                <span>实时拦截工作流程：</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-600 dark:text-slate-400 pl-1">
                <li>提交代码时自动提取暂存区 (<code>git diff --cached</code>) 发送至线上 FlowDev 服务端；</li>
                <li>服务端根据本仓库在大盘配置的门禁策略（空指针/安全漏洞/单测沙箱）秒级校验；</li>
                <li>若发现阻断级缺陷，终端直接退出 (Exit Code 1) 并高亮展示出错行数与修复建议；</li>
                <li>大盘实时生成审计流水，并向飞书研发群即时派发告警卡片。</li>
              </ul>
            </div>
          </div>
        )}

        {/* Tab 2: Husky */}
        {activeTab === "husky" && (
          <div className="space-y-3 animate-in fade-in duration-100">
            <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              适合前端与全栈工程团队。将门禁配置写入 Git 仓库受控文件，其他开发者克隆代码并运行 <code className="font-mono">npm install</code> 后全自动强制生效：
            </div>

            <div className="relative rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950 p-3.5 font-mono text-xs text-slate-200 shadow-inner">
              <pre className="overflow-x-auto whitespace-pre-wrap leading-5">{huskyScriptCmd}</pre>
              <button
                onClick={() => handleCopy(huskyScriptCmd, "husky")}
                className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 transition-colors cursor-pointer"
              >
                {copiedKey === "husky" ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-400" />
                    <span>已复制</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span>复制代码</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: CI/CD */}
        {activeTab === "ci_cd" && (
          <div className="space-y-3 animate-in fade-in duration-100">
            <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              防止部分开发者使用 <code className="font-mono text-rose-500">git commit --no-verify</code> 绕过本地门禁。在 GitLab / GitHub 合并请求（MR/PR）阶段进行服务端强制卡点：
            </div>

            <div className="relative rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950 p-3.5 font-mono text-xs text-slate-200 shadow-inner">
              <pre className="overflow-x-auto whitespace-pre-wrap leading-5">{gitlabCiScriptCmd}</pre>
              <button
                onClick={() => handleCopy(gitlabCiScriptCmd, "gitlab")}
                className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 transition-colors cursor-pointer"
              >
                {copiedKey === "gitlab" ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-400" />
                    <span>已复制</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span>复制代码</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 shrink-0 bg-slate-50/70 dark:bg-slate-900/50">
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
            <ShieldCheck className="h-4 w-4" />
            <span>接入后代码审查由 FlowDev-AI 自动化闭环守护</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium transition-colors cursor-pointer"
          >
            完成
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
