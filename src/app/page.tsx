"use client";

import { useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { FlowCanvas } from "@/components/canvas/FlowCanvas";
import { PropertyDrawer } from "@/components/layout/PropertyDrawer";
import { TopologyModal } from "@/components/modal/TopologyModal";
import { DiffModal } from "@/components/modal/DiffModal";
import { useFlowStore } from "@/stores/useFlowStore";

export default function Home() {
  const initFromStorage = useFlowStore((s) => s.initFromStorage);

  useEffect(() => {
    initFromStorage();
  }, [initFromStorage]);

  return (
    <main className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950">
      {/* 顶部导航栏 */}
      <Header />

      {/* 主体工作台三段式布局 */}
      <div className="flex flex-1 w-full h-[calc(100vh-3.5rem)] overflow-hidden relative">
        {/* 左侧节点算子库 */}
        <Sidebar />

        {/* 中间 React Flow 交互画布 */}
        <div className="flex-1 h-full relative">
          <FlowCanvas />
        </div>

        {/* 右侧属性与配置抽屉 */}
        <PropertyDrawer />
      </div>

      {/* 拓扑结构与 LangGraph JSON 预览模态框 */}
      <TopologyModal />

      {/* Monaco 双向 Diff 比对与成果导出模态框 */}
      <DiffModal />
    </main>
  );
}
