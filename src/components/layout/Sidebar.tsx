"use client";

import React, { useState } from "react";
import {
  FileCode2,
  Sparkles,
  TestTube2,
  GitCompare,
  GripVertical,
  Plus,
  Layers,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useFlowStore, createDefaultNodeData } from "@/stores/useFlowStore";
import { FlowNodeType, NodePaletteItem } from "@/types/flow";
import { cn } from "@/lib/utils";

const PALETTE_ITEMS: NodePaletteItem[] = [
  {
    type: "code_input",
    label: "CodeInputNode",
    description: "源码输入：支持单文件或 Git PR 变更",
    category: "input",
    tag: "输入",
    iconName: "FileCode2",
  },
  {
    type: "llm_review",
    label: "LLMReviewNode",
    description: "代码评审：DeepSeek-V3 深度扫描异味与漏洞",
    category: "agent",
    tag: "审查",
    iconName: "Sparkles",
  },
  {
    type: "test_generator",
    label: "TestGeneratorNode",
    description: "单测生成：自动化生成 Jest / PyTest 单测",
    category: "agent",
    tag: "单测",
    iconName: "TestTube2",
  },
  {
    type: "diff_export",
    label: "DiffExportNode",
    description: "差异导出：生成 Unified Diff 补丁与报告",
    category: "output",
    tag: "产出",
    iconName: "GitCompare",
  },
];

const categoryTheme = {
  input: {
    icon: FileCode2,
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/25",
    tagColor: "text-amber-400 bg-amber-500/10",
  },
  agent: {
    icon: Sparkles,
    color: "text-purple-400",
    bg: "bg-purple-500/10 border-purple-500/25",
    tagColor: "text-purple-400 bg-purple-500/10",
  },
  output: {
    icon: GitCompare,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10 border-cyan-500/25",
    tagColor: "text-cyan-400 bg-cyan-500/10",
  },
};

