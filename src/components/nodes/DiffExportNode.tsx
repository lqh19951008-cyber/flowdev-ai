"use client";

import React, { memo } from "react";
import { NodeProps } from "@xyflow/react";
import { GitCompare, FolderArchive, ArrowDownToLine, Eye } from "lucide-react";
import { CustomNode, DiffExportConfig } from "@/types/flow";
import { BaseNodeCard } from "./BaseNodeCard";
import { useFlowStore } from "@/stores/useFlowStore";

const formatLabels: Record<string, string> = {
  unified_diff: "Unified Diff",
  git_patch: "Git Patch (.patch)",
  json_report: "JSON 评估报告",
};

export const DiffExportNode = memo(({ id, data, selected }: NodeProps<CustomNode>) => {
  const { setDiffModalOpen } = useFlowStore();
  const config = (data.config || {}) as Partial<DiffExportConfig>;
  const format = config.exportFormat || "unified_diff";
  const outputPath = config.outputPath || "./output/patch.diff";

  return (
    <BaseNodeCard
      id={id}
      selected={selected}
      title={data.label || "代码差异与补丁导出"}
      typeBadge="OUTPUT_DEST"
      status={data.status}
      icon={GitCompare}
      iconColor="text-cyan-400"
      iconBg="bg-cyan-500/15 border-cyan-500/30"
      hasTargetHandle={true}
      hasSourceHandle={false}
    >
      <div className="flex items-center justify-between text-[11px] font-mono">
        <span className="flex items-center gap-1 text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
          <ArrowDownToLine className="h-3 w-3" />
          {formatLabels[format] || format}
        </span>
        <span className="text-[10px] text-slate-400">已就绪</span>
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 bg-slate-950/60 px-2 py-1 rounded border border-slate-800/80 font-mono truncate">
        <FolderArchive className="h-3.5 w-3.5 text-slate-500 shrink-0" />
        <span className="truncate">{outputPath}</span>
      </div>

      {/* Button to open Monaco Diff Comparison Modal */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setDiffModalOpen(true);
        }}
        className="w-full mt-1.5 py-1 px-2 flex items-center justify-center gap-1.5 rounded-md bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-[11px] font-medium transition-all shadow-sm"
      >
        <Eye className="h-3 w-3" />
        <span>查看代码 Diff 对比</span>
      </button>
    </BaseNodeCard>
  );
});

DiffExportNode.displayName = "DiffExportNode";
