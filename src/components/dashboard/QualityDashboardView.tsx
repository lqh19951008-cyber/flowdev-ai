"use client";

import React, { useState, useEffect } from "react";
import {
  FolderGit2,
  ShieldCheck,
  ShieldAlert,
  Save,
  CheckCircle2,
  Clock,
  User,
  GitBranch,
  RefreshCw,
  Search,
  Sliders,
  FileCode,
  Layers,
  Sparkles,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Radio,
} from "lucide-react";
import { useFlowStore } from "@/stores/useFlowStore";
import { cn } from "@/lib/utils";

export function QualityDashboardView() {
  const {
    projects,
    selectedProjectId,
    setSelectedProjectId,
    recentEvents,
    fetchProjects,
    fetchRecentEvents,
    setActiveViewMode,
  } = useFlowStore();

  const [filterPassed, setFilterPassed] = useState<string>("all");
  const [searchKeyword, setSearchKeyword] = useState<string>("");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetchProjects();
    fetchRecentEvents(selectedProjectId === "all" ? undefined : selectedProjectId);
  }, [selectedProjectId, fetchProjects, fetchRecentEvents]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      fetchProjects(),
      fetchRecentEvents(selectedProjectId === "all" ? undefined : selectedProjectId),
    ]);
    setIsRefreshing(false);
  };

  // Aggregate statistics
  const totalScans = projects.reduce((acc, p) => acc + p.total_scans, 0);
  const totalPassed = projects.reduce((acc, p) => acc + p.passed_scans, 0);
  const totalBlocked = totalScans - totalPassed;
  const overallPassRate = totalScans > 0 ? ((totalPassed / totalScans) * 100).toFixed(1) : "100.0";

  // Filtered events
  const filteredEvents = recentEvents.filter((ev) => {
    if (selectedProjectId !== "all" && ev.project_id !== selectedProjectId) {
      return false;
    }
    if (filterPassed === "passed" && !ev.passed) return false;
    if (filterPassed === "blocked" && ev.passed) return false;
    if (searchKeyword.trim()) {
      const q = searchKeyword.toLowerCase();
      const matchProject = ev.project_id.toLowerCase().includes(q);
      const matchCommitter = ev.committer.toLowerCase().includes(q);
      const matchSummary = ev.summary.toLowerCase().includes(q);
      const matchIssue = ev.critical_issues.some((i) => i.toLowerCase().includes(q));
      if (!matchProject && !matchCommitter && !matchSummary && !matchIssue) return false;
    }
    return true;
  });

  return (
    <div className="flex-1 w-full h-full overflow-y-auto bg-slate-950 p-4 md:p-6 space-y-6">
      {/* Top Banner for Tech Lead / Admin */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-slate-950 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
            <ShieldCheck className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-slate-100 tracking-tight">
                企业研发效能与代码质量管控中台
              </h1>
              <span className="rounded-full bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-xs font-mono text-blue-400">
                DevOps Control Center
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              全公司代码仓库集中监控 · 拦截空指针与致命崩溃 · Git Pre-Commit 规则动态下发
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Git Hook 探针全域守护中</span>
          </div>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-xs font-medium text-slate-300 hover:text-white transition-colors"
            title="刷新大盘最新数据"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin text-blue-400")} />
            <span>{isRefreshing ? "刷新中..." : "刷新大盘"}</span>
          </button>
        </div>
      </div>

      {/* 4 Core KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 shadow-sm hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>已接入代码仓库</span>
            <FolderGit2 className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100 mt-1.5 font-mono">
            {projects.length}
            <span className="text-xs font-normal text-slate-500 ml-1.5 font-sans">个项目</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <span className="text-cyan-400">已部署探针</span>
            <span>包含 rxjs, flowdev 等</span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 shadow-sm hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>门禁累计代码审查</span>
            <Radio className="h-4 w-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-blue-400 mt-1.5 font-mono">
            {totalScans}
            <span className="text-xs font-normal text-slate-500 ml-1.5 font-sans">次 Commit</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Pre-Commit 钩子实时审计
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 shadow-sm hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>拦截致命崩溃隐患</span>
            <AlertTriangle className="h-4 w-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400 mt-1.5 font-mono">
            {totalBlocked}
            <span className="text-xs font-normal text-slate-500 ml-1.5 font-sans">次拦截</span>
          </div>
          <div className="text-[11px] text-rose-400/90 mt-1 font-medium">
            已在提交入库前精准阻止
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 shadow-sm hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>全团队提交安全通过率</span>
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-1.5 font-mono">
            {overallPassRate}%
          </div>
          <div className="text-[11px] text-emerald-400/90 mt-1">
            零阻断缺陷 & 单测验证合格
          </div>
        </div>
      </div>

      {/* Monitored Repositories & Active Policy Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Layers className="h-4 w-4 text-cyan-400" />
            各仓库健康度与门禁策略配置
          </h2>
          <span className="text-xs text-slate-400">
            点击项目卡片可切换过滤审计流水，或进入流水线定制门禁规则
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((proj) => {
            const isSelected = selectedProjectId === proj.id;
            return (
              <div
                key={proj.id}
                onClick={() => setSelectedProjectId(isSelected ? "all" : proj.id)}
                className={cn(
                  "p-4 rounded-xl border transition-all cursor-pointer relative",
                  isSelected
                    ? "bg-slate-900/90 border-cyan-500/60 shadow-lg shadow-cyan-500/10"
                    : "bg-slate-900/40 border-slate-800 hover:border-slate-700"
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-100 font-mono truncate">
                        {proj.id}
                      </span>
                      {isSelected && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-medium">
                          当前筛选
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-300 mt-0.5 font-medium truncate">
                      {proj.name}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                      {proj.description || "代码仓库已接入门禁探针"}
                    </p>
                  </div>

                  <div className="text-right shrink-0 ml-2">
                    <div className="text-sm font-bold text-slate-100 font-mono">
                      {proj.pass_rate}%
                    </div>
                    <div className="text-[10px] text-slate-500">通过率</div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-3">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-300",
                      proj.pass_rate >= 80
                        ? "bg-emerald-500"
                        : proj.pass_rate >= 50
                        ? "bg-amber-500"
                        : "bg-rose-500"
                    )}
                    style={{ width: `${Math.max(proj.pass_rate, 4)}%` }}
                  />
                </div>

                {/* Card footer */}
                <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                  <div>
                    <span>审查 {proj.total_scans} 次</span>
                    <span className="mx-1.5 text-slate-600">/</span>
                    <span className="text-emerald-400">放行 {proj.passed_scans} 次</span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedProjectId(proj.id);
                      setActiveViewMode("pipeline");
                    }}
                    className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
                    title="为该仓库编排门禁规则流水线"
                  >
                    <Sliders className="h-3 w-3" />
                    <span>编排策略</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* All-Team Commit Audit Log Table */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-400" />
              全员提交拦截与审计流水
              <span className="text-xs font-normal text-slate-400">
                ({selectedProjectId === "all" ? "全部仓库" : `仓库: ${selectedProjectId}`})
              </span>
            </h2>
          </div>

          {/* Filter controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="搜索提交人、缺陷、仓库..."
                className="pl-8 pr-3 py-1 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-blue-500 w-48"
              />
            </div>

            <div className="flex items-center rounded-lg border border-slate-800 bg-slate-900 p-0.5 text-xs">
              <button
                onClick={() => setFilterPassed("all")}
                className={cn(
                  "px-2.5 py-0.5 rounded text-xs transition-colors",
                  filterPassed === "all"
                    ? "bg-slate-800 text-slate-100 font-medium"
                    : "text-slate-400 hover:text-slate-200"
                )}
              >
                全部
              </button>
              <button
                onClick={() => setFilterPassed("blocked")}
                className={cn(
                  "px-2.5 py-0.5 rounded text-xs transition-colors",
                  filterPassed === "blocked"
                    ? "bg-rose-500/20 text-rose-300 font-medium"
                    : "text-slate-400 hover:text-slate-200"
                )}
              >
                已拦截
              </button>
              <button
                onClick={() => setFilterPassed("passed")}
                className={cn(
                  "px-2.5 py-0.5 rounded text-xs transition-colors",
                  filterPassed === "passed"
                    ? "bg-emerald-500/20 text-emerald-300 font-medium"
                    : "text-slate-400 hover:text-slate-200"
                )}
              >
                已放行
              </button>
            </div>
          </div>
        </div>

        {/* Audit Table */}
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40 shadow-xl">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/80 border-b border-slate-800 text-[11px] text-slate-400 font-medium">
              <tr>
                <th className="py-2.5 px-3">判定状态</th>
                <th className="py-2.5 px-3">仓库</th>
                <th className="py-2.5 px-3">提交者 / 分支</th>
                <th className="py-2.5 px-3">文件数</th>
                <th className="py-2.5 px-4">门禁审查结论与缺陷</th>
                <th className="py-2.5 px-3">时间</th>
                <th className="py-2.5 px-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-500">
                    暂无符合条件的门禁提交记录。在任意接入项目中执行 git commit 将在此全量留痕。
                  </td>
                </tr>
              ) : (
                filteredEvents.map((ev) => {
                  const isExpanded = selectedEventId === ev.id;
                  return (
                    <React.Fragment key={ev.id}>
                      <tr
                        className={cn(
                          "hover:bg-slate-800/40 transition-colors cursor-pointer",
                          !ev.passed && "bg-rose-950/10"
                        )}
                        onClick={() => setSelectedEventId(isExpanded ? null : ev.id)}
                      >
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 w-fit",
                              ev.passed
                                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                            )}
                          >
                            {ev.passed ? (
                              <>
                                <ShieldCheck className="h-3 w-3" />
                                放行
                              </>
                            ) : (
                              <>
                                <ShieldAlert className="h-3 w-3" />
                                拦截
                              </>
                            )}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 font-mono font-medium text-cyan-300">
                          {ev.project_id}
                        </td>

                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1 text-slate-200">
                            <User className="h-3 w-3 text-slate-500 shrink-0" />
                            <span className="truncate max-w-[140px]">{ev.committer}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono mt-0.5">
                            <GitBranch className="h-2.5 w-2.5 text-slate-500 shrink-0" />
                            <span>{ev.branch}</span>
                          </div>
                        </td>

                        <td className="py-2.5 px-3 text-slate-400 font-mono">
                          <span className="flex items-center gap-1">
                            <FileCode className="h-3 w-3 text-slate-500" />
                            {ev.files_count}
                          </span>
                        </td>

                        <td className="py-2.5 px-4 max-w-md">
                          <div className="line-clamp-1 font-medium text-slate-200">
                            {ev.summary}
                          </div>
                          {ev.critical_issues.length > 0 && (
                            <div className="line-clamp-1 text-[11px] text-rose-400 font-mono mt-0.5">
                              {ev.critical_issues[0]}
                              {ev.critical_issues.length > 1 && ` (+${ev.critical_issues.length - 1}项)`}
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap text-[11px] text-slate-400">
                          {new Date(ev.created_at).toLocaleString()}
                        </td>

                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEventId(isExpanded ? null : ev.id);
                            }}
                            className="text-blue-400 hover:text-blue-300 text-xs font-medium"
                          >
                            {isExpanded ? "收起" : "展开详情"}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Detail Row */}
                      {isExpanded && (
                        <tr className="bg-slate-900/80">
                          <td colSpan={7} className="p-4 border-t border-slate-800">
                            <div className="space-y-3">
                              <div>
                                <div className="text-xs font-semibold text-slate-300 mb-1">
                                  门禁审查结论概览:
                                </div>
                                <p className="text-xs text-slate-400">{ev.summary}</p>
                              </div>

                              {ev.critical_issues.length > 0 && (
                                <div className="p-3 rounded-lg bg-rose-950/20 border border-rose-900/40">
                                  <div className="text-xs font-semibold text-rose-300 mb-1.5 flex items-center gap-1.5">
                                    <ShieldAlert className="h-4 w-4" />
                                    阻断性致命缺陷 (Critical Issues):
                                  </div>
                                  <ul className="space-y-1">
                                    {ev.critical_issues.map((iss, i) => (
                                      <li key={i} className="text-xs text-rose-200 font-mono">
                                        • {iss}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {ev.suggestions.length > 0 && (
                                <div className="p-3 rounded-lg bg-cyan-950/20 border border-cyan-900/40">
                                  <div className="text-xs font-semibold text-cyan-300 mb-1.5 flex items-center gap-1.5">
                                    <Sparkles className="h-4 w-4" />
                                    优化与重构建议 (Suggestions):
                                  </div>
                                  <ul className="space-y-1">
                                    {ev.suggestions.map((sug, i) => (
                                      <li key={i} className="text-xs text-cyan-200 font-mono">
                                        • {sug}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
