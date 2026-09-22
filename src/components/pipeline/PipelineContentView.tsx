"use client";

import React from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { FlowCanvas } from "@/components/canvas/FlowCanvas";
import { PropertyDrawer } from "@/components/layout/PropertyDrawer";

interface PipelineContentViewProps {
  showMiniMap?: boolean;
}

export function PipelineContentView({ showMiniMap = true }: PipelineContentViewProps) {
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
