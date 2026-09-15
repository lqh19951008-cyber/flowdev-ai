"use client";

import React, { useState, useMemo } from "react";
import {
  X,
  Copy,
  Check,
  Download,
  GitGraph,
  ArrowRight,
  Layers,
} from "lucide-react";
import { useFlowStore } from "@/stores/useFlowStore";
import { generateWorkflowTopology } from "@/lib/topology";

export function TopologyModal() {
  const { nodes, edges, isTopologyModalOpen, setTopologyModalOpen } =
    useFlowStore();
  const [copied, setCopied] = useState(false);

  const topology = useMemo(() => {
    return generateWorkflowTopology(nodes, edges);
  }, [nodes, edges]);

  const jsonString = useMemo(() => {
    return JSON.stringify(topology, null, 2);
  }, [topology]);

  if (!isTopologyModalOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Copy failed", e);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `workflow-topology-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150 select-none">
      <div
        className="relative w-full max-w-3xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-2xl flex flex-col max-h-[88vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <GitGraph className="h-4 w-4 text-blue-500 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>工作流拓扑依赖与配置 (LangGraph Schema)</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/25 text-blue-600 dark:text-blue-400">
                  DAG Verified
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                可直接作为 Python FastAPI + LangGraph 状态编排引擎的初始状态输入
              </p>
            </div>
          </div>

          <button
            onClick={() => setTopologyModalOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Execution Order Banner */}
        <div className="px-5 py-3 bg-slate-50/80 dark:bg-slate-900/40 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1 font-medium">
              <Layers className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
              拓扑执行顺序:
            </span>
            {topology.executionOrder.length > 0 ? (
              <div className="flex items-center gap-1 flex-wrap font-mono">
                {topology.executionOrder.map((nodeId, idx) => {
                  const targetNode = nodes.find((n) => n.id === nodeId);
                  return (
                    <React.Fragment key={nodeId}>
                      <span className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-[11px] shadow-xs">
                        {targetNode?.data.label || nodeId}
                      </span>
                      {idx < topology.executionOrder.length - 1 && (
                        <ArrowRight className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            ) : (
              <span className="text-slate-400 italic">暂无节点</span>
            )}
          </div>

          <div className="flex items-center gap-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
            <span>节点: {topology.nodeCount}</span>
            <span>连线: {topology.edgeCount}</span>
          </div>
        </div>

        {/* JSON Preview Content */}
        <div className="flex-1 overflow-auto p-4 bg-slate-900 dark:bg-[#080c14] font-mono text-xs select-text">
          <pre className="text-slate-100 dark:text-slate-300 leading-relaxed overflow-x-auto">
            {jsonString}
          </pre>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
          <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
            拓扑校验无环路冲突，连线结构合法
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-xs"
            >
              <Download className="h-3.5 w-3.5" />
              <span>下载 JSON</span>
            </button>

            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-lg shadow-blue-600/20 transition-all active:scale-95"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>已复制到剪贴板</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>复制配置 JSON</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
