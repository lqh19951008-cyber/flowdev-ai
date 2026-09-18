"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { FlowCanvas } from "@/components/canvas/FlowCanvas";
import { PropertyDrawer } from "@/components/layout/PropertyDrawer";
import { useFlowStore } from "@/stores/useFlowStore";

function PipelineContent() {
  const searchParams = useSearchParams();
  const setSelectedProjectId = useFlowStore((s) => s.setSelectedProjectId);
  const setActiveViewMode = useFlowStore((s) => s.setActiveViewMode);
  const [showMiniMap] = useState(true);

  useEffect(() => {
    setActiveViewMode("pipeline");
    const projectParam = searchParams.get("project");
    if (projectParam) {
      setSelectedProjectId(projectParam);
    }
  }, [searchParams, setSelectedProjectId, setActiveViewMode]);

  return (
    <div className="flex w-full h-full min-h-0 overflow-hidden relative">
      {/* 左侧节点算子库 */}
      <Sidebar />

      {/* 中间 React Flow 交互画布 */}
      <div className="flex-1 h-full relative min-w-0">
        <FlowCanvas showMiniMap={showMiniMap} />
      </div>

      {/* 右侧属性与配置抽屉 */}
      <PropertyDrawer />
    </div>
  );
}

export default function PipelinePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">正在加载策略编排画布...</div>}>
      <PipelineContent />
    </Suspense>
  );
}
