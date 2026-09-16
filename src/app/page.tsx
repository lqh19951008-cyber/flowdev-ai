"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { FlowCanvas } from "@/components/canvas/FlowCanvas";
import { PropertyDrawer } from "@/components/layout/PropertyDrawer";
import { StatusBar } from "@/components/layout/StatusBar";
import { TopologyModal } from "@/components/modal/TopologyModal";
import { DiffModal } from "@/components/modal/DiffModal";
import { SystemSettingsModal } from "@/components/modal/FeishuConfigModal";
import { LiveGuardFeed } from "@/components/dashboard/LiveGuardFeed";

import { ProjectStatsModal } from "@/components/dashboard/ProjectStatsModal";
import { QualityDashboardView } from "@/components/dashboard/QualityDashboardView";
import { useFlowStore } from "@/stores/useFlowStore";

export default function Home() {
  const initFromStorage = useFlowStore((s) => s.initFromStorage);
  const activeViewMode = useFlowStore((s) => s.activeViewMode);
  const [showMiniMap, setShowMiniMap] = useState(true);

  useEffect(() => {
    initFromStorage();
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get("view");
      if (viewParam === "dashboard" || window.location.hash === "#dashboard") {
        useFlowStore.getState().setActiveViewMode("dashboard");
      } else if (viewParam === "pipeline" || window.location.hash === "#pipeline") {
        useFlowStore.getState().setActiveViewMode("pipeline");
      }
    }
  }, [initFromStorage]);

  return (
    <main className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#0b0f19] dark:text-slate-100 transition-colors duration-200">
      {/* 顶部导航栏 */}
      <Header />

      {/* 主体工作区 */}
      {activeViewMode === "dashboard" ? (
        <div className="flex-1 w-full min-h-0 overflow-y-auto">
          <QualityDashboardView />
        </div>
      ) : (
        /* 门禁策略编排三段式布局 */
        <div className="flex flex-1 w-full min-h-0 overflow-hidden relative">
          {/* 左侧节点算子库 */}
          <Sidebar />

          {/* 中间 React Flow 交互画布 */}
          <div className="flex-1 h-full relative min-w-0">
            <FlowCanvas showMiniMap={showMiniMap} />
          </div>

          {/* 右侧属性与配置抽屉 */}
          <PropertyDrawer />
        </div>
      )}

      {/* 底部系统状态栏 */}
      <StatusBar
        showMiniMap={showMiniMap}
        onToggleMiniMap={() => setShowMiniMap((v) => !v)}
      />

      {/* 实时 Git 提交门禁事件广播与浮动通知 */}
      <LiveGuardFeed />

      {/* 多项目研发质量大盘与提交审计日志 */}
      <ProjectStatsModal />

      {/* 拓扑结构与 LangGraph JSON 预览模态框 */}
      <TopologyModal />

      {/* Monaco 双向 Diff 比对与成果导出模态框 */}
      <DiffModal />

      {/* 系统大模型与飞书 Webhook 全局配置模态框 */}
      <SystemSettingsModal />
    </main>
  );
}

