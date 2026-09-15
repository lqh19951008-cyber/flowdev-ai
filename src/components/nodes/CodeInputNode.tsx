"use client";

import React, { memo } from "react";
import { NodeProps } from "@xyflow/react";
import { FileCode2, GitCommit, Filter, FolderX } from "lucide-react";
import { CustomNode, CodeInputConfig } from "@/types/flow";
import { BaseNodeCard } from "./BaseNodeCard";

export const CodeInputNode = memo(({ id, data, selected }: NodeProps<CustomNode>) => {
  const nodeData = data || ({} as any);
  const config = (nodeData.config || {}) as Partial<CodeInputConfig>;
  const language = config.language || "typescript";
  const triggerEvent = config.triggerEvent || "pre-commit";
  const filePatterns = config.filePatterns && config.filePatterns.length > 0
    ? config.filePatterns.slice(0, 2).join(", ")
    : "**/*.ts, **/*.py";
  const ignoredDirs = config.ignoredDirs && config.ignoredDirs.length > 0
    ? config.ignoredDirs.slice(0, 2).join(", ")
    : "node_modules, dist";

  return (
    <BaseNodeCard
      id={id}
      selected={selected}
      title={nodeData.label || "门禁触发与范围 (Scope)"}
      typeBadge="TRIGGER_SCOPE"
      status={nodeData.status || "idle"}
      icon={FileCode2}
      iconColor="text-amber-500 dark:text-amber-400"
      iconBg="bg-amber-500/15 border-amber-500/30"
      hasTargetHandle={false}
      hasSourceHandle={true}
    >
      <div className="flex items-center justify-between text-[11px] font-mono">
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-300 font-semibold">
          <GitCommit className="h-3 w-3" /> {triggerEvent}
        </span>
        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 font-mono uppercase text-[10px]">
          {language}
        </span>
      </div>

      <div className="space-y-1 text-[10px] font-mono">
        <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/60 px-2 py-1 rounded border border-slate-200/80 dark:border-slate-800/80">
          <Filter className="h-3 w-3 text-amber-500 dark:text-amber-400 shrink-0" />
          <span className="text-slate-500 dark:text-slate-400">匹配:</span>
          <span className="truncate text-slate-800 dark:text-slate-200 font-medium">{filePatterns}</span>
        </div>
        <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400 bg-slate-50/60 dark:bg-slate-950/40 px-2 py-0.5 rounded border border-slate-200/60 dark:border-slate-800/60">
          <FolderX className="h-3 w-3 text-slate-400 dark:text-slate-500 shrink-0" />
          <span className="text-slate-500">排除:</span>
          <span className="truncate text-slate-600 dark:text-slate-400">{ignoredDirs}</span>
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 pt-0.5">
        <span className="text-amber-600 dark:text-amber-400 font-medium">⚡ 提交时毫秒级拦截</span>
        <span className="font-mono text-slate-400 dark:text-slate-500">内置仿真测试样本</span>
      </div>
    </BaseNodeCard>
  );
});

CodeInputNode.displayName = "CodeInputNode";
