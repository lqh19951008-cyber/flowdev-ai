"use client";

import React, { useCallback, useMemo, useRef } from "react";
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

import { useFlowStore, createDefaultNodeData } from "@/stores/useFlowStore";
import { CustomNode, FlowNodeType } from "@/types/flow";
import { CodeInputNode } from "@/components/nodes/CodeInputNode";
import { LLMReviewNode } from "@/components/nodes/LLMReviewNode";
import { TestGeneratorNode } from "@/components/nodes/TestGeneratorNode";
import { DiffExportNode } from "@/components/nodes/DiffExportNode";

function FlowCanvasInner() {
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
        <MiniMap
          nodeColor={(node) => {
            switch (node.type) {
              case "llm_review":
                return "#a855f7";
              case "test_generator":
                return "#10b981";
              case "code_input":
                return "#f59e0b";
              case "diff_export":
                return "#06b6d4";
              default:
                return "#3b82f6";
            }
          }}
          maskColor="rgba(9, 13, 22, 0.8)"
          className="!bg-slate-950/80 !border !border-slate-800/80 !rounded-lg overflow-hidden shadow-2xl"
        />
      </ReactFlow>
    </div>
  );
}

export function FlowCanvas() {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner />
    </ReactFlowProvider>
  );
}
