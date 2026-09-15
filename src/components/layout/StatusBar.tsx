"use client";

import React from "react";
import {
  Radio,
  Cpu,
  FolderGit2,
  Layers,
  Sparkles,
  Eye,
  EyeOff,
} from "lucide-react";
import { useFlowStore } from "@/stores/useFlowStore";
import { cn } from "@/lib/utils";

interface StatusBarProps {
  showMiniMap?: boolean;
  onToggleMiniMap?: () => void;
}

export function StatusBar({ showMiniMap = true, onToggleMiniMap }: StatusBarProps) {
  const {
    nodes,
    edges,
    selectedProjectId,
    isExecuting,
    projects,
    activeViewMode,
  } = useFlowStore();

  const currentProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <footer className="h-7 w-full border-t border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-950/95 px-3 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 z-20 select-none shrink-0 backdrop-blur transition-colors duration-200">
      {/* Left: Backend & Engine Status */}
      <div className="flex items-center gap-3">
        {/* Backend health */}
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-mono text-slate-700 dark:text-slate-300">FastAPI :8000</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">就绪</span>
        </div>

        <span className="text-slate-300 dark:text-slate-700">|</span>

        {/* Engine */}
        <div className="hidden sm:flex items-center gap-1 text-slate-500 dark:text-slate-400">
          <Cpu className="h-3 w-3 text-blue-500 dark:text-blue-400" />
          <span className="font-mono">KahnScheduler v1.2</span>
        </div>

        <span className="hidden sm:inline text-slate-300 dark:text-slate-700">|</span>

        {/* Active Project */}
        <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-mono">
          <FolderGit2 className="h-3 w-3 text-cyan-600 dark:text-cyan-400" />
          <span>项目:</span>
          <span className="text-blue-600 dark:text-cyan-300 font-semibold">
            {selectedProjectId === "all" ? "全部仓库" : selectedProjectId}
          </span>
          {currentProject && (
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              ({currentProject.pass_rate}% 通过率)
            </span>
          )}
        </div>
      </div>

      {/* Center: Realtime Event Stream Status or Platform Mode */}
      <div className="hidden md:flex items-center gap-1.5 text-[11px]">
        {activeViewMode === "dashboard" ? (
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 dark:bg-cyan-400" />
            <span>研发效能控制台 · 企业质量门禁与全员提交审计中台</span>
          </div>
        ) : isExecuting ? (
          <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 animate-pulse font-medium">
            <Radio className="h-3 w-3 animate-spin" />
            <span>DAG 规则流水线实测推流中...</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <Radio className="h-3 w-3 text-emerald-500 dark:text-emerald-400" />
            <span>门禁策略编排器就绪 · 实时下发已开启</span>
          </div>
        )}
      </div>

      {/* Right: Mode-specific info */}
      <div className="flex items-center gap-3">
        {activeViewMode === "pipeline" ? (
          <>
            {/* Topology Stats */}
            <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 font-mono">
              <Layers className="h-3 w-3 text-slate-400 dark:text-slate-500" />
              <span>
                {nodes.length} 节点 · {edges.length} 连线
              </span>
            </div>

            <span className="text-slate-300 dark:text-slate-700">|</span>

            {/* Default LLM Model */}
            <div className="hidden lg:flex items-center gap-1 text-slate-500 dark:text-slate-400 font-mono text-[10px]">
              <Sparkles className="h-3 w-3 text-purple-500 dark:text-purple-400" />
              <span>DeepSeek-V4 Flash</span>
            </div>

            {onToggleMiniMap && (
              <>
                <span className="hidden lg:inline text-slate-300 dark:text-slate-700">|</span>
                <button
                  onClick={onToggleMiniMap}
                  className={cn(
                    "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition-colors",
                    showMiniMap
                      ? "text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800/80"
                      : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  )}
                  title={showMiniMap ? "隐藏小地图" : "显示小地图"}
                >
                  {showMiniMap ? (
                    <>
                      <Eye className="h-3 w-3" />
                      <span>小地图</span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="h-3 w-3" />
                      <span>小地图 (已隐藏)</span>
                    </>
                  )}
                </button>
              </>
            )}
          </>
        ) : (
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-mono text-[10px]">
            <span className="text-slate-800 dark:text-slate-300 font-semibold">{projects.length}</span>
            <span>个活跃项目仓库</span>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">探针守护中</span>
          </div>
        )}
      </div>
    </footer>
  );
}
