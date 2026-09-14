"use client";

import React, { memo } from "react";
import { NodeProps } from "@xyflow/react";
import { Sparkles, Cpu, Thermometer } from "lucide-react";
import { CustomNode, LLMReviewConfig } from "@/types/flow";
import { BaseNodeCard } from "./BaseNodeCard";

const modelLabels: Record<string, string> = {
  "deepseek-v3": "DeepSeek-V3",
  "qwen-2.5-coder": "Qwen 2.5 Coder",
  "deepseek-r1": "DeepSeek-R1 (推理)",
};

export const LLMReviewNode = memo(({ id, data, selected }: NodeProps<CustomNode>) => {
  const config = (data.config || {}) as Partial<LLMReviewConfig>;
  const model = config.model || "deepseek-v3";
  const temperature = config.temperature ?? 0.2;
  const aspects = config.reviewAspects || ["代码异味", "安全漏洞", "类型健壮性"];

  return (
    <BaseNodeCard
      id={id}
      selected={selected}
      title={data.label || "代码规范与漏洞评审"}
      typeBadge="AGENT_NODE"
      status={data.status}
      icon={Sparkles}
      iconColor="text-purple-400"
      iconBg="bg-purple-500/15 border-purple-500/30"
      hasTargetHandle={true}
      hasSourceHandle={true}
    >
      <div className="flex items-center justify-between text-[11px] font-mono">
        <span className="flex items-center gap-1 text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
          <Cpu className="h-3 w-3" />
          {modelLabels[model] || model}
        </span>
        <span className="flex items-center gap-1 text-slate-400">
          <Thermometer className="h-3 w-3 text-slate-500" />
          {temperature.toFixed(2)}
        </span>
      </div>

      <div className="flex items-center gap-1 flex-wrap pt-0.5">
        {aspects.slice(0, 3).map((aspect) => (
          <span
            key={aspect}
            className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/50"
          >
            {aspect}
          </span>
        ))}
        {aspects.length > 3 && (
          <span className="text-[10px] px-1 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
            +{aspects.length - 3}
          </span>
        )}
      </div>
    </BaseNodeCard>
  );
});

LLMReviewNode.displayName = "LLMReviewNode";
