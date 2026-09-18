"use client";

import React, { useState } from "react";
import {
  FileCode2,
  Sparkles,
  TestTube2,
  GitCompare,
  GripVertical,
  Layers,
  ChevronLeft,
  ChevronRight,
  Move,
  Info,
  FolderGit2,
} from "lucide-react";
import { Chip } from "@heroui/react";
import { useFlowStore } from "@/stores/useFlowStore";
import { FlowNodeType, NodePaletteItem } from "@/types/flow";
import { cn } from "@/lib/utils";

const PALETTE_ITEMS: NodePaletteItem[] = [
  {
    type: "code_input",
    label: "门禁触发与范围 (Scope)",
    description: "捕获 pre-commit/PR，匹配 Glob 路径过滤变更文件",
    category: "input",
    tag: "触发范围",
    iconName: "FileCode2",
  },
  {
    type: "llm_review",
    label: "代码安全与漏洞阻断 (Security)",
    description: "DeepSeek 语义扫描，阻断空指针/SQL注入/秘钥泄露",
    category: "agent",
    tag: "安全阻断",
    iconName: "Sparkles",
  },
  {
    type: "test_generator",
    label: "单测覆盖率红线卡点 (Coverage)",
    description: "执行自动化单测验证，覆盖率需 ≥80% 红线",
    category: "agent",
    tag: "单测卡点",
    iconName: "TestTube2",
  },
  {
    type: "diff_export",
    label: "门禁裁决与阻断决策 (Enforce)",
    description: "评估裁决：Exit 1 强行阻断提交 / 告警推送 / 补丁修复",
    category: "output",
    tag: "阻断裁决",
    iconName: "GitCompare",
  },
];

const ITEM_THEMES: Record<
  FlowNodeType,
  {
    icon: React.ElementType;
    iconColor: string;
    iconBg: string;
    chipColor: "warning" | "secondary" | "success" | "primary";
    borderHover: string;
  }
> = {
  code_input: {
    icon: FileCode2,
    iconColor: "text-amber-500 dark:text-amber-400",
    iconBg: "bg-amber-500/10 border-amber-500/20",
    chipColor: "warning",
    borderHover: "hover:border-amber-400/80 dark:hover:border-amber-500/60",
  },
  llm_review: {
    icon: Sparkles,
    iconColor: "text-purple-500 dark:text-purple-400",
    iconBg: "bg-purple-500/10 border-purple-500/20",
    chipColor: "secondary",
    borderHover: "hover:border-purple-400/80 dark:hover:border-purple-500/60",
  },
  test_generator: {
    icon: TestTube2,
    iconColor: "text-emerald-500 dark:text-emerald-400",
    iconBg: "bg-emerald-500/10 border-emerald-500/20",
    chipColor: "success",
    borderHover: "hover:border-emerald-400/80 dark:hover:border-emerald-500/60",
  },
  diff_export: {
    icon: GitCompare,
    iconColor: "text-blue-500 dark:text-blue-400",
    iconBg: "bg-blue-500/10 border-blue-500/20",
    chipColor: "primary",
    borderHover: "hover:border-blue-400/80 dark:hover:border-blue-500/60",
  },
};

