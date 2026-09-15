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
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Lock,
  ChevronDown,
  BellRing,
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
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                    <FileCode2 className="h-3 w-3" />
                    门禁触发范围与过滤策略
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 font-mono">
                    Scope & Filter
                  </span>
                </div>

                <div>
                  <label className="text-[10px] font-medium text-slate-400 mb-0.5 block">
                    门禁触发时机 (Git Hook Event)
                  </label>
                  <select
                    value={(localData.config as CodeInputConfig)?.triggerEvent || "pre-commit"}
                    onChange={(e) =>
                      handleConfigChange("triggerEvent", e.target.value)
                    }
                    className="w-full px-2 py-1 text-xs bg-slate-900 border border-slate-800 rounded-md text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
                  >
                    <option value="pre-commit">pre-commit (本地提交前拦截 · 毫秒级推荐)</option>
                    <option value="pre-push">pre-push (推送到远程分支前拦截)</option>
                    <option value="pull-request">pull-request (CI / PR 合入前门禁卡点)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-medium text-slate-400 mb-0.5 block">
                    主要开发语言
                  </label>
                  <select
                    value={(localData.config as CodeInputConfig)?.language || "typescript"}
                    onChange={(e) =>
                      handleConfigChange("language", e.target.value)
                    }
                    className="w-full px-2 py-1 text-xs bg-slate-900 border border-slate-800 rounded-md text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
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
                    拦截文件匹配模式 (Glob 表达式)
                  </label>
                  <input
                    type="text"
                    value={
                      Array.isArray((localData.config as CodeInputConfig)?.filePatterns)
                        ? (localData.config as CodeInputConfig).filePatterns!.join(", ")
                        : "**/*.ts, **/*.tsx, **/*.js, **/*.jsx, **/*.py"
                    }
                    onChange={(e) =>
                      handleConfigChange(
                        "filePatterns",
                        e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                      )
                    }
                    placeholder="**/*.ts, **/*.py"
                    className="w-full px-2.5 py-1 text-xs bg-slate-900 border border-slate-800 rounded-md text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    多个模式用英文逗号分隔，仅匹配的文件会触发门禁扫描
                  </span>
                </div>

                <div>
                  <label className="text-[10px] font-medium text-slate-400 mb-0.5 block">
                    排除/忽略目录 (Ignored Dirs)
                  </label>
                  <input
                    type="text"
                    value={
                      Array.isArray((localData.config as CodeInputConfig)?.ignoredDirs)
                        ? (localData.config as CodeInputConfig).ignoredDirs!.join(", ")
                        : "node_modules, dist, .next, build, coverage"
                    }
                    onChange={(e) =>
                      handleConfigChange(
                        "ignoredDirs",
                        e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                      )
                    }
                    placeholder="node_modules, dist, build"
                    className="w-full px-2.5 py-1 text-xs bg-slate-900 border border-slate-800 rounded-md text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-medium text-slate-400 mb-0.5 block">
                    单文件扫描大小上限 (KB)
                  </label>
                  <input
                    type="number"
                    min={50}
                    max={5000}
                    step={50}
                    value={(localData.config as CodeInputConfig)?.maxFileSizeKb ?? 500}
                    onChange={(e) =>
                      handleConfigChange(
                        "maxFileSizeKb",
                        parseInt(e.target.value, 10) || 500
                      )
                    }
                    className="w-full px-2.5 py-1 text-xs bg-slate-900 border border-slate-800 rounded-md text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Collapsible Sandbox Mock Code for UI Testing */}
                <details className="border border-slate-800 rounded-lg p-2 bg-slate-900/40 group">
                  <summary className="text-[11px] text-amber-300 font-medium cursor-pointer select-none list-none flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <ChevronDown className="h-3 w-3 group-open:rotate-180 transition-transform text-slate-400" />
                      仿真测试用例片段 (用于策略实测)
                    </span>
                    <span className="text-[9px] text-slate-500 font-normal">点击展开/折叠</span>
                  </summary>
                  <div className="mt-2 space-y-1.5">
                    <textarea
                      rows={5}
                      value={
                        (localData.config as CodeInputConfig)?.sampleCode || ""
                      }
                      onChange={(e) =>
                        handleConfigChange("sampleCode", e.target.value)
                      }
                      placeholder="输入待测试的代码片段，用于在平台中验证门禁策略实测效果..."
                      className="w-full px-2.5 py-1 text-xs bg-[#080c14] border border-slate-800 rounded-md text-slate-300 font-mono focus:outline-none focus:border-amber-500 resize-none leading-normal"
                    />
                  </div>
                </details>
              </div>
            )}

            {selectedNode.type === "llm_review" && (
              <div className="pt-2.5 border-t border-slate-800/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    代码安全与漏洞审查策略
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-300 font-mono">
                    Security & Rules
                  </span>
                </div>

                <div>
                  <label className="text-[10px] font-medium text-slate-400 mb-0.5 block flex items-center justify-between">
                    <span>驱动推演模型</span>
                    <Cpu className="h-3 w-3 text-slate-500" />
                  </label>
                  <select
                    value={(localData.config as LLMReviewConfig)?.model || "AI/deekseek-v4-flash-0731"}
                    onChange={(e) =>
                      handleConfigChange("model", e.target.value)
                    }
                    className="w-full px-2 py-1 text-xs bg-slate-900 border border-slate-800 rounded-md text-slate-200 focus:outline-none focus:border-purple-500"
                  >
                    <option value="AI/deekseek-v4-flash-0731">DeepSeek-V4 Flash (推荐: 毫秒级推演)</option>
                    <option value="deepseek-v3">DeepSeek-V3 (企业标准平衡版)</option>
                    <option value="qwen-2.5-coder">Qwen 2.5 Coder 32B</option>
                    <option value="deepseek-r1">DeepSeek-R1 (深度思维推理)</option>
                  </select>
                </div>

                {/* Severity Level Selection */}
                <div>
                  <label className="text-[10px] font-medium text-slate-400 mb-1 block">
                    门禁严格等级 (Severity Level)
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: "strict", label: "极严阻断", desc: "高危中危全阻断" },
                      { id: "standard", label: "企业标准", desc: "阻断致命缺陷" },
                      { id: "relaxed", label: "宽松告警", desc: "仅终端告警" },
                    ].map((lvl) => {
                      const cur = (localData.config as LLMReviewConfig)?.severityLevel || "strict";
                      const isSel = cur === lvl.id;
                      return (
                        <button
                          key={lvl.id}
                          type="button"
                          onClick={() => handleConfigChange("severityLevel", lvl.id)}
                          className={cn(
                            "px-2 py-1.5 rounded-lg border text-center transition-all",
                            isSel
                              ? "bg-purple-600/20 border-purple-500/50 text-purple-200 font-semibold"
                              : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300"
                          )}
                        >
                          <div className="text-[11px]">{lvl.label}</div>
                          <div className="text-[9px] text-slate-500 mt-0.5">{lvl.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Enterprise Security Hard Rules */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    专项防御红线 (Enterprise Hard Rules)
                  </span>

                  {/* Rule 1: Null Deref */}
                  <label className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800/80 cursor-pointer hover:border-slate-700 transition-colors">
                    <div className="min-w-0 pr-2">
                      <div className="text-[11px] font-medium text-slate-200 flex items-center gap-1.5">
                        <ShieldAlert className="h-3 w-3 text-rose-400 shrink-0" />
                        <span>阻断未定义解构与空指针风险</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        如 user.wallet.balance 崩溃隐患
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={(localData.config as LLMReviewConfig)?.blockNullDeref ?? true}
                      onChange={(e) => handleConfigChange("blockNullDeref", e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-800 text-purple-500"
                    />
                  </label>

                  {/* Rule 2: SQL Injection */}
                  <label className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800/80 cursor-pointer hover:border-slate-700 transition-colors">
                    <div className="min-w-0 pr-2">
                      <div className="text-[11px] font-medium text-slate-200 flex items-center gap-1.5">
                        <ShieldAlert className="h-3 w-3 text-rose-400 shrink-0" />
                        <span>阻断 SQL / 命令拼接与注入漏洞</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        强制参数化查询，杜绝动态字符串拼接
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={(localData.config as LLMReviewConfig)?.blockSqlInjection ?? true}
                      onChange={(e) => handleConfigChange("blockSqlInjection", e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-800 text-purple-500"
                    />
                  </label>

                  {/* Rule 3: Hardcoded Secrets */}
                  <label className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800/80 cursor-pointer hover:border-slate-700 transition-colors">
                    <div className="min-w-0 pr-2">
                      <div className="text-[11px] font-medium text-slate-200 flex items-center gap-1.5">
                        <Lock className="h-3 w-3 text-amber-400 shrink-0" />
                        <span>阻断明文秘钥 / Token 硬编码泄露</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        严禁在源码中写入 API Key、私钥或密码
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={(localData.config as LLMReviewConfig)?.blockHardcodedSecrets ?? true}
                      onChange={(e) => handleConfigChange("blockHardcodedSecrets", e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-800 text-purple-500"
                    />
                  </label>

                  {/* Rule 4: Dangerous Eval */}
                  <label className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800/80 cursor-pointer hover:border-slate-700 transition-colors">
                    <div className="min-w-0 pr-2">
                      <div className="text-[11px] font-medium text-slate-200 flex items-center gap-1.5">
                        <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />
                        <span>阻断危险 eval / Function 动态执行</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        防止任意代码执行逃逸
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={(localData.config as LLMReviewConfig)?.blockDangerousEval ?? true}
                      onChange={(e) => handleConfigChange("blockDangerousEval", e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-800 text-purple-500"
                    />
                  </label>
                </div>

                {/* Aspects */}
                <div>
                  <label className="text-[10px] font-medium text-slate-400 mb-1 block">
                    重点关注维度 (多选)
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
                          className={cn(
                            "px-1.5 py-1 rounded text-[10px] border text-left flex items-center gap-1 transition-colors",
                            isChecked
                              ? "bg-purple-500/15 border-purple-500/40 text-purple-300"
                              : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300"
                          )}
                        >
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              isChecked ? "bg-purple-400" : "bg-slate-600"
                            )}
                          />
                          <span className="truncate">{aspect}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Advanced Prompt Template in Details */}
                <details className="border border-slate-800 rounded-lg p-2 bg-slate-900/40 group">
                  <summary className="text-[11px] text-purple-300 font-medium cursor-pointer select-none list-none flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <ChevronDown className="h-3 w-3 group-open:rotate-180 transition-transform text-slate-400" />
                      高级 Prompt 与推演温度微调
                    </span>
                    <span className="text-[9px] text-slate-500 font-normal">点击展开</span>
                  </summary>
                  <div className="mt-2 space-y-2">
                    <div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                        <span>Temperature</span>
                        <span className="font-mono text-purple-300 font-semibold">
                          {((localData.config as LLMReviewConfig)?.temperature ?? 0.1).toFixed(2)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={(localData.config as LLMReviewConfig)?.temperature ?? 0.1}
                        onChange={(e) =>
                          handleConfigChange("temperature", parseFloat(e.target.value))
                        }
                        className="w-full accent-purple-500 cursor-pointer h-1.5"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-slate-400 mb-0.5 block">
                        自定义审查 Prompt 模板
                      </label>
                      <textarea
                        rows={3}
                        value={
                          (localData.config as LLMReviewConfig)?.promptTemplate || ""
                        }
                        onChange={(e) =>
                          handleConfigChange("promptTemplate", e.target.value)
                        }
                        className="w-full px-2 py-1 text-xs bg-slate-900 border border-slate-800 rounded-md text-slate-300 font-mono focus:outline-none focus:border-purple-500 resize-none leading-normal"
                      />
                    </div>
                  </div>
                </details>
              </div>
            )}

            {selectedNode.type === "test_generator" && (
              <div className="pt-2.5 border-t border-slate-800/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                    <TestTube2 className="h-3 w-3" />
                    单元测试红线与覆盖率卡点
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-mono">
                    Tests & Coverage
                  </span>
                </div>

                {/* Enforce Tests Switch */}
                <label className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800/80 cursor-pointer hover:border-slate-700 transition-colors">
                  <div className="min-w-0 pr-2">
                    <div className="text-[11px] font-medium text-slate-200 flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <span>强制单测覆盖卡点 (Enforce Tests)</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      若核心业务代码改动但未编写通过单测，直接触发门禁拦截
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={(localData.config as TestGeneratorConfig)?.enforceTests ?? true}
                    onChange={(e) => handleConfigChange("enforceTests", e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-800 text-emerald-500"
                  />
                </label>

                <div>
                  <label className="text-[10px] font-medium text-slate-400 mb-0.5 block">
                    测试运行框架
                  </label>
                  <select
                    value={
                      (localData.config as TestGeneratorConfig)?.framework || "jest"
                    }
                    onChange={(e) =>
                      handleConfigChange("framework", e.target.value)
                    }
                    className="w-full px-2 py-1 text-xs bg-slate-900 border border-slate-800 rounded-md text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                  >
                    <option value="jest">Jest (TS/JS 常用)</option>
                    <option value="vitest">Vitest (Next/Vite 高速测试)</option>
                    <option value="pytest">PyTest (Python)</option>
                    <option value="unittest">Unittest (Python 标准库)</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                    <span>目标行覆盖率门槛</span>
                    <span className="font-mono text-emerald-300 font-semibold">
                      {(localData.config as TestGeneratorConfig)?.targetCoverage ?? 80}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="100"
                    step="5"
                    value={
                      (localData.config as TestGeneratorConfig)?.targetCoverage ?? 80
                    }
                    onChange={(e) =>
                      handleConfigChange(
                        "targetCoverage",
                        parseInt(e.target.value, 10)
                      )
                    }
                    className="w-full accent-emerald-500 cursor-pointer h-1.5"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500 mt-0.5 font-mono">
                    <span>50% (基础)</span>
                    <span>80% (标准推荐)</span>
                    <span>100% (航天级)</span>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-medium text-slate-400 mb-0.5 block">
                    沙箱运行超时限制 (秒)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={120}
                    value={(localData.config as TestGeneratorConfig)?.sandboxTimeoutSec ?? 30}
                    onChange={(e) =>
                      handleConfigChange(
                        "sandboxTimeoutSec",
                        parseInt(e.target.value, 10) || 30
                      )
                    }
                    className="w-full px-2.5 py-1 text-xs bg-slate-900 border border-slate-800 rounded-md text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex items-center justify-between p-2 rounded-md bg-slate-900 border border-slate-800">
                  <div className="text-[11px]">
                    <span className="text-slate-300 font-medium block">
                      自动隔离并 Mock 外部依赖
                    </span>
                    <span className="text-[10px] text-slate-500">
                      自动为外部 HTTP 与 DB 注入 Stub，保证测试纯粹性
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
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-1">
                    <GitCompare className="h-3 w-3" />
                    门禁决策与产物输出
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 font-mono">
                    Enforce & Output
                  </span>
                </div>

                {/* Gatekeeper Failure Action */}
                <div>
                  <label className="text-[10px] font-medium text-slate-400 mb-1 block">
                    检测到违规时的门禁决策 (Failure Action)
                  </label>
                  <div className="space-y-1.5">
                    {[
                      {
                        id: "block_commit",
                        label: "🚨 强行拦截并阻断 (Exit 1)",
                        desc: "开发者终端提交失败，必须修复所有红线缺陷",
                      },
                      {
                        id: "warn_only",
                        label: "⚠️ 弱告警放行 (Warning)",
                        desc: "终端打印警告与修复建议，允许提交并记录审计日志",
                      },
                      {
                        id: "create_review_pr",
                        label: "🔄 自动打回并生成评审补丁",
                        desc: "生成修复 Patch 并自动推送到审查流水线",
                      },
                    ].map((act) => {
                      const cur = (localData.config as DiffExportConfig)?.failureAction || "block_commit";
                      const isSel = cur === act.id;
                      return (
                        <label
                          key={act.id}
                          className={cn(
                            "flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-all",
                            isSel
                              ? "bg-cyan-950/30 border-cyan-500/50 text-cyan-200"
                              : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700"
                          )}
                        >
                          <input
                            type="radio"
                            name="failureAction"
                            value={act.id}
                            checked={isSel}
                            onChange={() => handleConfigChange("failureAction", act.id)}
                            className="mt-0.5 text-cyan-500 bg-slate-800 border-slate-700"
                          />
                          <div className="min-w-0">
                            <div className="text-[11px] font-semibold text-slate-200">
                              {act.label}
                            </div>
                            <div className="text-[10px] text-slate-500 leading-tight mt-0.5">
                              {act.desc}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-medium text-slate-400 mb-0.5 block flex items-center gap-1">
                    <BellRing className="h-3 w-3 text-cyan-400" />
                    <span>即时消息通知联动 (DevOps Webhook)</span>
                  </label>
                  <select
                    value={(localData.config as DiffExportConfig)?.notifyChannel || "none"}
                    onChange={(e) =>
                      handleConfigChange("notifyChannel", e.target.value)
                    }
                    className="w-full px-2 py-1 text-xs bg-slate-900 border border-slate-800 rounded-md text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="none">无外部通知 (仅本地与平台审计)</option>
                    <option value="feishu">飞书机器人 Webhook (企业大群推送)</option>
                    <option value="dingtalk">钉钉群机器人 Webhook</option>
                    <option value="slack">Slack DevOps #quality-alerts</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-medium text-slate-400 mb-0.5 block">
                    差异产物导出格式
                  </label>
                  <select
                    value={
                      (localData.config as DiffExportConfig)?.exportFormat ||
                      "unified_diff"
                    }
                    onChange={(e) =>
                      handleConfigChange("exportFormat", e.target.value)
                    }
                    className="w-full px-2 py-1 text-xs bg-slate-900 border border-slate-800 rounded-md text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="unified_diff">Unified Diff 标准补丁格式</option>
                    <option value="git_patch">Git Patch (.patch 文件)</option>
                    <option value="json_report">JSON 结构化审查审计报告</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-medium text-slate-400 mb-0.5 block">
                    补丁文件落盘路径
                  </label>
                  <input
                    type="text"
                    value={
                      (localData.config as DiffExportConfig)?.outputPath ||
                      "./output/gatekeeper-patch.diff"
                    }
                    onChange={(e) =>
                      handleConfigChange("outputPath", e.target.value)
                    }
                    className="w-full px-2 py-1 text-xs bg-slate-900 border border-slate-800 rounded-md text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
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
