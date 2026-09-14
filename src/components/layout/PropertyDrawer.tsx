"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Sliders,
  Trash2,
  Cpu,
  Settings2,
  FileCode2,
  Sparkles,
  TestTube2,
  GitCompare,
  Terminal,
  Workflow,
} from "lucide-react";
import { useFlowStore } from "@/stores/useFlowStore";
import {
  CodeInputConfig,
  LLMReviewConfig,
  TestGeneratorConfig,
  DiffExportConfig,
  FlowNodeData,
} from "@/types/flow";
import { cn } from "@/lib/utils";

const REVIEW_ASPECT_OPTIONS = [
  "代码异味",
  "安全漏洞",
  "类型健壮性",
  "并发隐患",
  "性能瓶颈",
  "边界条件",
];

export function PropertyDrawer() {
  const {
    selectedNode,
    setSelectedNode,
    isDrawerOpen,
    toggleDrawer,
    updateNodeData,
    nodes,
    setNodes,
    edges,
    setEdges,
    nodeLogs,
  } = useFlowStore();

  // Local state for debounced updates
  const [localData, setLocalData] = useState<FlowNodeData | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (selectedNode) {
      setLocalData(selectedNode.data);
    } else {
      setLocalData(null);
    }
  }, [selectedNode?.id]);

  // Support pressing Esc key to close the drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isDrawerOpen) {
        toggleDrawer(false);
        setSelectedNode(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDrawerOpen, toggleDrawer, setSelectedNode]);

  // Debounced sync to store
  const syncToStore = (data: Partial<FlowNodeData>) => {
    if (!selectedNode) return;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      updateNodeData(selectedNode.id, data);
    }, 150);
  };

  const handleFieldChange = (key: keyof FlowNodeData, value: unknown) => {
    if (!localData || !selectedNode) return;
    const updated = { ...localData, [key]: value };
    setLocalData(updated);
    syncToStore({ [key]: value });
  };

  const handleConfigChange = (configKey: string, value: unknown) => {
    if (!localData || !selectedNode) return;
    const updatedConfig = {
      ...(localData.config || {}),
      [configKey]: value,
    };
    const updatedData = { ...localData, config: updatedConfig };
    setLocalData(updatedData);
    syncToStore({ config: updatedConfig });
  };

  const toggleAspect = (aspect: string) => {
    if (!localData || !selectedNode) return;
    const currentConfig = (localData.config || {}) as Partial<LLMReviewConfig>;
    const currentAspects = currentConfig.reviewAspects || [];
    const newAspects = currentAspects.includes(aspect)
      ? currentAspects.filter((a) => a !== aspect)
      : [...currentAspects, aspect];
    handleConfigChange("reviewAspects", newAspects);
  };

  const handleDeleteCurrentNode = () => {
    if (!selectedNode) return;
    setNodes(nodes.filter((n) => n.id !== selectedNode.id));
    setEdges(
      edges.filter(
        (e) => e.source !== selectedNode.id && e.target !== selectedNode.id
      )
    );
    setSelectedNode(null);
  };

  return (
    <aside
      className={cn(
        "absolute right-0 top-0 bottom-0 z-30 w-[360px] max-w-[30vw] border-l border-slate-800/90 bg-slate-950/95 backdrop-blur-md shadow-2xl transition-all duration-300 ease-in-out flex flex-col select-none",
        isDrawerOpen
          ? "translate-x-0 opacity-100 pointer-events-auto"
          : "translate-x-full opacity-0 pointer-events-none"
      )}
    >
      {/* Header */}
      <div className="h-11 px-3 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <Sliders className="h-3.5 w-3.5 text-blue-400 shrink-0" />
          <span className="text-xs font-semibold text-slate-200 truncate">
            {selectedNode ? "节点属性配置" : "工作流全局配置"}
          </span>
        </div>
        <button
          onClick={() => {
            toggleDrawer(false);
            setSelectedNode(null);
          }}
          className="p-1 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          title="收起抽屉 (Esc)"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {selectedNode && localData ? (
          <>
            {/* Common Info */}
            <div className="space-y-2">
              <div>
                <label className="text-[10px] font-medium text-slate-400 mb-0.5 block">
                  节点名称 (Label)
                </label>
                <input
                  type="text"
                  value={localData.label || ""}
                  onChange={(e) => handleFieldChange("label", e.target.value)}
                  className="w-full px-2.5 py-1 text-xs bg-slate-900 border border-slate-800 rounded-md text-slate-200 focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="text-[10px] font-medium text-slate-400 mb-0.5 block">
                  功能描述
                </label>
                <textarea
                  rows={2}
                  value={localData.description || ""}
                  onChange={(e) =>
                    handleFieldChange("description", e.target.value)
                  }
                  className="w-full px-2.5 py-1 text-xs bg-slate-900 border border-slate-800 rounded-md text-slate-300 placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none leading-snug"
                />
              </div>
            </div>

            {/* Custom Node Specific Configs */}
            {selectedNode.type === "code_input" && (
              <div className="pt-2.5 border-t border-slate-800/80 space-y-2.5">
                <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                  <FileCode2 className="h-3 w-3" />
                  源码输入参数
                </span>

                <div>
                  <label className="text-[10px] font-medium text-slate-400 mb-0.5 block">
                    输入模式
                  </label>
                  <select
                    value={(localData.config as CodeInputConfig)?.sourceType || "snippet"}
                    onChange={(e) =>
                      handleConfigChange("sourceType", e.target.value)
                    }
                    className="w-full px-2 py-1 text-xs bg-slate-900 border border-slate-800 rounded-md text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="snippet">直接粘贴代码片段 (Snippet)</option>
                    <option value="git">连接 Git 仓库 Diff (PR Hook)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-medium text-slate-400 mb-0.5 block">
                    目标语言
                  </label>
                  <select
                    value={(localData.config as CodeInputConfig)?.language || "typescript"}
                    onChange={(e) =>
                      handleConfigChange("language", e.target.value)
                    }
                    className="w-full px-2 py-1 text-xs bg-slate-900 border border-slate-800 rounded-md text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                  >
                    <option value="typescript">TypeScript (.ts/.tsx)</option>
                    <option value="javascript">JavaScript (.js/.jsx)</option>
                    <option value="python">Python (.py)</option>
                    <option value="go">Go (.go)</option>
                    <option value="java">Java (.java)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-medium text-slate-400 mb-0.5 block">
                    待测代码片段
                  </label>
                  <textarea
                    rows={5}
                    value={
                      (localData.config as CodeInputConfig)?.sampleCode || ""
                    }
                    onChange={(e) =>
                      handleConfigChange("sampleCode", e.target.value)
                    }
                    placeholder="在此粘帖待审查的源码..."
                    className="w-full px-2.5 py-1 text-xs bg-slate-900 border border-slate-800 rounded-md text-slate-300 font-mono focus:outline-none focus:border-blue-500 resize-none leading-normal"
                  />
                </div>
              </div>
            )}

            {selectedNode.type === "llm_review" && (
              <div className="pt-2.5 border-t border-slate-800/80 space-y-2.5">
                <span className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  审查 Agent 参数
                </span>

                <div>
                  <label className="text-[10px] font-medium text-slate-400 mb-0.5 block flex items-center justify-between">
                    <span>驱动模型</span>
                    <Cpu className="h-3 w-3 text-slate-500" />
                  </label>
                  <select
                    value={(localData.config as LLMReviewConfig)?.model || "deepseek-v3"}
                    onChange={(e) =>
                      handleConfigChange("model", e.target.value)
                    }
                    className="w-full px-2 py-1 text-xs bg-slate-900 border border-slate-800 rounded-md text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="AI/deekseek-v4-flash-0731">DeepSeek-V4 Flash (AI/deekseek-v4-flash-0731)</option>
                    <option value="deepseek-v3">DeepSeek-V3 (推荐: 极高性价比)</option>
                    <option value="qwen-2.5-coder">Qwen 2.5 Coder 32B</option>
                    <option value="deepseek-r1">DeepSeek-R1 (深度推理)</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                    <span>Temperature</span>
                    <span className="font-mono text-purple-300 font-semibold">
                      {((localData.config as LLMReviewConfig)?.temperature ?? 0.2).toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={(localData.config as LLMReviewConfig)?.temperature ?? 0.2}
                    onChange={(e) =>
                      handleConfigChange("temperature", parseFloat(e.target.value))
                    }
                    className="w-full accent-purple-500 cursor-pointer h-1.5"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-medium text-slate-400 mb-1 block">
                    重点关注项 (多选)
                  </label>
                  <div className="grid grid-cols-2 gap-1">
                    {REVIEW_ASPECT_OPTIONS.map((aspect) => {
                      const currentAspects =
                        (localData.config as LLMReviewConfig)?.reviewAspects || [];
                      const isChecked = currentAspects.includes(aspect);
                      return (
                        <button
                          key={aspect}
                          type="button"
                          onClick={() => toggleAspect(aspect)}
                          className={`px-1.5 py-1 rounded text-[10px] border text-left flex items-center gap-1 transition-colors ${
                            isChecked
                              ? "bg-purple-500/15 border-purple-500/40 text-purple-300"
                              : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              isChecked ? "bg-purple-400" : "bg-slate-600"
                            }`}
                          />
                          <span className="truncate">{aspect}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-medium text-slate-400 mb-0.5 block">
                    Prompt 模板
                  </label>
                  <textarea
                    rows={3}
                    value={
                      (localData.config as LLMReviewConfig)?.promptTemplate || ""
                    }
                    onChange={(e) =>
                      handleConfigChange("promptTemplate", e.target.value)
                    }
                    className="w-full px-2 py-1 text-xs bg-slate-900 border border-slate-800 rounded-md text-slate-300 font-mono focus:outline-none focus:border-blue-500 resize-none leading-normal"
                  />
                </div>
              </div>
            )}

            {selectedNode.type === "test_generator" && (
              <div className="pt-2.5 border-t border-slate-800/80 space-y-2.5">
                <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                  <TestTube2 className="h-3 w-3" />
                  单测生成参数
                </span>

                <div>
                  <label className="text-[10px] font-medium text-slate-400 mb-0.5 block">
                    测试框架
                  </label>
                  <select
                    value={
                      (localData.config as TestGeneratorConfig)?.framework || "jest"
                    }
                    onChange={(e) =>
                      handleConfigChange("framework", e.target.value)
                    }
                    className="w-full px-2 py-1 text-xs bg-slate-900 border border-slate-800 rounded-md text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                  >
                    <option value="unittest">Unittest (Python 标准库)</option>
                    <option value="pytest">PyTest (Python)</option>
                    <option value="jest">Jest (TS/JS)</option>
                    <option value="vitest">Vitest (Next/Vite)</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                    <span>目标行覆盖率</span>
                    <span className="font-mono text-emerald-300 font-semibold">
                      {(localData.config as TestGeneratorConfig)?.targetCoverage ?? 85}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="100"
                    step="5"
                    value={
                      (localData.config as TestGeneratorConfig)?.targetCoverage ?? 85
                    }
                    onChange={(e) =>
                      handleConfigChange(
                        "targetCoverage",
                        parseInt(e.target.value, 10)
                      )
                    }
                    className="w-full accent-emerald-500 cursor-pointer h-1.5"
                  />
                </div>

                <div className="flex items-center justify-between p-2 rounded-md bg-slate-900 border border-slate-800">
                  <div className="text-[11px]">
                    <span className="text-slate-300 font-medium block">
                      自动 Mock 外部依赖
                    </span>
                    <span className="text-[10px] text-slate-500">
                      自动为外部 HTTP 与 DB 注入 Stub
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={
                      (localData.config as TestGeneratorConfig)?.mockMode ?? true
                    }
                    onChange={(e) =>
                      handleConfigChange("mockMode", e.target.checked)
                    }
                    className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-800 text-emerald-500"
                  />
                </div>
              </div>
            )}

            {selectedNode.type === "diff_export" && (
              <div className="pt-2.5 border-t border-slate-800/80 space-y-2.5">
                <span className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-1">
                  <GitCompare className="h-3 w-3" />
                  差异导出配置
                </span>

                <div>
                  <label className="text-[10px] font-medium text-slate-400 mb-0.5 block">
                    导出产物格式
                  </label>
                  <select
                    value={
                      (localData.config as DiffExportConfig)?.exportFormat ||
                      "unified_diff"
                    }
                    onChange={(e) =>
                      handleConfigChange("exportFormat", e.target.value)
                    }
                    className="w-full px-2 py-1 text-xs bg-slate-900 border border-slate-800 rounded-md text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="unified_diff">Unified Diff 标准补丁</option>
                    <option value="git_patch">Git Patch (.patch 文件)</option>
                    <option value="json_report">JSON 结构化审查报告</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-medium text-slate-400 mb-0.5 block">
                    产物落盘路径
                  </label>
                  <input
                    type="text"
                    value={
                      (localData.config as DiffExportConfig)?.outputPath ||
                      "./output/patch.diff"
                    }
                    onChange={(e) =>
                      handleConfigChange("outputPath", e.target.value)
                    }
                    className="w-full px-2 py-1 text-xs bg-slate-900 border border-slate-800 rounded-md text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            )}

            {/* Live Streaming Logs Section */}
            {selectedNode && (
              <div className="pt-2.5 border-t border-slate-800/80 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1">
                    <Terminal className="h-3 w-3 text-blue-400" />
                    实时日志 (Live Stream)
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    {(nodeLogs[selectedNode.id] || []).length} 条
                  </span>
                </div>

                <div className="bg-[#080c14] border border-slate-800/90 rounded-md p-2 max-h-36 overflow-y-auto font-mono text-[10px] space-y-1">
                  {(nodeLogs[selectedNode.id] || []).length > 0 ? (
                    (nodeLogs[selectedNode.id] || []).map((log, idx) => (
                      <div key={idx} className="flex items-start gap-1 text-slate-300 leading-tight">
                        <span className="text-blue-500 shrink-0 select-none">›</span>
                        <span className="break-all">{log}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-600 italic py-1 text-center text-[10px]">
                      等待触发执行...
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="pt-2.5 border-t border-slate-800/80">
              <button
                onClick={handleDeleteCurrentNode}
                className="w-full flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-medium text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 rounded-md transition-colors"
              >
                <Trash2 className="h-3 w-3" />
                <span>删除此节点</span>
              </button>
            </div>
          </>
        ) : (
          /* Global Info */
          <div className="space-y-3">
            <div className="p-2.5 bg-slate-900/60 border border-slate-800 rounded-lg">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-200 mb-1">
                <Workflow className="h-3.5 w-3.5 text-blue-400" />
                <span>多 Agent 协同流程</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                当前工作流已配置 4 类标准化节点。点击画布中的节点可在此微调其提示词、模型温度与断言策略。
              </p>
            </div>

            <div className="space-y-1.5 text-xs text-slate-400">
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span>画布节点总数</span>
                <span className="font-mono text-slate-200">{nodes.length}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span>拓扑依赖连线</span>
                <span className="font-mono text-slate-200">{edges.length}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span>调度引擎</span>
                <span className="font-mono text-slate-200">FastAPI + Kahn DAG</span>
              </div>
            </div>

            <div className="p-2 rounded-md border border-blue-500/20 bg-blue-500/5 text-[10px] text-blue-300">
              💡 提示：抽屉采用浮动层设计，不挤压中间画布；可按 Esc 或点击空白区域收起。
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
