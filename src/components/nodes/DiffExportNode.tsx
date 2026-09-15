"use client";

import React, { memo } from "react";
import { NodeProps } from "@xyflow/react";
import { GitCompare, Eye, ShieldAlert, BellRing } from "lucide-react";
import { CustomNode, DiffExportConfig } from "@/types/flow";
import { BaseNodeCard } from "./BaseNodeCard";
import { useFlowStore } from "@/stores/useFlowStore";

const actionBadges: Record<string, { label: string; color: string; border: string }> = {
  block_commit: {
    label: "🚨 强行阻断 (Exit 1)",
    color: "text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10",
    border: "border-rose-200 dark:border-rose-500/30",
  },
  warn_only: {
    label: "⚠️ 弱告警放行",
    color: "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10",
    border: "border-amber-200 dark:border-amber-500/30",
  },
  create_review_pr: {
    label: "🔄 打回重评补丁",
    color: "text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-500/10",
    border: "border-cyan-200 dark:border-cyan-500/30",
  },
};

const notifyLabels: Record<string, string> = {
  none: "无实时推送",
  feishu: "飞书群机器人",
  dingtalk: "钉钉群机器人",
  slack: "Slack Webhook",
};

export const DiffExportNode = memo(({ id, data, selected }: NodeProps<CustomNode>) => {
  const { setDiffModalOpen } = useFlowStore();
  const nodeData = data || ({} as any);
  const config = (nodeData.config || {}) as Partial<DiffExportConfig>;
  const action = config.failureAction || "block_commit";
  const actionInfo = actionBadges[action] || actionBadges.block_commit;
  const notifyChannel = config.notifyChannel || "feishu";

  return (
    <BaseNodeCard
      id={id}
      selected={selected}
      title={nodeData.label || "门禁决策与阻断动作 (Enforce)"}
      typeBadge="ENFORCE_DECISION"
      status={nodeData.status || "idle"}
      icon={GitCompare}
      iconColor="text-cyan-500 dark:text-cyan-400"
      iconBg="bg-cyan-500/15 border-cyan-500/30"
      hasTargetHandle={true}
      hasSourceHandle={false}
    >
      <div className="flex items-center justify-between text-[11px] font-mono">
        <span
          className={`flex items-center gap-1 px-2 py-0.5 rounded font-medium border ${actionInfo.color} ${actionInfo.border}`}
        >
          <ShieldAlert className="h-3 w-3" />
          {actionInfo.label}
        </span>
        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
          Unified Diff
        </span>
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/60 px-2 py-1 rounded border border-slate-200/80 dark:border-slate-800/80 font-medium">
        <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
          <BellRing className="h-3 w-3 text-cyan-500 dark:text-cyan-400" />
          告警通道:
        </span>
        <span className="font-mono text-cyan-600 dark:text-cyan-300">
          {notifyLabels[notifyChannel] || notifyChannel}
        </span>
      </div>

      {/* Button to open Monaco Diff Comparison Modal */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setDiffModalOpen(true);
        }}
        className="w-full mt-1 py-1 px-2 flex items-center justify-center gap-1.5 rounded-md bg-cyan-50 dark:bg-cyan-500/15 hover:bg-cyan-100 dark:hover:bg-cyan-500/25 border border-cyan-200 dark:border-cyan-500/30 text-cyan-700 dark:text-cyan-300 text-[11px] font-medium transition-all shadow-xs cursor-pointer"
      >
        <Eye className="h-3 w-3" />
        <span>查看自愈 Diff 补丁</span>
      </button>
    </BaseNodeCard>
  );
});

DiffExportNode.displayName = "DiffExportNode";
