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
  Power,
  Target,
  Plus,
  Trash2,
  GripVertical,
  Users,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  X,
} from "lucide-react";
import { Chip, Spinner, Checkbox } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useFlowStore } from "@/stores/useFlowStore";
import { cn, formatTime, formatRelativeTime, formatDate } from "@/lib/utils";
import { IntegrationGuideModal } from "@/components/modal/IntegrationGuideModal";
import { RuleEvolutionModal } from "@/components/modal/RuleEvolutionModal";
import { AuditChatSkillModal } from "@/components/modal/AuditChatSkillModal";
import { ScanEventItem, ProjectItem, CommitterStat } from "@/types/flow";

export function QualityDashboardView() {
  const router = useRouter();
  const {
    projects,
    selectedProjectId,
    setSelectedProjectId,
    recentEvents,
    readEventIds,
    markEventAsRead,
    markAllEventsAsRead,
    toggleEventRead,
    highlightedEventId,
    setHighlightedEventId,
    fetchProjects,
    updateProjectGateMode,
    fetchRecentEvents,
    setActiveViewMode,
    setSettingsModalOpen,
    setAddProjectModalOpen,
    deleteProject,
    reorderProjects,
  } = useFlowStore();

  const [filterPassed, setFilterPassed] = useState<string>("all");
  const [searchKeyword, setSearchKeyword] = useState<string>("");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isIntegrationModalOpen, setIsIntegrationModalOpen] = useState(false);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [ruleModalEvent, setRuleModalEvent] = useState<ScanEventItem | null>(null);
  const [modeNotification, setModeNotification] = useState<string | null>(null);
  const [isUpdatingMode, setIsUpdatingMode] = useState<string | null>(null);
  const [quickRuleText, setQuickRuleText] = useState<string>("");

  // === All-member commit interception: multi-select events for AI skill generation ===
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const [isAuditChatModalOpen, setIsAuditChatModalOpen] = useState(false);

  // Pagination & Copy states for audit log list
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [copiedEventId, setCopiedEventId] = useState<string | null>(null);

  // === Committer leaderboard (右下方按提交人展示拦截情况) ===
  const [committerStats, setCommitterStats] = useState<CommitterStat[]>([]);
  const [committerLoading, setCommitterLoading] = useState(false);

  // Multi-project Delete and Drag-and-drop state
  const [projectPendingDelete, setProjectPendingDelete] = useState<ProjectItem | null>(null);
  const [isDeletingProject, setIsDeletingProject] = useState(false);
  const [draggedProjectId, setDraggedProjectId] = useState<string | null>(null);
  const [dragOverProjectId, setDragOverProjectId] = useState<string | null>(null);


  const handleToggleGateMode = async (
    projectId: string,
    mode: "block_commit" | "warn_only" | "disabled"
  ) => {
    setIsUpdatingMode(projectId);
    try {
      await updateProjectGateMode?.(projectId, mode);
      const modeLabel =
        mode === "warn_only"
          ? "⚠️ 仅提示不阻断模式（提交 100% 放行，不卡开发！）"
          : mode === "disabled"
          ? "⚪ 门禁已完全关闭（跳过检查秒级提交）"
          : "🛑 严格阻断模式（拦截严重隐患）";
      setModeNotification(`仓库 [${projectId}] 门禁已切换为：${modeLabel}`);
      setTimeout(() => setModeNotification(null), 5000);
    } catch (e) {
      console.error("Failed to toggle gate mode", e);
    } finally {
      setIsUpdatingMode(null);
    }
  };

  const handleOpenRuleEvolution = (event: ScanEventItem) => {
    setRuleModalEvent(event);
    setIsRuleModalOpen(true);
  };

  const handleOpenBatchAggregate = () => {
    // Open RuleEvolutionModal in batch mode (no scanEvent, modal will route to batch tab)
    setRuleModalEvent(null);
    setIsRuleModalOpen(true);
  };

  const handleOpenRuleLibrary = () => {
    const targetProj =
      selectedProjectId && selectedProjectId !== "all"
        ? selectedProjectId
        : (projects?.[0]?.id ?? "");
    if (!targetProj) return;
    router?.push?.(`/skills?project=${encodeURIComponent(targetProj)}`);
  };

  const handleDragStart = (e: React.DragEvent, projId: string) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", projId);
    setDraggedProjectId(projId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDragEnter = (projId: string) => {
    if (draggedProjectId && draggedProjectId !== projId) {
      setDragOverProjectId(projId);
    }
  };

  const handleDrop = (e: React.DragEvent, targetProjId: string) => {
    e.preventDefault();
    if (!draggedProjectId || draggedProjectId === targetProjId) {
      setDraggedProjectId(null);
      setDragOverProjectId(null);
      return;
    }

    const currentList = [...(projects ?? [])];
    const fromIndex = currentList.findIndex((p) => p.id === draggedProjectId);
    const toIndex = currentList.findIndex((p) => p.id === targetProjId);

    if (fromIndex >= 0 && toIndex >= 0) {
      const [moved] = currentList.splice(fromIndex, 1);
      currentList.splice(toIndex, 0, moved);
      reorderProjects?.(currentList);
    }

    setDraggedProjectId(null);
    setDragOverProjectId(null);
  };

  const handleDragEnd = () => {
    setDraggedProjectId(null);
    setDragOverProjectId(null);
  };

  // === Multi-select audit events for AI skill generation ===
  const toggleEventSelection = (eventId: string | undefined | null) => {
    if (!eventId) return;
    setSelectedEventIds((prev) =>
      prev.includes(eventId) ? prev.filter((x) => x !== eventId) : [...prev, eventId]
    );
  };

  const selectAllBlocked = () => {
    const blocked = (safeEvents ?? [])
      .filter((e) => e && !e.passed)
      .map((e) => e.id);
    setSelectedEventIds(Array.from(new Set(blocked)));
  };

  const clearSelection = () => setSelectedEventIds([]);

  const handleOpenAuditChat = () => {
    if (selectedEventIds.length === 0) {
      // Auto-select all blocked events if user clicked without picking
      selectAllBlocked();
    }
    setIsAuditChatModalOpen(true);
  };

  const handleCopyEventIssues = (ev: ScanEventItem) => {
    if (!ev?.id) return;
    const lines = [
      `【FlowDev 门禁拦截记录】`,
      `仓库: ${ev.project_id ?? "未知"}`,
      `分支: ${ev.branch ?? "未知"}`,
      `提交人: ${ev.committer ?? "未知"}`,
      `审查时间: ${formatTime(ev.created_at)}`,
      `结论: ${ev.summary ?? ""}`,
      (ev.critical_issues ?? []).length > 0
        ? `致命缺陷:\n${(ev.critical_issues ?? []).map((iss) => `  • ${iss}`).join("\n")}`
        : "",
      (ev.suggestions ?? []).length > 0
        ? `优化建议:\n${(ev.suggestions ?? []).map((sug) => `  • ${sug}`).join("\n")}`
        : "",
    ].filter(Boolean);

    if (typeof navigator !== "undefined" && navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(lines.join("\n"));
      setCopiedEventId(ev.id);
      setTimeout(() => setCopiedEventId(null), 2000);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [filterPassed, searchKeyword, selectedProjectId]);

// In-Memory SWR Cache for Committer leaderboard
const committerStatsMemoryCache = {
  data: [] as CommitterStat[],
  timestamp: 0,
};

  // Fetch committer leaderboard (sourced from /api/audit/committers)
  const fetchCommitterLeaderboard = async (days: number = 30, force = false) => {
    const now = Date.now();
    if (!force && committerStatsMemoryCache.data.length > 0 && now - committerStatsMemoryCache.timestamp < 30000) {
      setCommitterStats(committerStatsMemoryCache.data);
      return;
    }
    setCommitterLoading(committerStatsMemoryCache.data.length === 0);
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/api/audit/committers?days=${days}&limit=20`
      );
      if (res?.ok) {
        const data: CommitterStat[] = await res.json();
        const safeData = Array.isArray(data) ? data : [];
        committerStatsMemoryCache.data = safeData;
        committerStatsMemoryCache.timestamp = Date.now();
        setCommitterStats(safeData);
      }
    } catch (e) {
      console.warn("Failed to fetch committer leaderboard", e);
    } finally {
      setCommitterLoading(false);
    }
  };


  useEffect(() => {
    fetchProjects?.();
    fetchRecentEvents?.(selectedProjectId === "all" ? undefined : selectedProjectId);
    fetchCommitterLeaderboard(30);
  }, [selectedProjectId, fetchProjects, fetchRecentEvents]);

  // Handle highlightedEventId auto-scrolling & auto-expansion
  useEffect(() => {
    if (!highlightedEventId) return;

    // Ensure filters don't hide the targeted audit event
    setFilterPassed("all");
    setSearchKeyword("");

    const timer = setTimeout(() => {
      const targetElement =
        document.getElementById(`audit-event-${highlightedEventId}`) ||
        document.getElementById(`event-card-${highlightedEventId}`);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      setSelectedEventId(highlightedEventId);
    }, 150);

    const clearPulseTimer = setTimeout(() => {
      setHighlightedEventId?.(null);
    }, 5000);

    return () => {
      clearTimeout(timer);
      clearTimeout(clearPulseTimer);
    };
  }, [highlightedEventId, recentEvents, selectedProjectId, setHighlightedEventId]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        fetchProjects?.(true),
        fetchRecentEvents?.(selectedProjectId === "all" ? undefined : selectedProjectId, true),
        fetchCommitterLeaderboard(30, true),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Safe snapshots
  const safeProjects = projects ?? [];
  const safeEvents = recentEvents ?? [];
  const safeReadIds = readEventIds ?? [];

  // Aggregate statistics
  const totalScans = safeProjects.reduce((acc, p) => acc + (p?.total_scans ?? 0), 0);
  const totalPassed = safeProjects.reduce((acc, p) => acc + (p?.passed_scans ?? 0), 0);
  const totalBlocked = Math.max(0, totalScans - totalPassed);
  const overallPassRate = totalScans > 0 ? ((totalPassed / totalScans) * 100).toFixed(1) : "100.0";

  // Unread count within the selected project scope
  const scopedEvents = safeEvents.filter(
    (ev) => selectedProjectId === "all" || ev?.project_id === selectedProjectId
  );
  const unreadScopedCount = scopedEvents.filter((ev) => !safeReadIds.includes(ev?.id ?? "")).length;

  // Filtered events
  const filteredEvents = scopedEvents.filter((ev) => {
    if (!ev) return false;
    const isRead = safeReadIds.includes(ev?.id ?? "");
    if (filterPassed === "unread" && isRead) return false;
    if (filterPassed === "passed" && !ev.passed) return false;
    if (filterPassed === "blocked" && ev.passed) return false;
    const q = (searchKeyword ?? "").trim().toLowerCase();
    if (q.length > 0) {
      const matchProject = (ev?.project_id ?? "").toLowerCase().includes(q);
      const matchCommitter = (ev?.committer ?? "").toLowerCase().includes(q);
      const matchSummary = (ev?.summary ?? "").toLowerCase().includes(q);
      const matchIssue = (ev?.critical_issues ?? []).some((i) => (i ?? "").toLowerCase().includes(q));
      if (!matchProject && !matchCommitter && !matchSummary && !matchIssue) return false;
    }
    return true;
  });

  // Tab counters
  const totalAllCount = scopedEvents.length;
  const totalBlockedCount = scopedEvents.filter((e) => !e?.passed).length;
  const totalPassedCount = scopedEvents.filter((e) => e?.passed).length;

  // Pagination calculation
  const totalFilteredCount = filteredEvents.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredCount / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalFilteredCount);
  const paginatedEvents = filteredEvents.slice(startIndex, endIndex);

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
            <span>Git Hook 探针守护中</span>
          </div>

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
            onClick={handleOpenBatchAggregate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-xs font-semibold text-cyan-700 dark:text-cyan-300 transition-colors shadow-sm cursor-pointer"
            title="从多条拦截事件中提取共同根因, 一次性聚合生成一条跨场景的通用 Skill + 规则"
          >
            <Layers className="h-3.5 w-3.5 text-cyan-500" />
            <span>批量聚合生成 Skill</span>
          </button>
        </div>
      </div>

      {/* Mode Notification Floating Toast / Banner */}
      {modeNotification && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300/80 dark:border-emerald-700/60 text-emerald-800 dark:text-emerald-200 text-xs shadow-md animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="font-semibold">{modeNotification}</span>
            <span className="text-emerald-600 dark:text-emerald-400 text-[11px]">
              （下一次 git commit 立即生效）
            </span>
          </div>
          <button
            onClick={() => setModeNotification(null)}
            className="text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-white text-xs px-1.5 py-0.5 rounded cursor-pointer"
          >
            ✕ 关闭
          </button>
        </div>
      )}

      {/* 4 Core KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/50 shadow-sm hover:shadow-md hover:border-blue-400/40 dark:hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>已接入代码仓库</span>
            <FolderGit2 className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1.5 font-mono">
            {safeProjects.length}
            <span className="text-xs font-normal text-slate-500 ml-1.5 font-sans">个项目</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <span className="text-cyan-600 dark:text-cyan-400 font-medium">已部署探针</span>
            <span>覆盖全部已接入仓库</span>
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

        <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/50 shadow-sm hover:shadow-md hover:border-blue-400/40 dark:hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>成功放行次数</span>
            <CheckCheck className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1.5 font-mono">
            {totalPassed}
            <span className="text-xs font-normal text-slate-500 ml-1.5 font-sans">次</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            通过门禁质量卡点
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/50 shadow-sm hover:shadow-md hover:border-blue-400/40 dark:hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>全团队综合通过率</span>
            <TrendingUp className="h-4 w-4 text-purple-500 dark:text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1.5 font-mono">
            {overallPassRate}%
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            已阻断隐患 {totalBlocked} 次
          </div>
        </div>
      </div>

      {/* Multi-Project Governance & Health Overview Grid */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <FolderGit2 className="h-4 w-4 text-blue-600 dark:text-cyan-400" />
              <span>多仓库质量健康度矩阵</span>
            </h2>
            <span className="text-xs font-mono text-slate-400">
              ({safeProjects.length} 个代码库)
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 hidden lg:inline">
              按住手柄可拖拽排序卡片 · 点击卡片切换过滤审计流水
            </span>
            <button
              type="button"
              onClick={() => setAddProjectModalOpen?.(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-semibold transition-all shadow-sm shadow-blue-500/20 cursor-pointer shrink-0"
              title="接入新的代码仓库到门禁监控矩阵"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>接入新项目</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {safeProjects.map((proj) => {
            const isSelected = selectedProjectId === proj.id;
            return (
              <div
                key={proj.id}
                draggable
                onDragStart={(e) => handleDragStart(e, proj.id)}
                onDragOver={handleDragOver}
                onDragEnter={() => handleDragEnter(proj.id)}
                onDrop={(e) => handleDrop(e, proj.id)}
                onDragEnd={handleDragEnd}
                onClick={() => {
                  const newTarget = isSelected ? "all" : proj.id;
                  setSelectedProjectId?.(newTarget);
                  if (newTarget === "all") {
                    router?.push?.("/dashboard");
                  } else {
                    router?.push?.(`/dashboard?project=${encodeURIComponent(newTarget)}`);
                  }
                }}
                className={cn(
                  "p-4 rounded-xl border transition-all cursor-pointer relative shadow-sm hover:shadow-md select-none",
                  draggedProjectId === proj.id && "opacity-35 scale-[0.98] border-dashed border-blue-400 dark:border-blue-500 ring-2 ring-inset ring-blue-400/30",
                  dragOverProjectId === proj.id && "ring-2 ring-inset ring-blue-500 border-blue-500 shadow-md shadow-blue-500/20 bg-blue-50/20 dark:bg-slate-800/80",
                  isSelected
                    ? "bg-blue-50/40 dark:bg-slate-900/90 border-blue-500/80 dark:border-cyan-500/80 shadow-lg shadow-blue-500/10 dark:shadow-cyan-500/10 ring-2 ring-inset ring-blue-500/40 dark:ring-cyan-500/40"
                    : "bg-white dark:bg-slate-900/40 border-slate-200/80 dark:border-slate-800 hover:border-blue-400/50 dark:hover:border-slate-700"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex items-start gap-2 flex-1">
                    {/* Drag Handle */}
                    <div
                      className="mt-0.5 text-slate-300 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 cursor-grab active:cursor-grabbing p-0.5 rounded transition-colors shrink-0"
                      title="按住拖拽调整卡片排序"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <GripVertical className="h-4 w-4" />
                    </div>

                    <div className="min-w-0 flex-1">
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
                  </div>

                  <div className="flex items-start gap-2 shrink-0 ml-2">
                    <div className="text-right">
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono">
                        {proj.pass_rate}%
                      </div>
                      <div className="text-[10px] text-slate-500">通过率</div>
                    </div>

                    {/* Delete Project Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setProjectPendingDelete(proj);
                      }}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      title="从门禁治理矩阵中移除此仓库"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>


                {/* Gatekeeper Mode & Control Switch */}
                <div
                  className="mt-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Power className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      proj.failure_action === "disabled" || proj.gate_enabled === false
                        ? "text-slate-400"
                        : proj.failure_action === "warn_only"
                        ? "text-amber-500"
                        : "text-rose-500"
                    )} />
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 shrink-0">
                      门禁卡点:
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap",
                        proj.failure_action === "disabled" || proj.gate_enabled === false
                          ? "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                          : proj.failure_action === "warn_only"
                          ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300/40"
                          : "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300/40"
                      )}
                    >
                      {proj.failure_action === "disabled" || proj.gate_enabled === false
                        ? "⚪ 已关闭"
                        : proj.failure_action === "warn_only"
                        ? "⚠️ 仅提示不阻断"
                        : "🛑 严格阻断"}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 bg-white dark:bg-slate-900 p-0.5 rounded-md border border-slate-200 dark:border-slate-800 shadow-xs">
                    <button
                      disabled={isUpdatingMode === proj.id}
                      onClick={() => handleToggleGateMode(proj.id, "warn_only")}
                      className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-medium transition-all cursor-pointer",
                        proj.failure_action === "warn_only"
                          ? "bg-amber-500 text-white font-bold shadow-xs"
                          : "text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                      )}
                      title="开发期推荐：AI正常输出优化建议，但100%放行提交，不阻断开发速度！"
                    >
                      仅提示
                    </button>
                    <button
                      disabled={isUpdatingMode === proj.id}
                      onClick={() => handleToggleGateMode(proj.id, "block_commit")}
                      className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-medium transition-all cursor-pointer",
                        proj.failure_action === "block_commit" && proj.gate_enabled !== false
                          ? "bg-rose-600 text-white font-bold shadow-xs"
                          : "text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      )}
                      title="严格卡点模式：发现严重问题拦截提交"
                    >
                      阻断
                    </button>
                    <button
                      disabled={isUpdatingMode === proj.id}
                      onClick={() => handleToggleGateMode(proj.id, "disabled")}
                      className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-medium transition-all cursor-pointer",
                        proj.failure_action === "disabled" || proj.gate_enabled === false
                          ? "bg-slate-600 text-white font-bold shadow-xs"
                          : "text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                      )}
                      title="完全关闭门禁：跳过检查秒级提交"
                    >
                      关闭
                    </button>
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
                      setSelectedProjectId?.(proj.id);
                      setActiveViewMode?.("pipeline");
                      router?.push?.(`/pipeline?project=${encodeURIComponent(proj.id)}`);
                    }}
                    className="flex items-center gap-1 text-xs text-blue-600 dark:text-cyan-400 hover:text-blue-700 dark:hover:text-cyan-300 font-medium transition-colors cursor-pointer"
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
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 bg-white dark:bg-slate-900/60 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center gap-2.5 flex-wrap min-w-0">
            <div className="flex items-center gap-2 shrink-0">
              <div className="h-7 w-7 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-cyan-400 shrink-0">
                <Clock className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                全员提交拦截与审计流水
              </h2>
              <span className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800">
                {selectedProjectId === "all" ? "全部仓库" : selectedProjectId}
              </span>
            </div>

            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-300 border border-violet-200 dark:border-violet-800/40 whitespace-nowrap">
              <Sparkles className="h-3 w-3 shrink-0 text-violet-500" />
              <span>抽屉模式 · 勾选/点击 → AI 对话 → 全员下发</span>
            </span>

            {unreadScopedCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 whitespace-nowrap">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-ping" />
                {unreadScopedCount} 条未读
              </span>
            )}
          </div>

          {/* Filter controls & Batch actions */}
          <div className="flex items-center gap-2 flex-wrap justify-end w-full lg:w-auto">
            {/* AI Skill Generator entry (Drawer trigger) */}
            <button
              onClick={handleOpenAuditChat}
              className={cn(
                "h-8 flex items-center gap-1.5 px-3 text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer shrink-0",
                selectedEventIds.length === 0
                  ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
                  : "bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-violet-500/20 animate-in fade-in"
              )}
              title="打开 AI 对话 Skill 生成器抽屉"
            >
              <Sparkles className="h-3.5 w-3.5 text-violet-400" />
              <span>AI 对话 Skill (抽屉)</span>
              {selectedEventIds.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-white/25 font-mono leading-none">
                  {selectedEventIds.length}
                </span>
              )}
            </button>

            {unreadScopedCount > 0 && (
              <button
                onClick={() => markAllEventsAsRead()}
                className="h-8 flex items-center gap-1.5 px-2.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800/80 rounded-xl transition-colors shadow-2xs shrink-0 cursor-pointer"
                title="将当前全部未读提交审计标记为已读"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span>一键全读</span>
              </button>
            )}

            {/* Search Input with clear button */}
            <div className="relative flex items-center">
              <Search className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none shrink-0 z-10" />
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="搜索提交人、缺陷、仓库..."
                className="pl-8 pr-7 h-8 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 w-44 sm:w-56 shadow-2xs transition-colors"
              />
              {searchKeyword && (
                <button
                  type="button"
                  onClick={() => setSearchKeyword("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  title="清空搜索"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Filter Tabs with real-time badges */}
            <div className="flex items-center h-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-0.5 text-xs shadow-2xs">
              <button
                onClick={() => setFilterPassed("all")}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs transition-colors font-medium flex items-center gap-1",
                  filterPassed === "all"
                    ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                )}
              >
                <span>全部</span>
                <span className="text-[10px] opacity-75 font-mono">({totalAllCount})</span>
              </button>
              <button
                onClick={() => setFilterPassed("unread")}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs transition-colors font-medium flex items-center gap-1",
                  filterPassed === "unread"
                    ? "bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 shadow-2xs font-bold"
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
                  "px-2.5 py-1 rounded-lg text-xs transition-colors font-medium flex items-center gap-1",
                  filterPassed === "blocked"
                    ? "bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-300 shadow-2xs font-bold"
                    : "text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-slate-200"
                )}
              >
                <span>已拦截</span>
                <span className="text-[10px] opacity-75 font-mono">({totalBlockedCount})</span>
              </button>
              <button
                onClick={() => setFilterPassed("passed")}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs transition-colors font-medium flex items-center gap-1",
                  filterPassed === "passed"
                    ? "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 shadow-2xs font-bold"
                    : "text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-slate-200"
                )}
              >
                <span>已放行</span>
                <span className="text-[10px] opacity-75 font-mono">({totalPassedCount})</span>
              </button>
            </div>
          </div>
        </div>

        {/* Audit Table */}
        <div className="border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900/40 shadow-sm dark:shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left text-xs text-slate-700 dark:text-slate-300 min-w-[900px]">
              <thead className="bg-slate-50/80 dark:bg-slate-900/80 border-b border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                <tr>
                  <th className="py-2.5 px-3 w-12 text-center">
                    <Checkbox
                      size="sm"
                      isSelected={
                        paginatedEvents.length > 0 &&
                        paginatedEvents.every((e) => selectedEventIds.includes(e?.id ?? ""))
                      }
                      onValueChange={(checked) => {
                        const pageIds = paginatedEvents.map((ev) => ev?.id).filter(Boolean) as string[];
                        if (checked) {
                          setSelectedEventIds((prev) => Array.from(new Set([...prev, ...pageIds])));
                        } else {
                          const pageIdSet = new Set(pageIds);
                          setSelectedEventIds((prev) => prev.filter((id) => !pageIdSet.has(id)));
                        }
                      }}
                      aria-label="全选当前页可见的事件"
                      classNames={{
                        wrapper: "w-4 h-4 before:border-slate-300 group-data-[selected=true]:before:bg-violet-600",
                        base: "p-0"
                      }}
                    />
                  </th>
                  <th className="py-2.5 px-3 w-[100px]">门禁状态</th>
                  <th className="py-2.5 px-3 w-[125px]">仓库名称</th>
                  <th className="py-2.5 px-3 w-[165px]">提交者 / 分支</th>
                  <th className="py-2.5 px-2 w-[65px] text-center">文件</th>
                  <th className="py-2.5 px-4 min-w-[260px]">审查结论与致命缺陷</th>
                  <th className="py-2.5 px-3 w-[145px]">审计时间</th>
                  <th className="py-2.5 px-3 w-[160px] text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {paginatedEvents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-slate-400 dark:text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                          <Radio className="h-5 w-5" />
                        </div>
                        <p className="text-xs font-medium">
                          {filterPassed === "unread"
                            ? "暂无未读记录，所有提交已全部阅毕。"
                            : searchKeyword
                            ? "未找到匹配当前搜索条件的门禁审计记录。"
                            : "暂无符合条件的门禁提交记录。在任意接入项目中执行 git commit 将在此全量留痕。"}
                        </p>
                        {searchKeyword && (
                          <button
                            type="button"
                            onClick={() => setSearchKeyword("")}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                          >
                            清空搜索条件
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedEvents.map((ev) => {
                    const isExpanded = selectedEventId === ev?.id;
                    const isRead = readEventIds?.includes(ev?.id ?? "") ?? false;
                    const isHighlighted = highlightedEventId === ev?.id;
                    const isSelected = selectedEventIds.includes(ev?.id ?? "");

                    return (
                      <React.Fragment key={ev?.id || Math.random().toString()}>
                        <tr
                          id={`audit-event-${ev?.id}`}
                          className={cn(
                            "hover:bg-slate-50/90 dark:hover:bg-slate-800/50 transition-all cursor-pointer relative",
                            !ev?.passed && "bg-rose-50/25 dark:bg-rose-950/15",
                            !isRead && "bg-blue-50/25 dark:bg-blue-950/15 font-medium",
                            isHighlighted && "bg-blue-100/90 dark:bg-blue-950/80 shadow-xs",
                            isSelected && "bg-violet-50/70 dark:bg-violet-950/30"
                          )}
                          onClick={() => {
                            setSelectedEventId(isExpanded ? null : ev?.id ?? null);
                            if (!isRead && ev?.id) markEventAsRead(ev.id);
                          }}
                        >
                          <td
                            className="py-2.5 px-3 w-12 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Checkbox
                              size="sm"
                              isSelected={isSelected}
                              onValueChange={() => toggleEventSelection(ev?.id)}
                              aria-label="勾选此项以供 AI 对话提炼"
                              classNames={{
                                wrapper: "w-4 h-4 before:border-slate-300 group-data-[selected=true]:before:bg-violet-600",
                                base: "p-0"
                              }}
                            />
                          </td>

                          <td
                            className={cn(
                              "py-2.5 px-3 whitespace-nowrap transition-all align-middle",
                              isHighlighted && "border-l-4 border-l-blue-600 dark:border-l-cyan-400 pl-2"
                            )}
                          >
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {ev?.passed ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 shadow-2xs">
                                  <ShieldCheck className="h-3 w-3 text-emerald-500" />
                                  <span>放行</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/80 shadow-2xs">
                                  <ShieldAlert className="h-3 w-3 text-rose-500" />
                                  <span>拦截</span>
                                </span>
                              )}

                              {isHighlighted && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 px-2 py-0.5 rounded-full shadow-2xs animate-bounce" title="当前已定位消息">
                                  <Target className="h-2.5 w-2.5" />
                                  目标
                                </span>
                              )}

                              {!isRead ? (
                                <span
                                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 dark:text-cyan-300 bg-blue-50 dark:bg-cyan-500/15 border border-blue-200 dark:border-cyan-500/30 px-1.5 py-0.5 rounded-full"
                                  title="未读记录"
                                >
                                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500 dark:bg-cyan-400 animate-ping" />
                                  未读
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                                  已读
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-2.5 px-3 font-mono font-medium text-slate-700 dark:text-slate-300 align-middle">
                            <div className="flex items-center gap-1 max-w-[120px]" title={`仓库: ${ev?.project_id ?? ""}`}>
                              <FolderGit2 className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                              <span className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">
                                {ev?.project_id}
                              </span>
                            </div>
                          </td>

                          <td className="py-2.5 px-3 align-middle">
                            <div className="flex items-center gap-1 text-slate-900 dark:text-slate-200">
                              <User className="h-3 w-3 text-slate-400 dark:text-slate-500 shrink-0" />
                              <span className="truncate font-semibold text-xs">{ev?.committer}</span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                              <GitBranch className="h-2.5 w-2.5 text-slate-400 shrink-0" />
                              <span className="truncate max-w-[125px]">{ev?.branch}</span>
                            </div>
                          </td>

                          <td className="py-2.5 px-2 text-slate-600 dark:text-slate-400 font-mono align-middle text-center">
                            <span className="inline-flex items-center justify-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px] font-medium">
                              <FileCode className="h-3 w-3 text-slate-400" />
                              {ev?.files_count ?? 0}
                            </span>
                          </td>

                          <td className="py-2.5 px-4 align-top">
                            <div
                              className={cn(
                                "text-xs text-slate-800 dark:text-slate-200 line-clamp-2 leading-relaxed",
                                !isRead ? "font-semibold" : "font-normal"
                              )}
                              title={ev?.summary}
                            >
                              {ev?.summary}
                            </div>
                            {(ev?.critical_issues ?? []).length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {(ev.critical_issues ?? []).slice(0, 3).map((iss, i) => (
                                  <span
                                    key={i}
                                    className="inline-flex items-center gap-1 text-[11px] text-rose-700 dark:text-rose-300 bg-rose-50/90 dark:bg-rose-950/50 border border-rose-200/80 dark:border-rose-900/60 rounded-md px-2 py-0.5 font-mono max-w-full truncate shadow-2xs"
                                    title={iss}
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                                    <span className="truncate">{iss}</span>
                                  </span>
                                ))}
                                {(ev.critical_issues ?? []).length > 3 && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedEventId(ev?.id ?? null);
                                      if (!isRead && ev?.id) markEventAsRead(ev.id);
                                    }}
                                    className="inline-flex items-center text-[10px] text-violet-600 dark:text-violet-400 hover:underline font-mono px-1 self-center cursor-pointer"
                                  >
                                    +{(ev.critical_issues ?? []).length - 3} 项更多
                                  </button>
                                )}
                              </div>
                            )}
                          </td>

                          <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 dark:text-slate-400 align-middle">
                            <div className="font-mono text-[11px] text-slate-700 dark:text-slate-300 font-medium leading-tight">
                              {formatTime(ev?.created_at)}
                            </div>
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-1 flex items-center gap-1">
                              <Clock className="h-2.5 w-2.5 text-slate-400 shrink-0" />
                              <span>{formatRelativeTime(ev?.created_at)}</span>
                            </div>
                          </td>

                          <td
                            className="py-2.5 px-3 text-right whitespace-nowrap align-middle"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-end gap-1.5">
                              {/* 1-Click AI Skill Drawer Trigger */}
                              <button
                                onClick={() => {
                                  if (ev?.id) {
                                    setSelectedEventIds([ev.id]);
                                    if (!isRead) markEventAsRead(ev.id);
                                    setIsAuditChatModalOpen(true);
                                  }
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/60 hover:bg-violet-100 dark:hover:bg-violet-900/80 border border-violet-200/80 dark:border-violet-800/80 transition-all shadow-2xs hover:shadow-xs cursor-pointer shrink-0"
                                title="以此拦截记录为上下文，一键拉起 AI 对话 Skill 生成器抽屉"
                              >
                                <Sparkles className="h-3 w-3 text-violet-500" />
                                <span>提炼 Skill</span>
                              </button>

                              {/* Mark Read/Unread Toggle */}
                              <button
                                onClick={() => {
                                  if (ev?.id) toggleEventRead(ev.id);
                                }}
                                className={cn(
                                  "p-1.5 rounded-lg text-xs transition-colors cursor-pointer",
                                  isRead
                                    ? "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                                    : "text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 bg-blue-50/70 dark:bg-blue-950/40 hover:bg-blue-100"
                                )}
                                title={isRead ? "标为未读" : "标为已读"}
                              >
                                {isRead ? <Mail className="h-3.5 w-3.5" /> : <MailOpen className="h-3.5 w-3.5" />}
                              </button>

                              {/* Expand details button */}
                              <button
                                onClick={() => {
                                  setSelectedEventId(isExpanded ? null : ev?.id ?? null);
                                  if (!isRead && ev?.id) markEventAsRead(ev.id);
                                }}
                                className="text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 text-xs font-medium px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              >
                                {isExpanded ? "收起" : "详情"}
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expanded Detail Row */}
                        {isExpanded && (
                          <tr className="bg-slate-50/80 dark:bg-slate-900/90">
                            <td colSpan={8} className="p-4 border-t border-slate-200/80 dark:border-slate-800">
                              <div className="space-y-3.5">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                    <Clock className="h-3.5 w-3.5 text-blue-500" />
                                    <span>门禁审查结论与缺陷诊断:</span>
                                  </div>
                                  <div className="text-[11px] text-slate-400 font-mono">
                                    记录 ID: {ev?.id} · 提交时间: {formatTime(ev?.created_at)} ({formatRelativeTime(ev?.created_at)})
                                  </div>
                                </div>
                                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800">
                                  {ev?.summary}
                                </p>

                                {(ev?.critical_issues ?? []).length > 0 && (
                                  <div className="p-3.5 rounded-xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60">
                                    <div className="text-xs font-bold text-rose-700 dark:text-rose-300 mb-2 flex items-center gap-1.5">
                                      <ShieldAlert className="h-4 w-4" />
                                      <span>阻断性致命缺陷 (Critical Issues - {(ev?.critical_issues ?? []).length} 项):</span>
                                    </div>
                                    <ul className="space-y-1.5">
                                      {(ev.critical_issues ?? []).map((iss, i) => (
                                        <li key={i} className="text-xs text-rose-800 dark:text-rose-200 font-mono flex items-start gap-1.5">
                                          <span className="text-rose-500 select-none">•</span>
                                          <span>{iss}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {(ev?.suggestions ?? []).length > 0 && (
                                  <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-cyan-950/20 border border-blue-200/80 dark:border-cyan-900/50">
                                    <div className="text-xs font-bold text-blue-700 dark:text-cyan-300 mb-2 flex items-center gap-1.5">
                                      <Sparkles className="h-4 w-4 text-cyan-500" />
                                      <span>AI 优化与重构建议 (Suggestions):</span>
                                    </div>
                                    <ul className="space-y-1.5">
                                      {(ev.suggestions ?? []).map((sug, i) => (
                                        <li key={i} className="text-xs text-blue-800 dark:text-cyan-200 font-mono flex items-start gap-1.5">
                                          <span className="text-cyan-500 select-none">•</span>
                                          <span>{sug}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {/* Action Toolbar inside Expanded Row */}
                                <div className="pt-2.5 flex items-center justify-between border-t border-slate-200/80 dark:border-slate-800 flex-wrap gap-2">
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                    <Sparkles className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
                                    <span>从本次拦截沉淀为团队工程规范与 IDE 智能体 Skill</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (ev) handleCopyEventIssues(ev);
                                      }}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs cursor-pointer"
                                      title="复制本次拦截诊断详情"
                                    >
                                      {copiedEventId === ev?.id ? (
                                        <>
                                          <Check className="h-3.5 w-3.5 text-emerald-500" />
                                          <span className="text-emerald-600 dark:text-emerald-400">已复制</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="h-3.5 w-3.5 text-slate-400" />
                                          <span>复制信息</span>
                                        </>
                                      )}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (ev?.id) {
                                          setSelectedEventIds([ev.id]);
                                          if (!isRead) markEventAsRead(ev.id);
                                          setIsAuditChatModalOpen(true);
                                        }
                                      }}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-2xs hover:shadow-xs transition-all cursor-pointer"
                                      title="以此记录打开 AI 对话 Skill 生成器抽屉"
                                    >
                                      <Sparkles className="h-3.5 w-3.5" />
                                      <span>AI 对话生成 Skill (抽屉)</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenRuleEvolution(ev);
                                      }}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 transition-colors cursor-pointer"
                                      title="一键提炼规则并转化为 .cursorrules / SKILL.md 与门禁卡点"
                                    >
                                      <Zap className="h-3.5 w-3.5 text-amber-500" />
                                      <span>💡 沉淀为规则与卡点</span>
                                    </button>
                                  </div>
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

          {/* Table Footer: Pagination & Record Summary */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2 flex-wrap">
              <span>
                显示第 <strong className="text-slate-700 dark:text-slate-200 font-mono">{filteredEvents.length > 0 ? startIndex + 1 : 0}</strong> - <strong className="text-slate-700 dark:text-slate-200 font-mono">{endIndex}</strong> 条，共 <strong className="text-slate-700 dark:text-slate-200 font-mono">{filteredEvents.length}</strong> 条流水
              </span>
              {selectedEventIds.length > 0 && (
                <span className="text-violet-600 dark:text-violet-400 font-semibold">
                  · 已勾选 {selectedEventIds.length} 项
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Page size selector */}
              <div className="flex items-center gap-1 text-xs">
                <span className="text-slate-400 mr-0.5">每页:</span>
                {[10, 20, 50].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => {
                      setPageSize(size);
                      setCurrentPage(1);
                    }}
                    className={cn(
                      "px-2 py-0.5 rounded-md text-xs font-mono transition-colors cursor-pointer",
                      pageSize === size
                        ? "bg-blue-600 text-white font-bold shadow-2xs"
                        : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                    )}
                  >
                    {size}
                  </button>
                ))}
              </div>

              {/* Prev / Next buttons */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safeCurrentPage <= 1}
                  className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  title="上一页"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="px-2 text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
                  {safeCurrentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safeCurrentPage >= totalPages}
                  className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  title="下一页"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Floating Batch Action Dock */}
        {selectedEventIds.length > 0 && (
          <div className="sticky bottom-4 z-30 mx-auto w-fit max-w-[95%] flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-slate-900/95 dark:bg-slate-800/95 text-white shadow-2xl backdrop-blur-md border border-slate-700/80 animate-in fade-in slide-in-from-bottom-3">
            <div className="flex items-center gap-2 pr-3 border-r border-slate-700 text-xs">
              <span className="flex h-2 w-2 rounded-full bg-violet-400 animate-ping" />
              <span className="font-semibold text-slate-200">
                已勾选 <span className="font-mono text-violet-300 font-bold">{selectedEventIds.length}</span> 条流水
              </span>
            </div>
            <button
              type="button"
              onClick={handleOpenAuditChat}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-500 hover:from-violet-600 hover:to-indigo-600 text-white shadow-lg shadow-violet-500/25 transition-all cursor-pointer"
              title="打开 AI 对话 Skill 生成器抽屉"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>AI 对话生成 Skill (抽屉)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                selectedEventIds.forEach((id) => markEventAsRead(id));
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
              title="将勾选项全部标为已读"
            >
              <CheckCheck className="h-3.5 w-3.5 text-blue-400" />
              <span>标为已读</span>
            </button>
            <button
              type="button"
              onClick={selectAllBlocked}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-rose-300 hover:text-rose-200 bg-rose-950/50 hover:bg-rose-900/60 border border-rose-800/60 rounded-xl transition-colors cursor-pointer"
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>全选拦截项</span>
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 transition-colors cursor-pointer"
            >
              取消
            </button>
          </div>
        )}
      </div>

      {/* === Commit人员质量风险排行 — 全员提交拦截与审计流水 (右侧伴生面板) === */}
      <CommitterLeaderboardPanel
        stats={committerStats}
        loading={committerLoading}
        onRefresh={() => fetchCommitterLeaderboard(30)}
        onPickCommitterEvents={async (committerName) => {
          try {
            const res = await fetch(
              `http://127.0.0.1:8000/api/audit/committers/${encodeURIComponent(committerName)}?days=30&limit=30`
            );
            if (res?.ok) {
              const events: ScanEventItem[] = await res.json();
              if (Array.isArray(events) && events.length > 0) {
                const blocked = events.filter((e) => e && !e.passed);
                setSelectedEventIds(blocked.map((e) => e.id));
                setIsAuditChatModalOpen(true);
              }
            }
          } catch (e) {
            console.warn("Failed to load committer events", e);
          }
        }}
      />

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

      {/* AI 对话 Skill 生成器 · 全员下发弹窗 */}
      <AuditChatSkillModal
        isOpen={isAuditChatModalOpen}
        onClose={() => setIsAuditChatModalOpen(false)}
        events={(safeEvents ?? []).filter((e) => selectedEventIds.includes(e?.id ?? ""))}
        projectIds={(safeProjects ?? []).map((p) => p.id).filter(Boolean)}
        defaultProjectIds={
          selectedProjectId && selectedProjectId !== "all"
            ? [selectedProjectId]
            : undefined
        }
        onDispatched={() => {
          // After successful dispatch, refresh events and projects so the new
          // skill card appears in the audit dashboard immediately.
          handleRefresh();
        }}
      />

      {/* Delete Project Confirmation Dialog */}
      {projectPendingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => !isDeletingProject && setProjectPendingDelete(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-rose-500/10 dark:bg-rose-500/20 border border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  确认移除项目「{projectPendingDelete.name || projectPendingDelete.id}」？
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                  项目标识: <code className="font-mono font-semibold text-slate-700 dark:text-slate-300">{projectPendingDelete.id}</code>
                  <br />
                  移除后，该项目将退出门禁质量治理矩阵（保留墓碑记录与历史审计流水，便于追溯）。
                </p>
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-2 leading-relaxed rounded-lg bg-amber-500/10 border border-amber-500/20 px-2.5 py-2">
                  ⚠️ 若该项目对应的本机仓库已安装 FlowDev 预提交钩子，请一并卸载，否则每次 commit 仍会触发门禁探针（现已自动放行、不再拦截）:
                  <br />
                  <code className="font-mono select-all">node scripts/uninstall-from.js &lt;仓库路径&gt;</code>
                  <br />
                  或在目标仓库执行 <code className="font-mono select-all">git config flowdev.enabled false</code>
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={isDeletingProject}
                onClick={() => setProjectPendingDelete(null)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                disabled={isDeletingProject}
                onClick={async () => {
                  if (!projectPendingDelete) return;
                  setIsDeletingProject(true);
                  try {
                    await deleteProject(projectPendingDelete.id);
                    setProjectPendingDelete(null);
                  } finally {
                    setIsDeletingProject(false);
                  }
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-semibold transition-all shadow-sm shadow-rose-500/20 cursor-pointer disabled:opacity-50"
              >
                {isDeletingProject ? "正在移除..." : "确认移除项目"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * CommitterLeaderboardPanel
 * ---------------------------------------------------------------------------
 * "全员提交拦截与审计流水" 的右侧伴生面板：按提交人聚合过去 30 天的门禁拦截情况，
 * 计算 risk_score 排序展示。点击任意提交人 → 自动选中他被拦截的提交 → 进入
 * AI 对话 Skill 生成器。该面板是 "全员提交拦截" 概念的具体化展示。
 */
function CommitterLeaderboardPanel({
  stats,
  loading,
  onRefresh,
  onPickCommitterEvents,
}: {
  stats: CommitterStat[];
  loading: boolean;
  onRefresh: () => void;
  onPickCommitterEvents: (committer: string) => void;
}) {
  const topN = stats.slice(0, 8);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-2">
            <Users className="h-4 w-4 text-violet-500" />
            提交人质量风险排行（全员拦截视角）
          </h2>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            近 30 天 · 按风险分排序
          </span>
        </div>
        <button
          onClick={onRefresh}
          className="text-[11px] text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-1"
          title="重新拉取提交人质量排行"
        >
          <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
          刷新
        </button>
      </div>

      <div className="border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900/40 shadow-sm dark:shadow-xl">
        {loading && stats.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin text-violet-500" />
            加载提交人拦截统计中...
          </div>
        ) : topN.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400">
            暂无提交人拦截数据。开发者首次 git commit 后将出现在这里。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50/80 dark:bg-slate-900/80 border-b border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                <tr>
                  <th className="py-2.5 px-3 w-10">#</th>
                  <th className="py-2.5 px-3">提交人</th>
                  <th className="py-2.5 px-3 text-center">提交 / 拦截</th>
                  <th className="py-2.5 px-3 text-center">通过率</th>
                  <th className="py-2.5 px-3 text-center">风险分</th>
                  <th className="py-2.5 px-3">最近问题</th>
                  <th className="py-2.5 px-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {topN.map((c, idx) => {
                  const risk = c.risk_score;
                  const riskColor =
                    risk >= 60
                      ? "bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-800"
                      : risk >= 40
                      ? "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800"
                      : risk >= 20
                      ? "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-800"
                      : "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800";
                  const medalIcon = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : null;
                  return (
                    <tr
                      key={c.committer}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-2.5 px-3 font-mono text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          {medalIcon && <span>{medalIcon}</span>}
                          <span>{idx + 1}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <User className="h-3 w-3 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[180px] font-medium text-slate-800 dark:text-slate-200">
                            {c.committer}
                          </span>
                        </div>
                        {c.top_projects?.[0] && (
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                            重点仓库: {c.top_projects[0].project_id}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono">
                        <span className="text-slate-700 dark:text-slate-300">
                          {c.total_commits}
                        </span>
                        <span className="text-slate-400 mx-1">/</span>
                        <span className={c.blocked_commits > 0 ? "text-rose-600 dark:text-rose-400 font-bold" : "text-slate-500"}>
                          {c.blocked_commits}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono">
                        <span
                          className={cn(
                            "px-1.5 py-0.5 rounded text-[11px] font-bold",
                            c.pass_rate >= 95
                              ? "text-emerald-600 dark:text-emerald-400"
                              : c.pass_rate >= 70
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-rose-600 dark:text-rose-400"
                          )}
                        >
                          {c.pass_rate}%
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={cn(
                            "inline-flex items-center justify-center min-w-[36px] px-1.5 py-0.5 rounded text-[11px] font-mono font-bold border",
                            riskColor
                          )}
                          title={`风险分 = 拦截率 50% + 拦截量 30% + 近 24h 拦截 20%`}
                        >
                          {risk.toFixed(1)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-[11px]">
                        {c.top_files && c.top_files.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {c.top_files.slice(0, 2).map((f) => (
                              <span
                                key={f.file}
                                className="px-1.5 py-0.5 rounded font-mono bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/40"
                                title={`在 ${f.count} 次拦截中出现`}
                              >
                                {f.file}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => onPickCommitterEvents(c.committer)}
                          disabled={c.blocked_commits === 0}
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-md transition-colors",
                            c.blocked_commits === 0
                              ? "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                              : "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-xs cursor-pointer"
                          )}
                          title={
                            c.blocked_commits === 0
                              ? "该提交人近期无拦截记录"
                              : `选中 ${c.committer} 的全部拦截事件, 进入 AI 对话提炼`
                          }
                        >
                          <Sparkles className="h-3 w-3" />
                          <span>AI 提炼</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

