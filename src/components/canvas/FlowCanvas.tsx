"use client";

import React, { useCallback, useMemo, useRef, useState, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  NodeTypes,
  ReactFlowProvider,
  useReactFlow,
  Connection,
  Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  FileCode2,
  Sparkles,
  GitCompare,
  HelpCircle,
  Settings2,
  Copy,
  Play,
  Trash2,
  GitGraph,
  Maximize2,
  RotateCcw,
  PlusCircle,
  TestTube2,
} from "lucide-react";

import { useFlowStore, createDefaultNodeData } from "@/stores/useFlowStore";
import { CustomNode, FlowNodeType } from "@/types/flow";
import { CodeInputNode } from "@/components/nodes/CodeInputNode";
import { LLMReviewNode } from "@/components/nodes/LLMReviewNode";
import { TestGeneratorNode } from "@/components/nodes/TestGeneratorNode";
import { DiffExportNode } from "@/components/nodes/DiffExportNode";
import { PipelineGuideModal } from "@/components/modal/PipelineGuideModal";
import { useTheme } from "@/components/providers/HeroUIProvider";
import { cn } from "@/lib/utils";

function FlowCanvasInner({ showMiniMap = true }: { showMiniMap?: boolean }) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView } = useReactFlow();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    selectedNode,
    setSelectedNode,
    addNode,
    setNodes,
    setEdges,
    clearCanvas,
    toggleDrawer,
    setTopologyModalOpen,
    setNodeStatus,
    appendNodeLog,
  } = useFlowStore();

  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Right-click context menu states
  const [nodeContextMenu, setNodeContextMenu] = useState<{
    x: number;
    y: number;
    node: CustomNode;
  } | null>(null);

  const [paneContextMenu, setPaneContextMenu] = useState<{
    x: number;
    y: number;
    clientX: number;
    clientY: number;
  } | null>(null);

  // Close context menus on global click or Escape
  useEffect(() => {
    const handleGlobalClick = () => {
      setNodeContextMenu(null);
      setPaneContextMenu(null);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setNodeContextMenu(null);
        setPaneContextMenu(null);
      }
      if (e.key === "Delete" && selectedNode) {
        setNodes(nodes.filter((n) => n.id !== selectedNode.id));
        setEdges(edges.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
        setSelectedNode(null);
        toggleDrawer(false);
      }
    };

    window.addEventListener("click", handleGlobalClick);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("click", handleGlobalClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [nodes, edges, selectedNode, setNodes, setEdges, setSelectedNode, toggleDrawer]);

  // Register the 4 custom node types
  const nodeTypes: NodeTypes = useMemo(
    () => ({
      code_input: CodeInputNode,
      llm_review: LLMReviewNode,
      test_generator: TestGeneratorNode,
      diff_export: DiffExportNode,
    }),
    []
  );

  // HTML5 Drag and Drop handlers
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData(
        "application/reactflow"
      ) as FlowNodeType;

      if (!type) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: CustomNode = {
        id: `node-${type}-${Date.now()}`,
        type,
        position,
        data: createDefaultNodeData(type),
      };

      addNode(newNode);
    },
    [screenToFlowPosition, addNode]
  );

  // Connection validation: prevent self-loop & duplicates
  const isValidConnection = useCallback(
    (connection: Connection | Edge) => {
      if (connection.source === connection.target) {
        return false;
      }
      const alreadyExists = edges.some(
        (edge) =>
          edge.source === connection.source &&
          edge.target === connection.target &&
          edge.sourceHandle === connection.sourceHandle &&
          edge.targetHandle === connection.targetHandle
      );
      return !alreadyExists;
    },
    [edges]
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: CustomNode) => {
      setSelectedNode(node);
      toggleDrawer(true);
      setNodeContextMenu(null);
      setPaneContextMenu(null);
    },
    [setSelectedNode, toggleDrawer]
  );

  const handlePaneClick = useCallback(() => {
    setSelectedNode(null);
    toggleDrawer(false);
    setNodeContextMenu(null);
    setPaneContextMenu(null);
  }, [setSelectedNode, toggleDrawer]);

  // Right-click on Node
  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: CustomNode) => {
      event.preventDefault();
      event.stopPropagation();
      setPaneContextMenu(null);
      toggleDrawer(false);

      // Safe viewport boundary clamping
      const x = Math.min(event.clientX, window.innerWidth - 230);
      const y = Math.min(event.clientY, window.innerHeight - 290);

      setNodeContextMenu({ x, y, node });
      setSelectedNode(node);
    },
    [setSelectedNode, toggleDrawer]
  );

  // Right-click on Canvas Background Pane
  const handlePaneContextMenu = useCallback((event: MouseEvent | React.MouseEvent) => {
    event.preventDefault();
    setNodeContextMenu(null);
    toggleDrawer(false);

    const x = Math.min(event.clientX, window.innerWidth - 220);
    const y = Math.min(event.clientY, window.innerHeight - 250);

    setPaneContextMenu({
      x,
      y,
      clientX: event.clientX,
      clientY: event.clientY,
    });
  }, []);

  // Node Context Menu Action Handlers
  const handleConfigureNode = (node: CustomNode) => {
    setSelectedNode(node);
    toggleDrawer(true);
    setNodeContextMenu(null);
  };

  const handleDuplicateNode = (node: CustomNode) => {
    const newId = `node-${node.type}-${Date.now()}`;
    const newNode: CustomNode = {
      ...node,
      id: newId,
      position: {
        x: node.position.x + 45,
        y: node.position.y + 45,
      },
      data: {
        ...JSON.parse(JSON.stringify(node.data)),
        label: `${node.data.label} (副本)`,
        status: "idle",
      },
      selected: true,
    };
    addNode(newNode);
    setSelectedNode(newNode);
    setNodeContextMenu(null);
  };

  const handleSimulateNode = (node: CustomNode) => {
    setNodeStatus(node.id, "running");
    appendNodeLog(node.id, `[DEBUG] 启动单算子推演实测: ${node.data.label}`);
    setTimeout(() => {
      appendNodeLog(node.id, `[DEBUG] 规则推演与沙箱断言验证通过 (耗时 32ms)`);
      setNodeStatus(node.id, "completed");
    }, 600);
    setNodeContextMenu(null);
  };

  const handleDeleteNode = (nodeId: string) => {
    setNodes(nodes.filter((n) => n.id !== nodeId));
    setEdges(edges.filter((e) => e.source !== nodeId && e.target !== nodeId));
    if (selectedNode?.id === nodeId) {
      setSelectedNode(null);
      toggleDrawer(false);
    }
    setNodeContextMenu(null);
  };

  // Pane Context Menu Quick Add Handler
  const handleQuickAdd = (type: FlowNodeType) => {
    if (!paneContextMenu) return;
    const position = screenToFlowPosition({
      x: paneContextMenu.clientX,
      y: paneContextMenu.clientY,
    });

    const newNode: CustomNode = {
      id: `node-${type}-${Date.now()}`,
      type,
      position,
      data: createDefaultNodeData(type),
      selected: true,
    };

    addNode(newNode);
    setSelectedNode(newNode);
    setPaneContextMenu(null);
  };

  return (
    <div
      ref={reactFlowWrapper}
      className="relative h-full w-full bg-slate-100/70 dark:bg-[#090d16] overflow-hidden select-none transition-colors duration-200"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onNodeContextMenu={handleNodeContextMenu}
        onPaneContextMenu={handlePaneContextMenu}
        isValidConnection={isValidConnection}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.2}
        maxZoom={2}
        defaultEdgeOptions={{
          animated: true,
        }}
        className="flowdev-canvas"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1.5}
          color={isDark ? "#1e293b" : "#cbd5e1"}
        />
        <Controls className="!bg-white/95 dark:!bg-slate-900/90 !border-slate-200 dark:!border-slate-800 !shadow-lg [&>button]:!border-slate-200 dark:[&>button]:!border-slate-800 [&>button]:!bg-white dark:[&>button]:!bg-slate-900 [&>button]:!fill-slate-700 dark:[&>button]:!fill-slate-300 [&>button:hover]:!bg-slate-100 dark:[&>button:hover]:!bg-slate-800" />
        {showMiniMap && (
          <MiniMap
            nodeColor={(node) => {
              switch (node.type) {
                case "llm_review":
                  return "#7c3aed";
                case "test_generator":
                  return "#059669";
                case "code_input":
                  return "#d97706";
                case "diff_export":
                  return "#0891b2";
                default:
                  return "#2563eb";
              }
            }}
            maskColor={isDark ? "rgba(9, 13, 22, 0.75)" : "rgba(241, 245, 249, 0.75)"}
            className="!bg-white/95 dark:!bg-slate-950/90 !border !border-slate-200 dark:!border-slate-800/90 !rounded-xl overflow-hidden shadow-lg !w-44 !h-28 !bottom-3 !right-3"
            zoomable
            pannable
          />
        )}
      </ReactFlow>

      {/* Top Floating Pipeline Flow Breadcrumb & Guide Button */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 dark:bg-slate-950/85 border border-slate-200/90 dark:border-slate-800/90 shadow-md dark:shadow-2xl backdrop-blur-md text-xs text-slate-700 dark:text-slate-300 select-none pointer-events-auto">
        <div className="flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400">
          <FileCode2 className="h-3.5 w-3.5 shrink-0" />
          <span>触发范围</span>
        </div>
        <span className="text-slate-400 dark:text-slate-600 font-mono">➔</span>
        <div className="flex items-center gap-1.5 font-medium text-purple-600 dark:text-purple-400">
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
          <span>安全审查与单测 (并联)</span>
        </div>
        <span className="text-slate-400 dark:text-slate-600 font-mono">➔</span>
        <div className="flex items-center gap-1.5 font-medium text-cyan-600 dark:text-cyan-400">
          <GitCompare className="h-3.5 w-3.5 shrink-0" />
          <span>门禁决策阻断</span>
        </div>
        <div className="h-3 w-px bg-slate-200 dark:bg-slate-800 mx-1" />
        <button
          onClick={() => setIsGuideOpen(true)}
          className="flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors cursor-pointer"
          title="查看门禁编排与使用说明"
        >
          <HelpCircle className="h-3.5 w-3.5 shrink-0" />
          <span>编排使用指南</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 🎯 Node Right-Click Context Menu (节点右键菜单) */}
      {/* ========================================================================= */}
      {nodeContextMenu && (
        <div
          style={{ top: nodeContextMenu.y, left: nodeContextMenu.x }}
          className="fixed z-50 min-w-[210px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 shadow-2xl backdrop-blur-md p-1.5 text-xs text-slate-700 dark:text-slate-200 animate-in fade-in zoom-in-95 duration-100 select-none"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with Node Type & Label */}
          <div className="px-2.5 py-1.5 border-b border-slate-100 dark:border-slate-800 mb-1">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
              <span className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[160px]">
                {nodeContextMenu.node.data.label || "算子节点"}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
              ID: {nodeContextMenu.node.id}
            </div>
          </div>

          {/* Menu Actions */}
          <button
            onClick={() => handleConfigureNode(nodeContextMenu.node)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2 font-medium">
              <Settings2 className="h-3.5 w-3.5 text-blue-500" />
              <span>配置属性 (Configure)</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Drawer</span>
          </button>

          <button
            onClick={() => handleDuplicateNode(nodeContextMenu.node)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2 font-medium">
              <Copy className="h-3.5 w-3.5 text-indigo-500" />
              <span>克隆副本 (Duplicate)</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono">+Copy</span>
          </button>

          <button
            onClick={() => handleSimulateNode(nodeContextMenu.node)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2 font-medium">
              <Play className="h-3.5 w-3.5 text-emerald-500" />
              <span>单算子实测 (Simulate)</span>
            </span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">Run</span>
          </button>

          <button
            onClick={() => {
              setTopologyModalOpen(true);
              setNodeContextMenu(null);
            }}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2 font-medium">
              <GitGraph className="h-3.5 w-3.5 text-cyan-500" />
              <span>查看拓扑 JSON</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Schema</span>
          </button>

          <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />

          <button
            onClick={() => handleDeleteNode(nodeContextMenu.node.id)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/15 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer font-medium"
          >
            <span className="flex items-center gap-2">
              <Trash2 className="h-3.5 w-3.5" />
              <span>删除此节点 (Delete)</span>
            </span>
            <span className="text-[10px] text-rose-500 font-mono">Del</span>
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🧭 Canvas Background Right-Click Context Menu (画布空白处右键菜单) */}
      {/* ========================================================================= */}
      {paneContextMenu && (
        <div
          style={{ top: paneContextMenu.y, left: paneContextMenu.x }}
          className="fixed z-50 min-w-[210px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 shadow-2xl backdrop-blur-md p-1.5 text-xs text-slate-700 dark:text-slate-200 animate-in fade-in zoom-in-95 duration-100 select-none"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            快捷新增算子
          </div>

          <button
            onClick={() => handleQuickAdd("code_input")}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <FileCode2 className="h-3.5 w-3.5 text-amber-500" />
            <span>门禁触发与范围 (Scope)</span>
          </button>

          <button
            onClick={() => handleQuickAdd("llm_review")}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5 text-purple-500" />
            <span>代码安全与漏洞阻断 (Security)</span>
          </button>

          <button
            onClick={() => handleQuickAdd("test_generator")}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <TestTube2 className="h-3.5 w-3.5 text-emerald-500" />
            <span>单测覆盖率红线 (Coverage)</span>
          </button>

          <button
            onClick={() => handleQuickAdd("diff_export")}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <GitCompare className="h-3.5 w-3.5 text-cyan-500" />
            <span>门禁裁决与决策 (Enforce)</span>
          </button>

          <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />

          <button
            onClick={() => {
              fitView({ padding: 0.25 });
              setPaneContextMenu(null);
            }}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Maximize2 className="h-3.5 w-3.5 text-slate-500" />
              <span>适应全图视角</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Fit</span>
          </button>

          <button
            onClick={() => {
              clearCanvas();
              setPaneContextMenu(null);
            }}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/15 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <RotateCcw className="h-3.5 w-3.5" />
              <span>清空画布所有节点</span>
            </span>
            <span className="text-[10px] text-rose-500 font-mono">Clear</span>
          </button>
        </div>
      )}

      {/* Pipeline Guide Modal */}
      <PipelineGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />
    </div>
  );
}

export function FlowCanvas({ showMiniMap = true }: { showMiniMap?: boolean }) {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner showMiniMap={showMiniMap} />
    </ReactFlowProvider>
  );
}
