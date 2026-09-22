"use client";

import React, { useState, useEffect } from "react";
import {
  X,
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
  Filter,
  FileCode,
  Layers,
  Sparkles,
} from "lucide-react";
import { useFlowStore } from "@/stores/useFlowStore";
import { cn, formatTime, formatRelativeTime } from "@/lib/utils";

export function ProjectStatsModal() {
  const {
    isProjectStatsModalOpen,
    setProjectStatsModalOpen,
    projects,
    selectedProjectId,
    setSelectedProjectId,
    recentEvents,
    fetchProjects,
    fetchRecentEvents,
    saveCurrentPolicyToProject,
  } = useFlowStore();

  const [savingProjectId, setSavingProjectId] = useState<string | null>(null);
  const [saveSuccessMap, setSaveSuccessMap] = useState<Record<string, boolean>>({});
  const [filterPassed, setFilterPassed] = useState<string>("all");
  const [searchKeyword, setSearchKeyword] = useState<string>("");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  useEffect(() => {
    if (isProjectStatsModalOpen) {
      fetchProjects();
      fetchRecentEvents(selectedProjectId === "all" ? undefined : selectedProjectId);
    }
  }, [isProjectStatsModalOpen, selectedProjectId, fetchProjects, fetchRecentEvents]);

  if (!isProjectStatsModalOpen) return null;

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

  const handleSavePolicy = async (projectId: string) => {
    setSavingProjectId(projectId);
    const ok = await saveCurrentPolicyToProject(projectId);
    setSavingProjectId(null);
    if (ok) {
      setSaveSuccessMap((prev) => ({ ...prev, [projectId]: true }));
      setTimeout(() => {
        setSaveSuccessMap((prev) => ({ ...prev, [projectId]: false }));
      }, 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="relative flex flex-col h-[90vh] w-full max-w-6xl rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <FolderGit2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base text-slate-100">
                  企业多项目研发质量大盘 (Multi-Project Guard Center)
                </h2>
                <span className="rounded-full bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 text-[10px] font-medium text-cyan-400">
                  实时审计与策略分发
                </span>
              </div>
              <p className="text-xs text-slate-400">
                集中监控各团队仓库的 Git Pre-Commit 门禁拦截状态，并将当前 DAG 编排策略一键分发下发至指定项目
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                fetchProjects();
                fetchRecentEvents(selectedProjectId === "all" ? undefined : selectedProjectId);
              }}
              className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
              title="刷新数据"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={() => setProjectStatsModalOpen(false)}
              className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40">
              <div className="text-xs text-slate-400">接入项目数</div>
              <div className="text-2xl font-bold text-slate-100 mt-1">
                {projects.length}
                <span className="text-xs font-normal text-slate-500 ml-1.5">个代码仓库</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">覆盖全部已接入仓库</div>
            </div>

            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40">
              <div className="text-xs text-slate-400">累计代码门禁审查</div>
              <div className="text-2xl font-bold text-blue-400 mt-1">
                {totalScans}
                <span className="text-xs font-normal text-slate-500 ml-1.5">次 Commit</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Git 钩子实时审计</div>
            </div>

            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40">
              <div className="text-xs text-slate-400">发现并拦截隐患</div>
              <div className="text-2xl font-bold text-rose-400 mt-1">
                {totalBlocked}
                <span className="text-xs font-normal text-slate-500 ml-1.5">次阻断</span>
              </div>
              <div className="text-[11px] text-rose-500/80 mt-1">已在提交前成功掐断</div>
            </div>

            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40">
              <div className="text-xs text-slate-400">整体代码通过率</div>
              <div className="text-2xl font-bold text-emerald-400 mt-1">
                {overallPassRate}%
              </div>
              <div className="text-[11px] text-emerald-500/80 mt-1">单测通过与零严重缺陷</div>
            </div>
          </div>

          {/* Monitored Projects Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-cyan-400" />
                接入项目策略与质量健康度
              </h3>
              <span className="text-xs text-slate-400">
                点击切换项目筛选，或将当前画布 DAG 策略覆盖至该仓库
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((proj) => {
                const isSelected = selectedProjectId === proj.id;
                const isSaving = savingProjectId === proj.id;
                const isSaved = saveSuccessMap[proj.id];

                return (
                  <div
                    key={proj.id}
                    onClick={() => setSelectedProjectId(isSelected ? "all" : proj.id)}
                    className={cn(
                      "p-4 rounded-xl border transition-all cursor-pointer relative",
                      isSelected
                        ? "bg-slate-900/90 border-cyan-500/50 shadow-lg shadow-cyan-500/10"
                        : "bg-slate-900/40 border-slate-800 hover:border-slate-700"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-100 font-mono">
                            {proj.id}
                          </span>
                          {isSelected && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-medium">
                              当前选中
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-300 mt-0.5 font-medium">
                          {proj.name}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                          {proj.description || "无项目备注"}
                        </p>
                      </div>

                      <div className="text-right">
                        <div className="text-sm font-bold text-slate-200 font-mono">
                          {proj.pass_rate}%
                        </div>
                        <div className="text-[10px] text-slate-500">通过率</div>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-3">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          proj.pass_rate >= 80
                            ? "bg-emerald-500"
                            : proj.pass_rate >= 50
                            ? "bg-amber-500"
                            : "bg-rose-500"
                        )}
                        style={{ width: `${Math.max(proj.pass_rate, 4)}%` }}
                      />
                    </div>

                    {/* Stats & Actions row */}
                    <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                      <div>
                        <span>审查 {proj.total_scans} 次</span>
                        <span className="mx-1.5 text-slate-600">/</span>
                        <span className="text-emerald-400">放行 {proj.passed_scans} 次</span>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSavePolicy(proj.id);
                        }}
                        disabled={isSaving}
                        className={cn(
                          "px-2 py-1 rounded text-xs flex items-center gap-1 transition-all",
                          isSaved
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                        )}
                        title="将当前画布的节点与拓扑保存为此项目专用的审查门禁"
                      >
                        {isSaved ? (
                          <>
                            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                            <span>策略已下发</span>
                          </>
                        ) : isSaving ? (
                          <>
                            <RefreshCw className="h-3 w-3 animate-spin" />
                            <span>同步中...</span>
                          </>
                        ) : (
                          <>
                            <Save className="h-3 w-3 text-cyan-400" />
                            <span>保存策略至此</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Audit Events Log Table */}
          <div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-blue-400" />
                  提交审计历史流水
                  <span className="text-xs font-normal text-slate-400">
                    ({selectedProjectId === "all" ? "全部项目" : `项目: ${selectedProjectId}`})
                  </span>
                </h3>
              </div>

              {/* Filter controls */}
              <div className="flex items-center gap-2">
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

            {/* Table */}
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/30">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900/70 border-b border-slate-800 text-[11px] text-slate-400 font-medium">
                  <tr>
                    <th className="py-2.5 px-3">状态</th>
                    <th className="py-2.5 px-3">项目</th>
                    <th className="py-2.5 px-3">提交者 / 分支</th>
                    <th className="py-2.5 px-3">文件数</th>
                    <th className="py-2.5 px-4">审查判定与缺陷</th>
                    <th className="py-2.5 px-3">时间</th>
                    <th className="py-2.5 px-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredEvents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-500">
                        暂无符合条件的审计日志
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
                                <User className="h-3 w-3 text-slate-500" />
                                <span>{ev.committer}</span>
                              </div>
                              <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono mt-0.5">
                                <GitBranch className="h-2.5 w-2.5 text-slate-500" />
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

                            <td className="py-2.5 px-3 whitespace-nowrap text-slate-400">
                              <div className="font-mono text-xs text-slate-200">
                                {formatTime(ev.created_at)}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                {formatRelativeTime(ev.created_at)}
                              </div>
                            </td>

                            <td className="py-2.5 px-3 text-right">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedEventId(isExpanded ? null : ev.id);
                                }}
                                className="text-blue-400 hover:text-blue-300 text-xs"
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
                                      审查结果概览:
                                    </div>
                                    <p className="text-xs text-slate-400">{ev.summary}</p>
                                  </div>

                                  {ev.critical_issues.length > 0 && (
                                    <div className="p-3 rounded-lg bg-rose-950/20 border border-rose-900/40">
                                      <div className="text-xs font-semibold text-rose-300 mb-1.5 flex items-center gap-1.5">
                                        <ShieldAlert className="h-4 w-4" />
                                        致命阻断隐患 (Critical Issues):
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
                                        自愈与重构建议 (Suggestions):
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
      </div>
    </div>
  );
}
