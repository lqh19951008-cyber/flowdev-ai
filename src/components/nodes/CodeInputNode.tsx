"use client";

import React, { memo } from "react";
import { NodeProps } from "@xyflow/react";
import { FileCode2, Terminal, GitBranch } from "lucide-react";
import { CustomNode, CodeInputConfig } from "@/types/flow";
import { BaseNodeCard } from "./BaseNodeCard";

export const CodeInputNode = memo(({ id, data, selected }: NodeProps<CustomNode>) => {
  const config = (data.config || {}) as Partial<CodeInputConfig>;
  const language = config.language || "typescript";
  const sourceType = config.sourceType || "snippet";
  const sampleCode = config.sampleCode || "";
  const lineCount = sampleCode ? sampleCode.split("\n").length : 24;

  return (
    <BaseNodeCard
      id={id}
      selected={selected}
      title={data.label || "源码输入 (Input)"}
      typeBadge="INPUT_SOURCE"
      status={data.status}
      icon={FileCode2}
      iconColor="text-amber-400"
      iconBg="bg-amber-500/15 border-amber-500/30"
      hasTargetHandle={false}
      hasSourceHandle={true}
    >
      <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/25 text-amber-300 font-mono">
          {sourceType === "git" ? (
            <>
              <GitBranch className="h-3 w-3" /> Git 变更
            </>
          ) : (
            <>
              <Terminal className="h-3 w-3" /> 代码片段
            </>
          )}
        </span>
        <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700/60 text-slate-300 font-mono uppercase">
          {language}
        </span>
        <span className="text-[10px] text-slate-400 font-mono ml-auto">
          {lineCount} 行代码
        </span>
      </div>

      <p className="text-[11px] text-slate-400 line-clamp-1">
        {data.description || "接收待评审的代码上下文或 Git PR 变更"}
      </p>
    </BaseNodeCard>
  );
});

CodeInputNode.displayName = "CodeInputNode";
