"use client";

import React, { memo } from "react";
import { NodeProps } from "@xyflow/react";
import { Sparkles, Cpu, ShieldAlert, ShieldCheck } from "lucide-react";
import { CustomNode, LLMReviewConfig } from "@/types/flow";
import { BaseNodeCard } from "./BaseNodeCard";

const modelLabels: Record<string, string> = {
  "AI/deekseek-v4-flash-0731": "DeepSeek-V4 Flash",
  "deepseek-v3": "DeepSeek-V3 (标准)",
  "qwen-2.5-coder": "Qwen 2.5 Coder",
  "deepseek-r1": "DeepSeek-R1 (推理)",
};

const severityBadges: Record<string, { label: string; color: string; border: string }> = {
  strict: {
    label: "🚨 极严阻断 (Exit 1)",
    color: "text-rose-300 bg-rose-500/10",
    border: "border-rose-500/30",
  },
  standard: {
    label: "🛡️ 企业标准阻断",
    color: "text-purple-300 bg-purple-500/10",
    border: "border-purple-500/30",
  },
  relaxed: {
    label: "⚠️ 宽松告警",
    color: "text-amber-300 bg-amber-500/10",
    border: "border-amber-500/30",
  },
};

export const LLMReviewNode = memo(({ id, data, selected }: NodeProps<CustomNode>) => {
  const nodeData = data || ({} as any);
  const config = (nodeData.config || {}) as Partial<LLMReviewConfig>;
  const model = config.model || "AI/deekseek-v4-flash-0731";
  const severity = config.severityLevel || "strict";
  const sevInfo = severityBadges[severity] || severityBadges.strict;

  const rules = [
    config.blockNullDeref !== false && "阻断空指针",
    config.blockSqlInjection !== false && "阻断 SQL 注入",
    config.blockHardcodedSecrets !== false && "阻断秘钥泄露",
    config.blockDangerousEval !== false && "阻断危险 eval",
  ].filter(Boolean) as string[];

  return (
    <BaseNodeCard
      id={id}
      selected={selected}
      title={nodeData.label || "代码安全与漏洞阻断 (Security)"}
      typeBadge="SECURITY_GUARD"
      status={nodeData.status || "idle"}
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
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${sevInfo.color} ${sevInfo.border}`}
        >
          {sevInfo.label}
        </span>
      </div>

      <div className="space-y-1">
        <div className="text-[10px] text-slate-400 flex items-center gap-1">
          <ShieldAlert className="h-3 w-3 text-rose-400 shrink-0" />
          <span>专项防御红线 ({rules.length} 条已激活):</span>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {rules.map((rule) => (
            <span
              key={rule}
              className="text-[10px] px-1.5 py-0.5 rounded bg-slate-950/80 text-rose-300/90 border border-rose-500/20 font-mono flex items-center gap-0.5"
            >
              <ShieldCheck className="h-2.5 w-2.5 text-rose-400" />
              {rule}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
        <span className="text-purple-400 font-medium">语义推演</span>
        <span className="font-mono text-slate-500">发现致命漏洞掐断提交</span>
      </div>
    </BaseNodeCard>
  );
});

LLMReviewNode.displayName = "LLMReviewNode";

