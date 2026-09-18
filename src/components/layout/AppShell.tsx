"use client";

import React, { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { StatusBar } from "@/components/layout/StatusBar";
import { LiveGuardFeed } from "@/components/dashboard/LiveGuardFeed";
import { TopologyModal } from "@/components/modal/TopologyModal";
import { DiffModal } from "@/components/modal/DiffModal";
import { SystemSettingsModal } from "@/components/modal/FeishuConfigModal";
import { ProjectStatsModal } from "@/components/dashboard/ProjectStatsModal";
import { AddProjectModal } from "@/components/modal/AddProjectModal";
import { useFlowStore } from "@/stores/useFlowStore";

export function AppShell({ children }: { children: React.ReactNode }) {
  const initFromStorage = useFlowStore((s) => s.initFromStorage);
  const [showMiniMap, setShowMiniMap] = useState(true);

  useEffect(() => {
    initFromStorage();
  }, [initFromStorage]);

  return (
    <main className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#0b0f19] dark:text-slate-100 transition-colors duration-200">
      {/* 顶部统一导航栏 */}
      <Header />

      {/* 页面主体内容区 */}
      <div className="flex-1 w-full min-h-0 overflow-hidden relative">
        {children}
      </div>

      {/* 底部系统状态栏 */}
      <StatusBar
        showMiniMap={showMiniMap}
        onToggleMiniMap={() => setShowMiniMap((v) => !v)}
      />

      {/* 实时 Git 提交门禁事件广播与浮动通知 */}
      <LiveGuardFeed />

      {/* 多项目研发质量大盘与提交审计日志模态框 */}
      <ProjectStatsModal />

      {/* 拓扑结构与 LangGraph JSON 预览模态框 */}
      <TopologyModal />

      {/* Monaco 双向 Diff 比对与成果导出模态框 */}
      <DiffModal />

      {/* 系统大模型与飞书 Webhook 全局配置模态框 */}
      <SystemSettingsModal />

      {/* 全局代码仓库与项目接入向导模态框 */}
      <AddProjectModal />
    </main>
  );
}
