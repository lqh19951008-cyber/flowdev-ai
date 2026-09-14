"use client";

import React, { memo } from "react";
import { NodeProps } from "@xyflow/react";
import { TestTube2, Target, CheckSquare } from "lucide-react";
import { CustomNode, TestGeneratorConfig } from "@/types/flow";
import { BaseNodeCard } from "./BaseNodeCard";

export const TestGeneratorNode = memo(({ id, data, selected }: NodeProps<CustomNode>) => {
  const config = (data.config || {}) as Partial<TestGeneratorConfig>;
  const framework = config.framework || "jest";
  const targetCoverage = config.targetCoverage ?? 85;
  const mockMode = config.mockMode ?? true;

  return (
    <BaseNodeCard
      id={id}
      selected={selected}
      title={data.label || "Jest 单测生成"}
      typeBadge="AGENT_NODE"
      status={data.status}
      icon={TestTube2}
      iconColor="text-emerald-400"
      iconBg="bg-emerald-500/15 border-emerald-500/30"
      hasTargetHandle={true}
      hasSourceHandle={true}
    >
      <div className="flex items-center justify-between text-[11px] font-mono">
        <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-bold uppercase">
          {framework}
        </span>
        <span className="flex items-center gap-1 text-slate-300">
          <Target className="h-3 w-3 text-emerald-400" />
          目标覆盖率: {targetCoverage}%
        </span>
      </div>

      {/* Coverage Progress Bar */}
      <div className="space-y-1">
        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-emerald-500 h-full rounded-full transition-all duration-300"
            style={{ width: `${targetCoverage}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] text-slate-400">
          <span className="flex items-center gap-1">
            <CheckSquare className="h-3 w-3 text-emerald-400" />
            {mockMode ? "自动依赖 Mock" : "无 Mock"}
          </span>
          <span>分支与边界全覆盖</span>
        </div>
      </div>
    </BaseNodeCard>
  );
});

TestGeneratorNode.displayName = "TestGeneratorNode";
