"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Workflow,
  Play,
  RotateCcw,
  PanelLeft,
  PanelRight,
  GitBranch,
  GitGraph,
  GitCompare,
  Loader2,
  LayoutTemplate,
  ChevronDown,
  Check,
} from "lucide-react";
import { useFlowStore } from "@/stores/useFlowStore";
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
  } = useFlowStore();

  const [isPresetMenuOpen, setIsPresetMenuOpen] = useState(false);
  const presetMenuRef = useRef<HTMLDivElement>(null);

  // Close preset menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        presetMenuRef.current &&
        !presetMenuRef.current.contains(e.target as Node)
      ) {
        setIsPresetMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectPreset = (presetId: PresetId) => {
    loadPreset(presetId);
    setIsPresetMenuOpen(false);
  };

  return (
    <header className="h-14 w-full border-b border-slate-800 bg-slate-950/90 px-4 flex items-center justify-between backdrop-blur z-20 select-none">
      {/* Brand & Left Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => toggleSidebar()}
          className={cn(
            "p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-900 transition-colors",
            isSidebarOpen && "bg-slate-900 text-slate-100"
          )}
          title="切换左侧算子库"
        >
          <PanelLeft className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Workflow className="h-4 w-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-100 tracking-tight">
                FlowDev-AI
              </span>
              <span className="rounded-full bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-[10px] font-medium text-blue-400">
                Milestone 5
              </span>
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
              <GitBranch className="h-3 w-3 inline text-slate-500" />
              main: monaco-diff-active
            </p>
          </div>
        </div>
      </div>

      {/* Center Status */}
      <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-xs text-slate-300">
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            isExecuting
              ? "bg-blue-400 animate-ping"
              : "bg-emerald-500 animate-pulse"
          )}
        />
        <span>
          {isExecuting
            ? "SSE 调度管道: 流式执行中..."
            : "DAG 拓扑调度引擎: 就绪"}
        </span>
        <span className="text-slate-600">|</span>
        <span className="text-slate-400">FastAPI :8000 连接正常</span>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2">
        {/* Preset Workflow Templates Dropdown */}
        <div className="relative" ref={presetMenuRef}>
          <button
            onClick={() => setIsPresetMenuOpen(!isPresetMenuOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors"
            title="选择预设工作流模版"
          >
            <LayoutTemplate className="h-3.5 w-3.5 text-blue-400" />
            <span>载入模版</span>
            <ChevronDown className="h-3 w-3 text-slate-500" />
          </button>

          {isPresetMenuOpen && (
            <div className="absolute left-0 mt-1.5 w-64 rounded-xl border border-slate-800 bg-slate-950/95 shadow-2xl p-1.5 z-50 backdrop-blur animate-in fade-in zoom-in-95 duration-100">
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
                          ? "bg-blue-600/15 border border-blue-500/30 text-blue-300"
                          : "hover:bg-slate-900 text-slate-300"
                      )}
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-slate-200 truncate">
                          {preset.name}
                        </div>
                        <div className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                          {preset.description}
                        </div>
                      </div>
                      {isActive && (
                        <Check className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* View Code Diff Modal Button */}
        <button
          onClick={() => setDiffModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-cyan-300 hover:text-white bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-lg transition-colors"
          title="打开 Monaco 双向 Diff 比对与成果导出"
        >
          <GitCompare className="h-3.5 w-3.5 text-cyan-400" />
          <span>代码 Diff 对比</span>
        </button>

        {/* View Topology Button */}
        <button
          onClick={() => setTopologyModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-300 hover:text-white bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-lg transition-colors"
          title="查看工作流拓扑结构与 LangGraph JSON 依赖"
        >
          <GitGraph className="h-3.5 w-3.5 text-indigo-400" />
          <span className="hidden xl:inline">拓扑配置</span>
        </button>

        {/* Clear Button */}
        <button
          onClick={() => clearCanvas()}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
          title="清空画布"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">清空</span>
        </button>

        {/* Run Workflow Button */}
        <button
          onClick={() => executeWorkflow()}
          disabled={isExecuting}
          className={cn(
            "flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white rounded-lg shadow-lg transition-all active:scale-95",
            isExecuting
              ? "bg-blue-800/80 cursor-wait opacity-90"
              : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-600/20"
          )}
        >
          {isExecuting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>执行中...</span>
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>执行流程</span>
            </>
          )}
        </button>

        {/* Toggle Property Drawer Button */}
        <button
          onClick={() => toggleDrawer()}
          className={cn(
            "p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-900 transition-colors ml-1",
            isDrawerOpen && "bg-slate-900 text-slate-100"
          )}
          title="切换属性抽屉"
        >
          <PanelRight className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
