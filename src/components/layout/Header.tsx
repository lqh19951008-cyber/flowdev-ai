"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Workflow,
  Play,
  RotateCcw,
  PanelLeft,
  PanelRight,
  GitGraph,
  GitCompare,
  Loader2,
  LayoutTemplate,
  ChevronDown,
  Check,
  FolderGit2,
  Bell,
  BarChart3,
  Save,
  CheckCircle2,
  Sliders,
  RefreshCw,
  Sun,
  Moon,
  Settings as SettingsIcon,
} from "lucide-react";
import { useFlowStore } from "@/stores/useFlowStore";
import { useTheme } from "@/components/providers/HeroUIProvider";
import { WORKFLOW_PRESETS } from "@/lib/presets";
import { PresetId } from "@/types/flow";
import { cn } from "@/lib/utils";



export function Header() {
  const {
    isSidebarOpen,
    isDrawerOpen,
    toggleSidebar,
    toggleDrawer,
    clearCanvas,
    setTopologyModalOpen,
    setDiffModalOpen,
    isExecuting,
    executeWorkflow,
    loadPreset,
    activePresetId,
    // Multi-tenant & Live Guard
    projects,
    selectedProjectId,
    setSelectedProjectId,
    unreadEventsCount,
    isLiveFeedOpen,
    setLiveFeedOpen,
    setProjectStatsModalOpen,
    saveCurrentPolicyToProject,
    fetchProjects,
    fetchRecentEvents,
    activeViewMode,
    setActiveViewMode,
    setSettingsModalOpen,
  } = useFlowStore();
  const { theme, toggleTheme } = useTheme();

  const [isPresetMenuOpen, setIsPresetMenuOpen] = useState(false);
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const [isPolicySaved, setIsPolicySaved] = useState(false);
  const [isSavingPolicy, setIsSavingPolicy] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);


  const presetMenuRef = useRef<HTMLDivElement>(null);
  const projectMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchProjects();
    (window as any).__setActiveViewMode = setActiveViewMode;
  }, [fetchProjects, setActiveViewMode]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        presetMenuRef.current &&
        !presetMenuRef.current.contains(e.target as Node)
      ) {
        setIsPresetMenuOpen(false);
      }
      if (
        projectMenuRef.current &&
        !projectMenuRef.current.contains(e.target as Node)
      ) {
        setIsProjectMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectPreset = (presetId: PresetId) => {
    loadPreset(presetId);
    setIsPresetMenuOpen(false);
  };

  const handleSavePolicyToProject = async () => {
    const targetProject =
      selectedProjectId === "all"
        ? projects[0]?.id || "rxjs"
        : selectedProjectId;
    setIsSavingPolicy(true);
    const ok = await saveCurrentPolicyToProject(targetProject);
    setIsSavingPolicy(false);
    if (ok) {
      setIsPolicySaved(true);
      setTimeout(() => setIsPolicySaved(false), 2500);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      fetchProjects(),
      fetchRecentEvents(selectedProjectId === "all" ? undefined : selectedProjectId),
    ]);
    setIsRefreshing(false);
  };

  return (
    <header className="h-12 w-full border-b border-slate-200/80 dark:border-slate-800/90 bg-white/90 dark:bg-slate-950/95 px-3 flex items-center justify-between z-40 relative select-none shrink-0 backdrop-blur transition-colors duration-200">
      {/* Left: Brand, Mode Switcher & Project Switcher */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Sidebar Toggle (Only relevant in pipeline mode) */}
        {/* {activeViewMode === "pipeline" && (
          <button
            onClick={() => toggleSidebar()}
            className={cn(
              "p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors shrink-0",
              isSidebarOpen && "bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700"
            )}
            title={isSidebarOpen ? "折叠算子库" : "展开算子库"}
          >
            <PanelLeft className="h-4 w-4" />
          </button>
        )} */}

        {/* Brand Logo & Name */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
            <Workflow className="h-4 w-4 text-white" />
          </div>
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="font-bold text-sm text-slate-900 dark:text-slate-100 tracking-tight">
              FlowDev-AI
            </span>
            <span className="rounded bg-blue-500/10 border border-blue-500/25 px-1.5 py-0.2 text-[10px] font-mono font-medium text-blue-600 dark:text-blue-400">
              v1.2
            </span>
          </div>
        </div>

        <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-0.5" />

        {/* Segmented View Switcher: 研发质量大盘 vs 门禁策略编排 */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 rounded-lg p-0.5 shrink-0">
          <button
            onClick={() => setActiveViewMode("dashboard")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-all whitespace-nowrap font-medium",
              activeViewMode === "dashboard"
                ? "bg-blue-600 text-white font-semibold shadow-sm shadow-blue-500/30"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            )}
            title="研发质量大盘与全员审计流水"
          >
            <BarChart3 className="h-3.5 w-3.5 shrink-0" />
            <span>质量大盘</span>
          </button>
          <button
            onClick={() => setActiveViewMode("pipeline")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-all whitespace-nowrap font-medium",
              activeViewMode === "pipeline"
                ? "bg-blue-600 text-white font-semibold shadow-sm shadow-blue-500/30"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            )}
            title="门禁策略编排与规则流水线"
          >
            <Sliders className="h-3.5 w-3.5 shrink-0" />
            <span>门禁编排</span>
          </button>
        </div>

        <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-0.5" />

        {/* Project Selector Dropdown */}
        <div className="relative shrink-0" ref={projectMenuRef}>
          <button
            onClick={() => setIsProjectMenuOpen(!isProjectMenuOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-900/90 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-lg transition-colors whitespace-nowrap"
            title="切换监控的代码仓库"
          >
            <FolderGit2 className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
            <span className="font-mono max-w-[130px] truncate">
              {activeViewMode === "pipeline"
                ? (selectedProjectId === "all" ? (projects[0]?.id || "rxjs") : selectedProjectId)
                : (selectedProjectId === "all" ? "全部项目" : selectedProjectId)}
            </span>
            <ChevronDown className="h-3 w-3 text-slate-400 shrink-0" />
          </button>

          {isProjectMenuOpen && (
            <div className="absolute left-0 mt-1.5 w-64 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/95 shadow-2xl p-1.5 z-50 backdrop-blur animate-in fade-in zoom-in-95 duration-100">
              <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                {activeViewMode === "pipeline" ? "切换编排目标仓库" : "选择监控项目仓库"}
              </div>
              <div className="space-y-1 mt-1">
                {activeViewMode === "dashboard" && (
                  <button
                    onClick={() => {
                      setSelectedProjectId("all");
                      setIsProjectMenuOpen(false);
                    }}
                    className={cn(
                      "w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between text-xs transition-colors",
                      selectedProjectId === "all"
                        ? "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 font-medium"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900"
                    )}
                  >
                    <span>全部项目 (全局监控)</span>
                    {selectedProjectId === "all" && (
                      <Check className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                    )}
                  </button>
                )}
                {projects.map((proj) => {
                  const isCur = selectedProjectId === proj.id;
                  return (
                    <button
                      key={proj.id}
                      onClick={() => {
                        setSelectedProjectId(proj.id);
                        setIsProjectMenuOpen(false);
                      }}
                      className={cn(
                        "w-full text-left px-2.5 py-2 rounded-lg flex items-start justify-between text-xs transition-colors",
                        isCur
                          ? "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 font-medium"
                          : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900"
                      )}
                    >
                      <div className="min-w-0">
                        <div className="font-mono text-slate-800 dark:text-slate-100 font-semibold truncate">
                          {proj.id}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">
                          {proj.name}
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                          {proj.pass_rate}%
                        </span>
                        {isCur && (
                          <Check className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400 mt-0.5" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Center: Execution Indicator (only shows when running in pipeline mode) */}
      <div className="hidden md:flex items-center justify-center">
        {activeViewMode === "pipeline" && isExecuting && (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-500/40 text-xs text-blue-700 dark:text-blue-300 animate-pulse whitespace-nowrap">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600 dark:text-blue-400" />
            <span>Kahn DAG 管道流式执行中...</span>
          </div>
        )}
      </div>

      {/* Right: Actions & Controls */}
      {activeViewMode === "dashboard" ? (
        <div className="flex items-center gap-2 shrink-0">
          {/* Refresh Data */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            title="刷新质量统计与全员审计流水"
          >
            <RefreshCw
              className={cn(
                "h-3.5 w-3.5 text-slate-500 dark:text-slate-400 shrink-0",
                isRefreshing && "animate-spin text-blue-500"
              )}
            />
            <span>刷新</span>
          </button>

          {/* Live Guard Notification Bell */}
          <button
            onClick={() => setLiveFeedOpen(!isLiveFeedOpen)}
            className={cn(
              "relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors shrink-0",
              isLiveFeedOpen
                ? "bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-900 bg-slate-100 dark:bg-slate-900"
            )}
            title="实时 Git 提交门禁动态"
          >
            <div className="relative">
              <Bell className="h-3.5 w-3.5" />
              {unreadEventsCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-950 animate-pulse" />
              )}
            </div>
            <span>动态</span>
            {unreadEventsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-[10px] font-bold text-white">
                {unreadEventsCount > 9 ? "9+" : unreadEventsCount}
              </span>
            )}
          </button>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-0.5" />

          {/* System Settings Button (LLM API & Feishu) */}
          <button
            onClick={() => setSettingsModalOpen(true, "llm")}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            title="配置 AI 大模型 API Key / Base URL 与飞书群机器人 Webhook"
          >
            <SettingsIcon className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
            <span>系统配置</span>
          </button>

          {/* Theme Toggle Button (Light / Dark) */}
          <button
            onClick={toggleTheme}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            title={theme === "dark" ? "切换至浅色模式" : "切换至深色模式"}
          >
            {theme === "dark" ? (
              <>
                <Sun className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <span className="hidden sm:inline">浅色</span>
              </>
            ) : (
              <>
                <Moon className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                <span className="hidden sm:inline">深色</span>
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Preset Workflow Templates Dropdown */}
          <div className="relative shrink-0" ref={presetMenuRef}>
            <button
              onClick={() => setIsPresetMenuOpen(!isPresetMenuOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              title="载入官方预置门禁流水线模版"
            >
              <LayoutTemplate className="h-3.5 w-3.5 text-blue-500 shrink-0" />
              <span>载入模版</span>
              <ChevronDown className="h-3 w-3 text-slate-500 shrink-0" />
            </button>

            {isPresetMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-64 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 shadow-xl p-1.5 z-50 backdrop-blur animate-in fade-in zoom-in-95 duration-100">
                <div className="px-2 py-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  选择工作流模版
                </div>
                <div className="space-y-1 mt-1">
                  {WORKFLOW_PRESETS.map((preset) => {
                    const isActive = activePresetId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        onClick={() => handleSelectPreset(preset.id)}
                        className={cn(
                          "w-full text-left px-2.5 py-2 rounded-lg flex items-start justify-between gap-2 text-xs transition-colors",
                          isActive
                            ? "bg-blue-50 dark:bg-blue-600/15 border border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-300"
                            : "hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300"
                        )}
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-slate-800 dark:text-slate-200 truncate">
                            {preset.name}
                          </div>
                          <div className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                            {preset.description}
                          </div>
                        </div>
                        {isActive && (
                          <Check className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Clear Canvas Button */}
          <button
            onClick={() => clearCanvas()}
            className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors whitespace-nowrap shrink-0"
            title="清空画布"
          >
            <RotateCcw className="h-3.5 w-3.5 shrink-0" />
            <span>清空</span>
          </button>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-0.5" />

          {/* Run Workflow (Primary Action) */}
          <button
            onClick={() => executeWorkflow()}
            disabled={isExecuting}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg shadow-md transition-all active:scale-95 whitespace-nowrap shrink-0",
              isExecuting
                ? "bg-blue-800/80 cursor-wait opacity-90"
                : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/20"
            )}
            title="运行策略流水线，仿真验证缺陷拦截力"
          >
            {isExecuting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                <span>实测中...</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-current shrink-0" />
                <span>策略实测</span>
              </>
            )}
          </button>

          {/* Save Policy to Project Button */}
          <button
            onClick={handleSavePolicyToProject}
            disabled={isSavingPolicy}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all whitespace-nowrap shrink-0",
              isPolicySaved
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 font-semibold"
                : "bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white"
            )}
            title={`将当前画布 DAG 策略保存下发至 ${
              selectedProjectId === "all" ? "rxjs" : selectedProjectId
            }`}
          >
            {isPolicySaved ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>已下发</span>
              </>
            ) : isSavingPolicy ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500 shrink-0" />
                <span>同步中...</span>
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                <span>下发策略</span>
              </>
            )}
          </button>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-0.5" />

          {/* View Code Diff Modal Button */}
          <button
            onClick={() => setDiffModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            title="打开 Monaco 双向 Diff 比对与修复成果导出"
          >
            <GitCompare className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
            <span>代码 Diff</span>
          </button>

          {/* View Topology JSON Button */}
          <button
            onClick={() => setTopologyModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            title="查看工作流拓扑结构与 LangGraph JSON 依赖"
          >
            <GitGraph className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
            <span>拓扑查看</span>
          </button>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-0.5" />

          {/* System Settings Button */}
          <button
            onClick={() => setSettingsModalOpen(true, "llm")}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            title="配置 AI 大模型 API Key / Base URL 与飞书群机器人 Webhook"
          >
            <SettingsIcon className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
            <span>系统配置</span>
          </button>

          {/* Theme Toggle Button (Light / Dark) */}
          <button
            onClick={toggleTheme}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            title={theme === "dark" ? "切换至浅色模式" : "切换至深色模式"}
          >
            {theme === "dark" ? (
              <Sun className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            ) : (
              <Moon className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
            )}
          </button>

          {/* Toggle Property Drawer Button */}
          <button
            onClick={() => toggleDrawer()}
            className={cn(
              "p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors shrink-0",
              isDrawerOpen && "bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700"
            )}
            title="展开/收起属性抽屉"
          >
            <PanelRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </header>
  );
}


