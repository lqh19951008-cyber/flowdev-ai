"use client";

import React, { memo } from "react";
import { NodeProps } from "@xyflow/react";
import { TestTube2, Target, CheckSquare, ShieldCheck } from "lucide-react";
import { CustomNode, TestGeneratorConfig } from "@/types/flow";
import { BaseNodeCard } from "./BaseNodeCard";

export const TestGeneratorNode = memo(({ id, data, selected }: NodeProps<CustomNode>) => {
  const nodeData = data || ({} as any);
  const config = (nodeData.config || {}) as Partial<TestGeneratorConfig>;
  const framework = config.framework || "unittest";
  const targetCoverage = config.targetCoverage ?? 80;
  const mockMode = config.mockMode ?? true;
  const enforceTests = config.enforceTests ?? true;
  const sandboxTimeout = config.sandboxTimeoutSec ?? 5;

  return (
    <BaseNodeCard
      id={id}
      selected={selected}
      title={nodeData.label || "自动化单测覆盖率卡点 (Tests)"}
      typeBadge="COVERAGE_GATE"
      status={nodeData.status || "idle"}
      icon={TestTube2}
      iconColor="text-emerald-400"
      iconBg="bg-emerald-500/15 border-emerald-500/30"
      hasTargetHandle={true}
      hasSourceHandle={true}
    >
      <div className="flex items-center justify-between text-[11px] font-mono">
        <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-bold uppercase text-[10px]">
          {framework}
        </span>
        <span className="flex items-center gap-1 text-[10px] text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 font-medium">
          <ShieldCheck className="h-3 w-3 text-emerald-400" />
          {enforceTests ? "强制单测卡点" : "非强制监控"}
        </span>
      </div>

      {/* Coverage Progress Bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] text-slate-300">
          <span className="flex items-center gap-1">
            <Target className="h-3 w-3 text-emerald-400" />
            目标覆盖率红线
          </span>
          <span className="font-mono font-bold text-emerald-400">≥ {targetCoverage}%</span>
        </div>
        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-emerald-500 h-full rounded-full transition-all duration-300"
            style={{ width: `${targetCoverage}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] text-slate-400">
          <span className="flex items-center gap-1">
            <CheckSquare className="h-3 w-3 text-emerald-400" />
            {mockMode ? "依赖自动 Mock" : "无 Mock"}
          </span>
          <span className="font-mono text-slate-500">沙箱限时 {sandboxTimeout}s</span>
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
        <span className="text-emerald-400 font-medium">隔离沙箱验证</span>
        <span className="font-mono text-slate-500">覆盖率未达标强行拦截</span>
      </div>
    </BaseNodeCard>
  );
});

TestGeneratorNode.displayName = "TestGeneratorNode";

