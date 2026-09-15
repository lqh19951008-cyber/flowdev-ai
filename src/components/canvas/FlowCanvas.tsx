"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
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
import { FileCode2, Sparkles, GitCompare, HelpCircle } from "lucide-react";

import { useFlowStore, createDefaultNodeData } from "@/stores/useFlowStore";
import { CustomNode, FlowNodeType } from "@/types/flow";
import { CodeInputNode } from "@/components/nodes/CodeInputNode";
import { LLMReviewNode } from "@/components/nodes/LLMReviewNode";
import { TestGeneratorNode } from "@/components/nodes/TestGeneratorNode";
import { DiffExportNode } from "@/components/nodes/DiffExportNode";
import { PipelineGuideModal } from "@/components/modal/PipelineGuideModal";

function FlowCanvasInner({ showMiniMap = true }: { showMiniMap?: boolean }) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    setSelectedNode,
    addNode,
    toggleDrawer,
  } = useFlowStore();

  const [isGuideOpen, setIsGuideOpen] = useState(false);

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
      // 1. Disallow self-loop
      if (connection.source === connection.target) {
        return false;
      }

      // 2. Disallow duplicate connections between same source and target
      const alreadyExists = edges.some(
        (edge) =>
          edge.source === connection.source &&
          edge.target === connection.target &&
          edge.sourceHandle === connection.sourceHandle &&
          edge.targetHandle === connection.targetHandle
      );

      if (alreadyExists) {
        return false;
      }

      return true;
    },
    [edges]
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: CustomNode) => {
      setSelectedNode(node);
    },
    [setSelectedNode]
  );

  const handlePaneClick = useCallback(() => {
    setSelectedNode(null);
    toggleDrawer(false);
  }, [setSelectedNode, toggleDrawer]);

  return (
    <div
      ref={reactFlowWrapper}
      className="relative h-full w-full bg-[#090d16] overflow-hidden select-none"
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
          color="#1e293b"
        />
        <Controls className="!bg-slate-900/90 !border-slate-800 !shadow-2xl [&>button]:!border-slate-800 [&>button]:!bg-slate-900 [&>button]:!fill-slate-300 [&>button:hover]:!bg-slate-800" />
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
            maskColor="rgba(9, 13, 22, 0.75)"
            className="!bg-slate-950/90 !border !border-slate-800/90 !rounded-xl overflow-hidden shadow-2xl !w-44 !h-28 !bottom-3 !right-3"
            zoomable
            pannable
          />
        )}
      </ReactFlow>

      {/* Top Floating Pipeline Flow Breadcrumb & Guide Button */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-950/85 border border-slate-800/90 shadow-2xl backdrop-blur-md text-xs text-slate-300 select-none pointer-events-auto">
        <div className="flex items-center gap-1.5 font-medium text-amber-400">
          <FileCode2 className="h-3.5 w-3.5 shrink-0" />
          <span>触发范围</span>
        </div>
        <span className="text-slate-600 font-mono">➔</span>
        <div className="flex items-center gap-1.5 font-medium text-purple-400">
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
          <span>安全审查与单测 (并联)</span>
        </div>
        <span className="text-slate-600 font-mono">➔</span>
        <div className="flex items-center gap-1.5 font-medium text-cyan-400">
          <GitCompare className="h-3.5 w-3.5 shrink-0" />
          <span>门禁决策阻断</span>
        </div>
        <div className="h-3 w-px bg-slate-800 mx-1" />
        <button
          onClick={() => setIsGuideOpen(true)}
          className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 font-medium transition-colors cursor-pointer"
          title="查看门禁编排与使用说明"
        >
          <HelpCircle className="h-3.5 w-3.5 shrink-0" />
          <span>编排使用指南</span>
        </button>
      </div>

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
