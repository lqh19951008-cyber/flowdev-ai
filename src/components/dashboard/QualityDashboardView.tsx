"use client";

import React, { useState, useEffect } from "react";
import {
  FolderGit2,
  ShieldCheck,
  ShieldAlert,
  Clock,
  User,
  GitBranch,
  RefreshCw,
  Search,
  Sliders,
  FileCode,
  Layers,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Radio,
  CheckCheck,
  Mail,
  MailOpen,
  Eye,
  Bot,
  Terminal,
  Zap,
} from "lucide-react";
import { Chip } from "@heroui/react";
import { useFlowStore } from "@/stores/useFlowStore";
import { cn, formatTime, formatRelativeTime, formatDate } from "@/lib/utils";
import { IntegrationGuideModal } from "@/components/modal/IntegrationGuideModal";
import { RuleEvolutionModal } from "@/components/modal/RuleEvolutionModal";
import { ScanEventItem } from "@/types/flow";


export function QualityDashboardView() {
  const {
    projects,
    selectedProjectId,
    setSelectedProjectId,
    recentEvents,
    readEventIds,
    markEventAsRead,
    markAllEventsAsRead,
    toggleEventRead,
    isEventRead,
    unreadEventsCount,
    fetchProjects,
    fetchRecentEvents,
    setActiveViewMode,
    setSettingsModalOpen,
  } = useFlowStore();

  const [filterPassed, setFilterPassed] = useState<string>("all");
  const [searchKeyword, setSearchKeyword] = useState<string>("");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isIntegrationModalOpen, setIsIntegrationModalOpen] = useState(false);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [ruleModalEvent, setRuleModalEvent] = useState<ScanEventItem | null>(null);

  const handleOpenRuleEvolution = (event: ScanEventItem) => {
    setRuleModalEvent(event);
    setIsRuleModalOpen(true);
  };

  const handleOpenRuleLibrary = () => {
    setRuleModalEvent(null);
    setIsRuleModalOpen(true);
  };


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

  // Unread count within the selected project scope
  const scopedEvents = recentEvents.filter(
    (ev) => selectedProjectId === "all" || ev.project_id === selectedProjectId
  );
  const unreadScopedCount = scopedEvents.filter((ev) => !readEventIds.includes(ev.id)).length;

  // Filtered events
  const filteredEvents = scopedEvents.filter((ev) => {
    const isRead = readEventIds.includes(ev.id);
    if (filterPassed === "unread" && isRead) return false;
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
    <div className="flex-1 w-full h-full overflow-y-auto bg-slate-50 dark:bg-[#0b0f19] p-4 md:p-6 space-y-6 transition-colors duration-200">
      {/* Top Banner for Tech Lead / Admin */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/90 bg-gradient-to-r from-blue-50/90 via-indigo-50/40 to-white dark:from-slate-900/90 dark:via-slate-900/60 dark:to-slate-950 shadow-sm dark:shadow-xl backdrop-blur">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
            <ShieldCheck className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                企业研发效能与代码质量管控中台
              </h1>
              <span className="rounded-full bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-xs font-mono font-medium text-blue-600 dark:text-blue-400">
                DevOps Control Center
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              全公司代码仓库集中监控 · 拦截空指针与致命崩溃 · Git Pre-Commit 规则动态下发
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono text-emerald-600 dark:text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Git Hook 探针全域守护中</span>
          </div>

          <button
            onClick={() => setSettingsModalOpen(true, "feishu")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors shadow-sm"
            title="配置飞书群机器人 Webhook 实时拦截通知"
          >
            <Bot className="h-3.5 w-3.5 text-blue-500" />
            <span>飞书通知</span>
          </button>


          <button
            onClick={() => setIsIntegrationModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors shadow-sm cursor-pointer"
            title="查看外部代码仓库如何接入 FlowDev 门禁探针"
          >
            <Terminal className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
            <span>接入指引</span>
          </button>

          <button
            onClick={handleOpenRuleLibrary}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-xs font-semibold text-amber-700 dark:text-amber-300 transition-colors shadow-sm cursor-pointer"
            title="查看与导出已沉淀的 IDE Agent Skills 与门禁规则库"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span>规则与 Skill 库</span>
          </button>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors shadow-sm cursor-pointer"
            title="刷新大盘最新数据"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 text-slate-500 dark:text-slate-400", isRefreshing && "animate-spin text-blue-500")} />
            <span>{isRefreshing ? "刷新中..." : "刷新大盘"}</span>
          </button>
        </div>
      </div>

      {/* 4 Core KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/50 shadow-sm hover:shadow-md hover:border-blue-400/40 dark:hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>已接入代码仓库</span>
            <FolderGit2 className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1.5 font-mono">
            {projects.length}
            <span className="text-xs font-normal text-slate-500 ml-1.5 font-sans">个项目</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <span className="text-cyan-600 dark:text-cyan-400 font-medium">已部署探针</span>
            <span>包含 rxjs, bsc-aisware 等</span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/50 shadow-sm hover:shadow-md hover:border-blue-400/40 dark:hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>门禁累计代码审查</span>
            <Radio className="h-4 w-4 text-blue-500 dark:text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1.5 font-mono">
            {totalScans}
            <span className="text-xs font-normal text-slate-500 ml-1.5 font-sans">次 Commit</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Pre-Commit 钩子实时审计
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/50 shadow-sm hover:shadow-md hover:border-rose-400/40 dark:hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>拦截致命崩溃隐患</span>
            <AlertTriangle className="h-4 w-4 text-rose-500 dark:text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1.5 font-mono">
            {totalBlocked}
            <span className="text-xs font-normal text-slate-500 ml-1.5 font-sans">次拦截</span>
          </div>
          <div className="text-[11px] text-rose-600/90 dark:text-rose-400/90 mt-1 font-medium">
            已在提交入库前精准阻止
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/50 shadow-sm hover:shadow-md hover:border-emerald-400/40 dark:hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>全团队提交安全通过率</span>
            <TrendingUp className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1.5 font-mono">
            {overallPassRate}%
          </div>
          <div className="text-[11px] text-emerald-600/90 dark:text-emerald-400/90 mt-1 font-medium">
            零阻断缺陷 & 单测验证合格
          </div>
        </div>
      </div>

      {/* Monitored Repositories & Active Policy Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-2">
            <Layers className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            各仓库健康度与门禁策略配置
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
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
                  "p-4 rounded-xl border transition-all cursor-pointer relative shadow-sm hover:shadow-md",
                  isSelected
                    ? "bg-blue-50/40 dark:bg-slate-900/90 border-blue-500/60 dark:border-cyan-500/60 shadow-lg shadow-blue-500/10 dark:shadow-cyan-500/10 ring-2 ring-blue-500/30 dark:ring-cyan-500/30"
                    : "bg-white dark:bg-slate-900/40 border-slate-200/80 dark:border-slate-800 hover:border-blue-400/50 dark:hover:border-slate-700"
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-slate-100 font-mono truncate">
                        {proj.id}
                      </span>
                      {isSelected && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/15 dark:bg-cyan-500/20 text-blue-700 dark:text-cyan-300 font-medium">
                          当前筛选
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-700 dark:text-slate-300 mt-0.5 font-medium truncate">
                      {proj.name}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                      {proj.description || "代码仓库已接入门禁探针"}
                    </p>
                  </div>

                  <div className="text-right shrink-0 ml-2">
                    <div className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono">
                      {proj.pass_rate}%
                    </div>
                    <div className="text-[10px] text-slate-500">通过率</div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-3">
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
                <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1">
                    <span>审查 {proj.total_scans} 次</span>
                    <span className="text-slate-300 dark:text-slate-600">/</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">放行 {proj.passed_scans} 次</span>
                    {proj.last_scan_at && (
                      <span className="hidden xl:inline text-slate-400 dark:text-slate-500 font-mono ml-1">
                        · {formatRelativeTime(proj.last_scan_at)}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedProjectId(proj.id);
                      setActiveViewMode("pipeline");
                    }}
                    className="flex items-center gap-1 text-xs text-blue-600 dark:text-cyan-400 hover:text-blue-700 dark:hover:text-cyan-300 font-medium transition-colors"
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
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500 dark:text-blue-400" />
              全员提交拦截与审计流水
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                ({selectedProjectId === "all" ? "全部仓库" : `仓库: ${selectedProjectId}`})
              </span>
            </h2>

            {unreadScopedCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                {unreadScopedCount} 条未读
              </span>
            )}
          </div>

          {/* Filter controls & Batch actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {unreadScopedCount > 0 && (
              <button
                onClick={() => markAllEventsAsRead()}
                className="h-7 flex items-center gap-1.5 px-2.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800/80 rounded-lg transition-colors shadow-xs shrink-0"
                title="将当前全部未读提交审计标记为已读"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span>一键全读</span>
              </button>
            )}

            <div className="relative flex items-center">
              <Search className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none shrink-0" />
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="搜索提交人、缺陷、仓库..."
                className="pl-8 pr-3 h-7 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 w-44 sm:w-52 shadow-xs transition-colors"
              />
            </div>

            <div className="flex items-center h-7 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-0.5 text-xs shadow-xs">
              <button
                onClick={() => setFilterPassed("all")}
                className={cn(
                  "px-2.5 py-0.5 rounded text-xs transition-colors font-medium",
                  filterPassed === "all"
                    ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                )}
              >
                全部
              </button>
              <button
                onClick={() => setFilterPassed("unread")}
                className={cn(
                  "px-2.5 py-0.5 rounded text-xs transition-colors font-medium flex items-center gap-1",
                  filterPassed === "unread"
                    ? "bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 shadow-xs font-semibold"
                    : "text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-slate-200"
                )}
              >
                <span>未读</span>
                {unreadScopedCount > 0 && (
                  <span className="px-1 py-0.2 rounded-full text-[9px] bg-blue-500 text-white font-mono leading-none">
                    {unreadScopedCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setFilterPassed("blocked")}
                className={cn(
                  "px-2.5 py-0.5 rounded text-xs transition-colors font-medium",
                  filterPassed === "blocked"
                    ? "bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-300 shadow-xs font-semibold"
                    : "text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-slate-200"
                )}
              >
                已拦截
              </button>
              <button
                onClick={() => setFilterPassed("passed")}
                className={cn(
                  "px-2.5 py-0.5 rounded text-xs transition-colors font-medium",
                  filterPassed === "passed"
                    ? "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 shadow-xs font-semibold"
                    : "text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-slate-200"
                )}
              >
                已放行
              </button>
            </div>
          </div>
        </div>

        {/* Audit Table */}
        <div className="border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900/40 shadow-sm dark:shadow-xl">
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-50/80 dark:bg-slate-900/80 border-b border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              <tr>
                <th className="py-2.5 px-3">状态</th>
                <th className="py-2.5 px-3">仓库</th>
                <th className="py-2.5 px-3">提交者 / 分支</th>
                <th className="py-2.5 px-3">文件数</th>
                <th className="py-2.5 px-4">门禁审查结论与缺陷</th>
                <th className="py-2.5 px-3">审查时间</th>
                <th className="py-2.5 px-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400 dark:text-slate-500">
                    {filterPassed === "unread"
                      ? "暂无未读记录，所有提交已全部阅毕。"
                      : "暂无符合条件的门禁提交记录。在任意接入项目中执行 git commit 将在此全量留痕。"}
                  </td>
                </tr>
              ) : (
                filteredEvents.map((ev) => {
                  const isExpanded = selectedEventId === ev.id;
                  const isRead = readEventIds.includes(ev.id);

                  return (
                    <React.Fragment key={ev.id}>
                      <tr
                        className={cn(
                          "hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer",
                          !ev.passed && "bg-rose-50/20 dark:bg-rose-950/10",
                          !isRead && "bg-blue-50/20 dark:bg-blue-950/10 font-medium"
                        )}
                        onClick={() => {
                          setSelectedEventId(isExpanded ? null : ev.id);
                          if (!isRead) markEventAsRead(ev.id);
                        }}
                      >
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {ev.passed ? (
                              <Chip
                                size="sm"
                                color="success"
                                variant="flat"
                                className="font-medium text-[11px] h-6"
                                startContent={<ShieldCheck className="h-3 w-3" />}
                              >
                                放行
                              </Chip>
                            ) : (
                              <Chip
                                size="sm"
                                color="danger"
                                variant="flat"
                                className="font-medium text-[11px] h-6"
                                startContent={<ShieldAlert className="h-3 w-3" />}
                              >
                                拦截
                              </Chip>
                            )}

                            {!isRead ? (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 dark:text-cyan-300 bg-blue-50 dark:bg-cyan-500/15 border border-blue-200 dark:border-cyan-500/30 px-1.5 py-0.5 rounded-full"
                                title="未读记录"
                              >
                                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 dark:bg-cyan-400 animate-pulse" />
                                未读
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono px-1">
                                已读
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-2.5 px-3 font-mono font-medium text-blue-600 dark:text-cyan-300">
                          {ev.project_id}
                        </td>

                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1 text-slate-900 dark:text-slate-200">
                            <User className="h-3 w-3 text-slate-400 dark:text-slate-500 shrink-0" />
                            <span className="truncate max-w-[140px] font-medium">{ev.committer}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                            <GitBranch className="h-2.5 w-2.5 text-slate-400 dark:text-slate-500 shrink-0" />
                            <span>{ev.branch}</span>
                          </div>
                        </td>

                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 font-mono">
                          <span className="flex items-center gap-1">
                            <FileCode className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                            {ev.files_count}
                          </span>
                        </td>

                        <td className="py-2.5 px-4 max-w-md">
                          <div className={cn(
                            "line-clamp-1 text-slate-800 dark:text-slate-200",
                            !isRead ? "font-semibold" : "font-normal"
                          )}>
                            {ev.summary}
                          </div>
                          {ev.critical_issues.length > 0 && (
                            <div className="line-clamp-1 text-[11px] text-rose-600 dark:text-rose-400 font-mono mt-0.5 font-medium">
                              {ev.critical_issues[0]}
                              {ev.critical_issues.length > 1 && ` (+${ev.critical_issues.length - 1}项)`}
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 dark:text-slate-400">
                          <div className="font-mono text-xs text-slate-800 dark:text-slate-200">
                            {formatTime(ev.created_at)}
                          </div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5 flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5 text-slate-400" />
                            <span>{formatRelativeTime(ev.created_at)}</span>
                          </div>
                        </td>

                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleEventRead(ev.id);
                              }}
                              className={cn(
                                "p-1 rounded text-xs transition-colors",
                                isRead
                                  ? "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                                  : "text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                              )}
                              title={isRead ? "标为未读" : "标为已读"}
                            >
                              {isRead ? (
                                <Mail className="h-3.5 w-3.5" />
                              ) : (
                                <MailOpen className="h-3.5 w-3.5" />
                              )}
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEventId(isExpanded ? null : ev.id);
                                if (!isRead) markEventAsRead(ev.id);
                              }}
                              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-xs font-medium px-1.5 py-0.5 rounded hover:bg-blue-50 dark:hover:bg-blue-950/40"
                            >
                              {isExpanded ? "收起" : "展开详情"}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Detail Row */}
                      {isExpanded && (
                        <tr className="bg-slate-50/70 dark:bg-slate-900/80">
                          <td colSpan={7} className="p-4 border-t border-slate-200/80 dark:border-slate-800">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                  门禁审查结论概览:
                                </div>
                                <div className="text-[11px] text-slate-400 font-mono">
                                  记录 ID: {ev.id} · 提交时间: {formatTime(ev.created_at)} ({formatRelativeTime(ev.created_at)})
                                </div>
                              </div>
                              <p className="text-xs text-slate-600 dark:text-slate-400">{ev.summary}</p>

                              {ev.critical_issues.length > 0 && (
                                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40">
                                  <div className="text-xs font-semibold text-rose-700 dark:text-rose-300 mb-1.5 flex items-center gap-1.5">
                                    <ShieldAlert className="h-4 w-4" />
                                    阻断性致命缺陷 (Critical Issues):
                                  </div>
                                  <ul className="space-y-1">
                                    {ev.critical_issues.map((iss, i) => (
                                      <li key={i} className="text-xs text-rose-800 dark:text-rose-200 font-mono">
                                        • {iss}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {ev.suggestions.length > 0 && (
                                <div className="p-3 rounded-lg bg-blue-50/70 dark:bg-cyan-950/20 border border-blue-200/80 dark:border-cyan-900/40">
                                  <div className="text-xs font-semibold text-blue-700 dark:text-cyan-300 mb-1.5 flex items-center gap-1.5">
                                    <Sparkles className="h-4 w-4" />
                                    优化与重构建议 (Suggestions):
                                  </div>
                                  <ul className="space-y-1">
                                    {ev.suggestions.map((sug, i) => (
                                      <li key={i} className="text-xs text-blue-800 dark:text-cyan-200 font-mono">
                                        • {sug}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Rule & Skill Evolution Action Bar */}
                              <div className="pt-2 flex items-center justify-between border-t border-slate-200/60 dark:border-slate-800 flex-wrap gap-2">
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                  <Sparkles className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
                                  <span>防患于未然：从本次门禁拦截沉淀为团队工程规范与 IDE 智能体 Skill</span>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenRuleEvolution(ev);
                                  }}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-amber-500 via-indigo-600 to-cyan-600 hover:from-amber-600 hover:to-indigo-700 text-white shadow-sm hover:shadow transition-all cursor-pointer"
                                  title="一键提炼规则并转化为 .cursorrules / SKILL.md 与门禁卡点"
                                >
                                  <Zap className="h-3.5 w-3.5" />
                                  <span>💡 沉淀为规则与 Skill</span>
                                </button>
                              </div>
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

      <IntegrationGuideModal
        isOpen={isIntegrationModalOpen}
        onClose={() => setIsIntegrationModalOpen(false)}
      />

      <RuleEvolutionModal
        isOpen={isRuleModalOpen}
        onClose={() => setIsRuleModalOpen(false)}
        scanEvent={ruleModalEvent}
        projectId={selectedProjectId}
        onRuleApplied={handleRefresh}
      />
    </div>
  );
}
