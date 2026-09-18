"use client";

import React, { useState, useEffect } from "react";
import {
  FolderGit2,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  Terminal,
  Copy,
  Check,
  RefreshCw,
  Sparkles,
  Sliders,
  Activity,
} from "lucide-react";
import { useFlowStore } from "@/stores/useFlowStore";
import { cn } from "@/lib/utils";
import Link from "next/link";

export function ProjectsGovernanceView() {
  const {
    projects,
    fetchProjects,
    updateProjectGateMode,
    setSelectedProjectId,
  } = useFlowStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"projects" | "hook_guide" | "skills_sync">("projects");

  useEffect(() => {
    fetchProjects?.();
  }, [fetchProjects]);

  const handleCopy = (text: string, id: string) => {
    try {
      if (typeof navigator !== "undefined" && navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(text).catch(() => {});
      }
    } catch (e) {}
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchProjects?.();
    setIsRefreshing(false);
  };

  const filteredProjects = (projects ?? []).filter((p) => {
    if (!p?.id) return false;
    const nameMatch = (p?.name ?? p?.id ?? "").toLowerCase().includes(searchQuery.toLowerCase());
    const descMatch = (p?.description ?? "").toLowerCase().includes(searchQuery.toLowerCase());
    return nameMatch || descMatch;
  });

  return (
    <div className="h-full w-full overflow-y-auto bg-slate-50/50 dark:bg-slate-950/40 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Title & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <FolderGit2 className="h-4 w-4" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                项目治理与门禁卡点中心
              </h1>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              集中管理所有研发仓库的卡点模式（阻断/仅告警/关闭）、Git Pre-Commit Hook 部署与 AI Agent Skills 增量同步
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
              <span>刷新项目</span>
            </button>
          </div>
        </div>

        {/* Sub Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab("projects")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              activeTab === "projects"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900"
            )}
          >
            接入项目列表 ({projects.length})
          </button>
          <button
            onClick={() => setActiveTab("hook_guide")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              activeTab === "hook_guide"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900"
            )}
          >
            Git Hook 一键接入指南
          </button>
          <button
            onClick={() => setActiveTab("skills_sync")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              activeTab === "skills_sync"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900"
            )}
          >
            Agent Skills 增量同步规范
          </button>
        </div>

        {/* Tab 1: Projects List */}
        {activeTab === "projects" && (
          <div className="space-y-4">
            {/* Search filter */}
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="搜索项目标识或名称..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full max-w-sm px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Project Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProjects.map((project) => {
                const isCurrent = project.id === "flowdev-ai";
                const isBlocked = project.failure_action === "block_commit" || project.failure_action === "block" || !project.failure_action;
                const isWarn = project.failure_action === "warn_only" || project.failure_action === "warn";
                const isDisabled = project.failure_action === "disabled" || project.gate_enabled === false;

                const blockedCount = Math.max(0, (project.total_scans || 0) - (project.passed_scans || 0));

                return (
                  <div
                    key={project.id}
                    className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/60 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-4"
                  >
                    <div>
                      {/* Top Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="h-9 w-9 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200">
                            <FolderGit2 className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 font-mono">
                                {project.name || project.id}
                              </h3>
                              {isCurrent && (
                                <span className="px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20 text-[10px] font-semibold">
                                  当前项目
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                              ID: {project.id}
                            </span>
                          </div>
                        </div>

                        {/* Status Icon */}
                        {isDisabled ? (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-500 border border-slate-500/20 text-[10px] font-medium">
                            <ShieldOff className="h-3 w-3" />
                            已关闭
                          </span>
                        ) : isWarn ? (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] font-medium">
                            <ShieldCheck className="h-3 w-3" />
                            仅告警
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[10px] font-medium">
                            <ShieldAlert className="h-3 w-3" />
                            严格阻断
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      <p className="mt-3 text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {project.description || "全流程多智能体代码门禁审查受控仓库"}
                      </p>

                      {/* Stats chips */}
                      <div className="mt-4 grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                        <div className="bg-slate-50 dark:bg-slate-950/50 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                          <span className="text-[10px] text-slate-400 block">门禁审查次数</span>
                          <span className="text-sm font-bold text-slate-800 dark:text-slate-200 font-mono">
                            {project.total_scans || 0}
                          </span>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-950/50 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                          <span className="text-[10px] text-slate-400 block">拦截风险数</span>
                          <span className="text-sm font-bold text-rose-600 dark:text-rose-400 font-mono">
                            {blockedCount}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 text-[11px]">快捷调控门禁模式:</span>
                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800">
                          <button
                            onClick={() => updateProjectGateMode(project.id, "block_commit")}
                            className={cn(
                              "px-2 py-0.5 rounded text-[11px] font-medium transition-colors",
                              !isDisabled && !isWarn
                                ? "bg-rose-600 text-white shadow-xs"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                            )}
                          >
                            阻断
                          </button>
                          <button
                            onClick={() => updateProjectGateMode(project.id, "warn_only")}
                            className={cn(
                              "px-2 py-0.5 rounded text-[11px] font-medium transition-colors",
                              isWarn
                                ? "bg-amber-600 text-white shadow-xs"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                            )}
                          >
                            提示
                          </button>
                          <button
                            onClick={() => updateProjectGateMode(project.id, "disabled")}
                            className={cn(
                              "px-2 py-0.5 rounded text-[11px] font-medium transition-colors",
                              isDisabled
                                ? "bg-slate-600 text-white shadow-xs"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                            )}
                          >
                            关闭
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <Link
                          href={`/pipeline?project=${project.id}`}
                          onClick={() => setSelectedProjectId(project.id)}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 text-xs font-semibold transition-colors border border-blue-500/20"
                        >
                          <Sliders className="h-3.5 w-3.5" />
                          <span>编排策略</span>
                        </Link>
                        <Link
                          href={`/dashboard?project=${project.id}`}
                          onClick={() => setSelectedProjectId(project.id)}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors border border-slate-200 dark:border-slate-700"
                        >
                          <Activity className="h-3.5 w-3.5" />
                          <span>大盘流水</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Hook Guide */}
        {activeTab === "hook_guide" && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Terminal className="h-4 w-4 text-blue-500" />
                Git Pre-Commit Hook 一键接入方案
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                支持快速将 FlowDev-AI 门禁注入到任何本地或团队代码仓库中，拦截不合格代码。
              </p>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    方案 1: 将门禁一键部署到指定外部仓库
                  </span>
                  <button
                    onClick={() => handleCopy("node scripts/install-to.js /path/to/your-target-repo", "install-to")}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-slate-200 dark:bg-slate-800 text-[11px] text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700"
                  >
                    {copiedCmd === "install-to" ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    <span>复制命令</span>
                  </button>
                </div>
                <pre className="p-3 rounded-lg bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto">
                  node scripts/install-to.js &lt;目标仓库绝对路径&gt;
                </pre>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    方案 2: 本地当前仓库初始化 Hook
                  </span>
                  <button
                    onClick={() => handleCopy("pnpm hook:install", "pnpm-hook")}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-slate-200 dark:bg-slate-800 text-[11px] text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700"
                  >
                    {copiedCmd === "pnpm-hook" ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    <span>复制命令</span>
                  </button>
                </div>
                <pre className="p-3 rounded-lg bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto">
                  pnpm hook:install
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Skills Sync */}
        {activeTab === "skills_sync" && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-500" />
                Agent Skills 与防错规范增量同步
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                无损增量同步模式，精准刷新 FlowDev 标记块，100% 完整保留开发者原本手写的个性化指令。
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  一键增量同步命令
                </span>
                <button
                  onClick={() => handleCopy("node scripts/flowdev-hook.js --sync-skills", "sync-cmd")}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-slate-200 dark:bg-slate-800 text-[11px] text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700"
                >
                  {copiedCmd === "sync-cmd" ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  <span>复制命令</span>
                </button>
              </div>
              <pre className="p-3 rounded-lg bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto">
                node scripts/flowdev-hook.js --sync-skills
              </pre>
              <div className="text-[11px] text-slate-500 space-y-1">
                <div>• 自动同步 Antigravity 技能库：<code className="text-blue-500">.agent/skills/flowdev-quality/SKILL.md</code></div>
                <div>• 自动增量合并 AI 规范：<code className="text-blue-500">GEMINI.md</code>、<code className="text-blue-500">AGENTS.md</code>、<code className="text-blue-500">.cursorrules</code>、<code className="text-blue-500">CLAUDE.md</code></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