export function Sidebar() {
  const { isSidebarOpen, toggleSidebar, addNode } = useFlowStore();
  const [draggedType, setDraggedType] = useState<FlowNodeType | null>(null);

  const onDragStart = (event: React.DragEvent, nodeType: FlowNodeType) => {
    setDraggedType(nodeType);
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  const onDragEnd = () => {
    setDraggedType(null);
  };

  const handleClickAdd = (type: FlowNodeType) => {
    const id = `node-${type}-${Date.now()}`;
    const newNode = {
      id,
      type,
      position: {
        x: 280 + Math.random() * 50,
        y: 180 + Math.random() * 50,
      },
      data: createDefaultNodeData(type),
    };
    addNode(newNode);
  };

  return (
    <aside
      className={cn(
        "relative h-[calc(100vh-3.5rem)] z-20 select-none border-r border-slate-800 bg-slate-950/95 backdrop-blur transition-all duration-300 ease-in-out flex flex-col shrink-0 overflow-hidden",
        isSidebarOpen ? "w-[220px]" : "w-12"
      )}
    >
      {/* Header & Fold Toggle */}
      <div
        className={cn(
          "h-11 border-b border-slate-800/80 bg-slate-900/40 flex items-center shrink-0 px-2.5",
          isSidebarOpen ? "justify-between" : "justify-center"
        )}
      >
        {isSidebarOpen ? (
          <>
            <div className="flex items-center gap-1.5 min-w-0">
              <Layers className="h-4 w-4 text-blue-400 shrink-0" />
              <span className="text-xs font-semibold text-slate-200 truncate">
                算子物料库
              </span>
            </div>
            <button
              onClick={() => toggleSidebar(false)}
              className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              title="折叠算子栏 (释放画布空间)"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <button
            onClick={() => toggleSidebar(true)}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
            title="展开算子库 (220px)"
          >
            <ChevronRight className="h-4 w-4 text-blue-400" />
          </button>
        )}
      </div>

      {/* Collapsed State: 48px Mini Icon Rail with Tooltip */}
      {!isSidebarOpen ? (
        <div className="flex-1 py-3 flex flex-col items-center gap-2.5 overflow-y-auto overflow-x-hidden">
          {PALETTE_ITEMS.map((item) => {
            const theme =
              item.type === "test_generator"
                ? {
                    icon: TestTube2,
                    color: "text-emerald-400",
                    bg: "bg-emerald-500/10 border-emerald-500/25",
                  }
                : categoryTheme[item.category];
            const Icon = theme.icon;

            return (
              <div
                key={item.type}
                draggable
                onDragStart={(e) => onDragStart(e, item.type)}
                onDragEnd={onDragEnd}
                onClick={() => handleClickAdd(item.type)}
                title={`${item.label} (拖拽或点击添加)`}
                className={cn(
                  "group relative h-9 w-9 flex items-center justify-center rounded-lg border border-slate-800/80 bg-slate-900/60 hover:bg-slate-800 hover:border-slate-700 cursor-grab active:cursor-grabbing transition-all duration-150 shadow-sm",
                  draggedType === item.type && "opacity-50 border-blue-500"
                )}
              >
                <Icon className={cn("h-4 w-4 transition-transform group-hover:scale-110", theme.color)} />

                {/* Floating Tooltip */}
                <div className="pointer-events-none absolute left-full ml-2 z-50 whitespace-nowrap rounded-md bg-slate-900 border border-slate-800 px-2 py-1 text-[11px] font-medium text-slate-200 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity">
                  {item.label}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Expanded State: 220px Compact Cards List */
        <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
          <div className="text-[10px] text-slate-500 px-1 font-mono flex items-center justify-between">
            <span>按住卡片拖入画布</span>
            <span>4 个可用</span>
          </div>

          {PALETTE_ITEMS.map((item) => {
            const theme =
              item.type === "test_generator"
                ? {
                    icon: TestTube2,
                    color: "text-emerald-400",
                    bg: "bg-emerald-500/10 border-emerald-500/25",
                    tagColor: "text-emerald-400 bg-emerald-500/10",
                  }
                : categoryTheme[item.category];
            const Icon = theme.icon;

            return (
              <div
                key={item.type}
                draggable
                onDragStart={(e) => onDragStart(e, item.type)}
                onDragEnd={onDragEnd}
                onClick={() => handleClickAdd(item.type)}
                className={cn(
                  "group relative p-2.5 rounded-lg border bg-slate-900/50 hover:bg-slate-900 border-slate-800/90 hover:border-slate-700 cursor-grab active:cursor-grabbing transition-all duration-150 shadow-sm",
                  draggedType === item.type && "opacity-50 border-blue-500"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-md border shrink-0",
                        theme.bg
                      )}
                    >
                      <Icon className={cn("h-3 w-3", theme.color)} />
                    </div>
                    <span className="text-xs font-semibold text-slate-200 truncate group-hover:text-blue-300">
                      {item.label}
                    </span>
                  </div>

                  <GripVertical className="h-3.5 w-3.5 text-slate-600 group-hover:text-slate-400 shrink-0" />
                </div>

                <p className="text-[10px] text-slate-400 leading-snug line-clamp-1">
                  {item.description}
                </p>

                <div className="mt-1.5 pt-1.5 border-t border-slate-800/60 flex items-center justify-between text-[10px]">
                  <span
                    className={cn(
                      "px-1.5 py-0.2 rounded font-medium",
                      theme.tagColor
                    )}
                  >
                    {item.tag}
                  </span>
                  <span className="text-slate-500 group-hover:text-slate-300 flex items-center gap-0.5">
                    <Plus className="h-2.5 w-2.5" /> 添加
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer info (only in expanded mode) */}
      {isSidebarOpen && (
        <div className="p-2 border-t border-slate-800/80 bg-slate-950/60 text-[10px] text-slate-500 flex items-center justify-between shrink-0">
          <span>拖拽或点击添加</span>
          <span className="font-mono text-slate-400">220px</span>
        </div>
      )}
    </aside>
  );
}