export function Sidebar() {
  const { isSidebarOpen, toggleSidebar, projects, selectedProjectId, setSelectedProjectId } = useFlowStore();

  const onDragStart = (event: React.DragEvent, nodeType: FlowNodeType) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.setData("text/plain", nodeType);
    event.dataTransfer.setData("text", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  const currentProj =
    (projects ?? []).find((p) => p.id === (selectedProjectId === "all" ? (projects?.[0]?.id ?? "rxjs") : selectedProjectId)) ??
    projects?.[0];

  return (
    <aside
      className={cn(
        "relative h-full z-20 select-none border-r border-slate-200/90 dark:border-slate-800/90 bg-white/95 dark:bg-[#0d131f]/95 backdrop-blur-md transition-all duration-300 ease-in-out flex flex-col shrink-0 overflow-hidden",
        isSidebarOpen ? "w-[240px]" : "w-12"
      )}
    >
      {/* Header & Fold Toggle */}
      <div
        className={cn(
          "h-14 border-b border-slate-200/90 dark:border-slate-800/90 bg-slate-50/70 dark:bg-slate-900/60 flex items-center shrink-0 px-3",
          isSidebarOpen ? "justify-between" : "justify-center"
        )}
      >
        {isSidebarOpen ? (
          <>
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-7 w-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Layers className="h-4 w-4" />
              </div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                算子物料库
              </span>
              <Chip
                size="sm"
                variant="flat"
                color="primary"
                className="h-4 px-1.5 text-[9px] font-mono"
              >
                4
              </Chip>
            </div>
            <button
              onClick={() => toggleSidebar(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="折叠算子栏"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </>
        ) : (
          <button
            onClick={() => toggleSidebar(true)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="展开算子物料库"
          >
            <ChevronRight className="h-4 w-4 text-blue-500 dark:text-blue-400" />
          </button>
        )}
      </div>

      {/* Collapsed State: Mini Icon Rail */}
      {!isSidebarOpen ? (
        <div className="flex-1 py-3 flex flex-col items-center gap-2.5 overflow-y-auto overflow-x-hidden">
          {PALETTE_ITEMS.map((item) => {
            const theme = ITEM_THEMES[item.type];
            const Icon = theme.icon;

            return (
              <div
                key={item.type}
                draggable
                onDragStart={(e) => onDragStart(e, item.type)}
                title={`${item.label} (按住拖拽至画布)`}
                className={cn(
                  "group relative h-9 w-9 flex items-center justify-center rounded-xl border border-slate-200/90 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-900/60 hover:bg-white dark:hover:bg-slate-800 hover:border-blue-400/80 cursor-grab active:cursor-grabbing transition-all duration-150 shadow-xs"
                )}
              >
                <Icon className={cn("h-4 w-4 transition-transform group-hover:scale-110", theme.iconColor)} />

                {/* Floating Tooltip */}
                <div className="pointer-events-none absolute left-full ml-2.5 z-50 whitespace-nowrap rounded-xl bg-slate-900/95 border border-slate-800 px-2.5 py-1.5 text-[11px] font-semibold text-slate-100 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity">
                  {item.label}
                  <div className="text-[9px] text-slate-400 font-normal">按住拖拽至画布</div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Expanded State: Refined HeroUI Cards List (Drag Only) */
        <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
          {/* Target Project Selector Card */}
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between text-[11px] mb-1.5">
              <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
                <FolderGit2 className="h-3.5 w-3.5 text-blue-600 dark:text-cyan-400" />
                编排目标仓库
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                {currentProj?.pass_rate ?? 100}% 放行
              </span>
            </div>
            <select
              value={selectedProjectId === "all" ? (projects?.[0]?.id ?? "rxjs") : selectedProjectId}
              onChange={(e) => setSelectedProjectId?.(e.target.value)}
              className="w-full h-7 text-xs font-mono font-semibold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xs"
            >
              {(projects ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} ({p.name || p.id})
                </option>
              ))}
            </select>
          </div>

          <div className="text-[10px] text-slate-400 dark:text-slate-500 px-1 font-mono flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Move className="h-3 w-3" />
              拖拽算子放入右侧画布
            </span>
            <span>算子节点</span>
          </div>

          {PALETTE_ITEMS.map((item) => {
            const theme = ITEM_THEMES[item.type];
            const Icon = theme.icon;

            return (
              <div
                key={item.type}
                draggable
                onDragStart={(e) => onDragStart(e, item.type)}
                className={cn(
                  "group relative p-3 rounded-2xl border bg-white/80 dark:bg-slate-900/60 hover:bg-white dark:hover:bg-slate-900 border-slate-200/90 dark:border-slate-800/90 cursor-grab active:cursor-grabbing transition-all duration-200 shadow-xs hover:shadow-md select-none",
                  theme.borderHover
                )}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-xl border shrink-0 shadow-xs",
                        theme.iconBg
                      )}
                    >
                      <Icon className={cn("h-3.5 w-3.5", theme.iconColor)} />
                    </div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {item.label}
                    </span>
                  </div>

                  <GripVertical className="h-4 w-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400 shrink-0 transition-colors" />
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
                  {item.description}
                </p>

                <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/70 flex items-center justify-between">
                  <Chip
                    size="sm"
                    variant="flat"
                    color={theme.chipColor}
                    className="h-5 text-[10px] font-medium px-1.5"
                  >
                    {item.tag}
                  </Chip>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 flex items-center gap-1 font-medium transition-colors">
                    <Move className="h-2.5 w-2.5" />
                    按住拖入
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer Info (only in expanded mode) */}
      {isSidebarOpen && (
        <div className="p-2.5 border-t border-slate-200/90 dark:border-slate-800/90 bg-slate-50/70 dark:bg-slate-900/60 text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between shrink-0">
          <span className="flex items-center gap-1">
            <Info className="h-3 w-3 text-blue-500" />
            点击不添加 · 仅支持拖拽
          </span>
          <span className="font-mono text-slate-400">240px</span>
        </div>
      )}
    </aside>
  );
}
