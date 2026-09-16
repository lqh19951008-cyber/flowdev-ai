"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Sliders,
  Trash2,
  Cpu,
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
  Play,
  Layers,
  BookOpen,
  Info,
  CheckCircle2,
  Bot,
  SlidersHorizontal,
} from "lucide-react";


import {
  Input,
  Textarea,
  Select,
  SelectItem,
  Switch,
  Slider,
  Button,
  Tabs,
  Tab,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Divider,
} from "@heroui/react";
import { useFlowStore } from "@/stores/useFlowStore";
import {
  CodeInputConfig,
  LLMReviewConfig,
  TestGeneratorConfig,
  DiffExportConfig,
  FlowNodeData,
  FlowNodeType,
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

const NODE_TYPE_META: Record<
  FlowNodeType,
  {
    title: string;
    tag: string;
    color: "warning" | "secondary" | "success" | "primary";
    icon: React.ElementType;
    bgLight: string;
    textLight: string;
  }
> = {
  code_input: {
    title: "触发范围与过滤",
    tag: "Scope & Filter",
    color: "warning",
    icon: FileCode2,
    bgLight: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    textLight: "text-amber-600 dark:text-amber-400",
  },
  llm_review: {
    title: "代码安全与审查",
    tag: "Security & Rules",
    color: "secondary",
    icon: Sparkles,
    bgLight: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    textLight: "text-purple-600 dark:text-purple-400",
  },
  test_generator: {
    title: "单测覆盖率卡点",
    tag: "Tests & Coverage",
    color: "success",
    icon: TestTube2,
    bgLight: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    textLight: "text-emerald-600 dark:text-emerald-400",
  },
  diff_export: {
    title: "门禁决策与产物",
    tag: "Enforce & Output",
    color: "primary",
    icon: GitCompare,
    bgLight: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    textLight: "text-blue-600 dark:text-blue-400",
  },
};

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
    setNodeStatus,
    appendNodeLog,
    setSettingsModalOpen,
  } = useFlowStore();


  const [activeTab, setActiveTab] = useState<string>("config");
  const [localData, setLocalData] = useState<FlowNodeData | null>(() => selectedNode?.data || null);
  const [isSandboxOpen, setIsSandboxOpen] = useState<boolean>(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const activeData = localData || selectedNode?.data || null;

  useEffect(() => {
    if (selectedNode) {
      setLocalData(selectedNode.data);
    } else {
      setLocalData(null);
    }
  }, [selectedNode?.id]);

  // Support pressing Esc key to close drawer
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
    if (!selectedNode) return;
    const current = localData || selectedNode.data;
    const updated: FlowNodeData = { ...current, [key]: value };
    setLocalData(updated);
    syncToStore({ [key]: value });
  };

  const handleConfigChange = (configKey: string, value: unknown) => {
    if (!selectedNode) return;
    const current = localData || selectedNode.data;
    const updatedConfig = {
      ...(current.config || {}),
      [configKey]: value,
    };
    const updatedData: FlowNodeData = { ...current, config: updatedConfig };
    setLocalData(updatedData);
    syncToStore({ config: updatedConfig });
  };

  const toggleAspect = (aspect: string) => {
    if (!selectedNode) return;
    const current = localData || selectedNode.data;
    const currentConfig = (current.config || {}) as Partial<LLMReviewConfig>;
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
    toggleDrawer(false);
  };

  const handleSimulateCurrentNode = () => {
    if (!selectedNode || !activeData) return;
    setNodeStatus(selectedNode.id, "running");
    appendNodeLog(
      selectedNode.id,
      `[SIMULATE] 启动单算子推演实测: ${activeData.label}`
    );
    setTimeout(() => {
      appendNodeLog(
        selectedNode.id,
        `[SUCCESS] 规则推演与沙箱断言验证通过 (耗时 38ms)`
      );
      setNodeStatus(selectedNode.id, "completed");
    }, 650);
  };

  const nodeMeta = selectedNode
    ? NODE_TYPE_META[selectedNode.type as FlowNodeType] || {
        title: "算子属性",
        tag: "Node",
        color: "primary" as const,
        icon: Sliders,
        bgLight: "bg-blue-500/10 text-blue-600",
        textLight: "text-blue-600",
      }
    : null;

  const currentLogs = selectedNode ? nodeLogs[selectedNode.id] || [] : [];

  return (
    <aside
      className={cn(
        "absolute right-0 top-0 bottom-0 z-30 w-[420px] max-w-[90vw] md:max-w-[420px] border-l border-slate-200/90 dark:border-slate-800/90 bg-white/95 dark:bg-[#0d131f]/95 backdrop-blur-md shadow-2xl transition-all duration-300 ease-in-out flex flex-col select-none",
        isDrawerOpen
          ? "translate-x-0 opacity-100 pointer-events-auto"
          : "translate-x-full opacity-0 pointer-events-none"
      )}
    >
      {/* Drawer Header */}
      <div className="h-14 px-4 border-b border-slate-200/90 dark:border-slate-800/90 bg-slate-50/70 dark:bg-slate-900/60 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          {nodeMeta ? (
            <div
              className={cn(
                "h-8 w-8 rounded-xl flex items-center justify-center shrink-0 shadow-xs",
                nodeMeta.bgLight
              )}
            >
              <nodeMeta.icon className="h-4 w-4" />
            </div>
          ) : (
            <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Workflow className="h-4 w-4" />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                {selectedNode ? activeData?.label || "算子节点" : "工作流全局配置"}
              </span>
              {nodeMeta && (
                <Chip
                  size="sm"
                  variant="flat"
                  color={nodeMeta.color}
                  className="h-5 text-[10px] font-mono px-1.5"
                >
                  {nodeMeta.tag}
                </Chip>
              )}
            </div>
            <div className="text-[10px] text-slate-400 truncate">
              {selectedNode
                ? `ID: ${selectedNode.id}`
                : "FastAPI + Kahn DAG 调度策略"}
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            toggleDrawer(false);
            setSelectedNode(null);
          }}
          className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
          title="收起抽屉 (Esc)"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Top Segmented Navigation Tabs */}
      {selectedNode && (
        <div className="px-4 pt-2.5 pb-1 border-b border-slate-200/70 dark:border-slate-800/70 bg-white/50 dark:bg-slate-900/30">
          <Tabs
            size="sm"
            fullWidth
            variant="underlined"
            color="primary"
            selectedKey={activeTab}
            onSelectionChange={(k) => setActiveTab(k as string)}
            classNames={{
              tabList: "gap-4 border-b-0",
              cursor: "w-full bg-blue-500",
              tab: "h-8 px-2 text-xs font-semibold data-[selected=true]:text-blue-600 dark:data-[selected=true]:text-blue-400",
            }}
          >
            <Tab
              key="config"
              title={
                <div className="flex items-center gap-1.5">
                  <Sliders className="h-3.5 w-3.5" />
                  <span>策略参数</span>
                </div>
              }
            />
            <Tab
              key="logs"
              title={
                <div className="flex items-center gap-1.5">
                  <Terminal className="h-3.5 w-3.5" />
                  <span>推演日志</span>
                  {currentLogs.length > 0 && (
                    <Chip size="sm" variant="solid" color="primary" className="h-4 px-1 text-[9px] font-mono">
                      {currentLogs.length}
                    </Chip>
                  )}
                </div>
              }
            />
            <Tab
              key="guide"
              title={
                <div className="flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>算子标准</span>
                </div>
              }
            />
          </Tabs>
        </div>
      )}

      {/* Content Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {selectedNode && activeData ? (
          <>
            {/* TAB 1: 策略参数 (CONFIG) */}
            {activeTab === "config" && (
              <div className="space-y-4">
                {/* 1. 基础属性 (General Info) */}
                <Card
                  shadow="none"
                  className="border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/40 rounded-2xl"
                >
                  <CardHeader className="px-3.5 pt-3 pb-1 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-blue-500" />
                      节点基础定义
                    </span>
                  </CardHeader>
                  <CardBody className="p-3.5 pt-1 space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                        节点标识名称 (Label)
                      </label>
                      <Input
                        size="sm"
                        variant="bordered"
                        aria-label="节点标识名称"
                        placeholder="输入算子展示名称..."
                        value={activeData.label || ""}
                        onValueChange={(val) => handleFieldChange("label", val)}
                        classNames={{
                          inputWrapper:
                            "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 hover:border-slate-400 dark:hover:border-slate-600 shadow-xs rounded-xl h-10 min-h-10",
                          input: "text-xs text-slate-800 dark:text-slate-200 font-medium",
                        }}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                        职责功能说明 (Description)
                      </label>
                      <Textarea
                        size="sm"
                        variant="bordered"
                        aria-label="职责功能说明"
                        placeholder="说明该算子在 CI 流程中的防御目标与检查范围..."
                        minRows={2}
                        maxRows={3}
                        value={activeData.description || ""}
                        onValueChange={(val) => handleFieldChange("description", val)}
                        classNames={{
                          inputWrapper:
                            "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 hover:border-slate-400 dark:hover:border-slate-600 shadow-xs rounded-xl",
                          input: "text-xs text-slate-800 dark:text-slate-200 leading-relaxed",
                        }}
                      />
                    </div>
                  </CardBody>
                </Card>

                {/* 2. 节点特异配置 - CODE_INPUT */}
                {selectedNode.type === "code_input" && (
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between px-0.5">
                      <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                        <FileCode2 className="h-3.5 w-3.5" />
                        触发范围与白名单过滤
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                        门禁触发时机 (Git Hook Event)
                      </label>
                      <Select
                        size="sm"
                        variant="bordered"
                        aria-label="门禁触发时机"
                        selectedKeys={new Set([(activeData.config as CodeInputConfig)?.triggerEvent || "pre-commit"])}
                        onSelectionChange={(keys) => {
                          const val = Array.from(keys)[0] as string;
                          if (val) handleConfigChange("triggerEvent", val);
                        }}
                        classNames={{
                          trigger:
                            "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 hover:border-slate-400 dark:hover:border-slate-600 shadow-xs rounded-xl h-10 min-h-10",
                          value: "text-xs text-slate-800 dark:text-slate-200 font-medium",
                        }}
                      >
                        <SelectItem key="pre-commit">pre-commit (本地提交前拦截 · 毫秒级阻断)</SelectItem>
                        <SelectItem key="pre-push">pre-push (推送到远程分支前全量扫描)</SelectItem>
                        <SelectItem key="pull-request">pull-request (CI/CD PR 合入前门禁卡点)</SelectItem>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                        代码分析主要语言
                      </label>
                      <Select
                        size="sm"
                        variant="bordered"
                        aria-label="代码分析主要语言"
                        selectedKeys={new Set([(activeData.config as CodeInputConfig)?.language || "typescript"])}
                        onSelectionChange={(keys) => {
                          const val = Array.from(keys)[0] as string;
                          if (val) handleConfigChange("language", val);
                        }}
                        classNames={{
                          trigger:
                            "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 hover:border-slate-400 dark:hover:border-slate-600 shadow-xs rounded-xl h-10 min-h-10",
                          value: "text-xs text-slate-800 dark:text-slate-200 font-medium",
                        }}
                      >
                        <SelectItem key="typescript">TypeScript (.ts/.tsx)</SelectItem>
                        <SelectItem key="javascript">JavaScript (.js/.jsx)</SelectItem>
                        <SelectItem key="python">Python (.py)</SelectItem>
                        <SelectItem key="go">Go (.go)</SelectItem>
                        <SelectItem key="java">Java (.java)</SelectItem>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          拦截文件匹配模式 (Glob 表达式)
                        </label>
                        <span className="text-[10px] text-slate-400">仅匹配文件触发</span>
                      </div>
                      <Input
                        size="sm"
                        variant="bordered"
                        aria-label="拦截文件匹配模式"
                        value={
                          Array.isArray((activeData.config as CodeInputConfig)?.filePatterns)
                            ? (activeData.config as CodeInputConfig).filePatterns!.join(", ")
                            : "**/*.ts, **/*.tsx, **/*.js, **/*.jsx, **/*.py"
                        }
                        onValueChange={(val) =>
                          handleConfigChange(
                            "filePatterns",
                            val.split(",").map((s) => s.trim()).filter(Boolean)
                          )
                        }
                        classNames={{
                          inputWrapper:
                            "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 hover:border-slate-400 dark:hover:border-slate-600 shadow-xs rounded-xl font-mono h-10 min-h-10",
                          input: "text-xs text-slate-800 dark:text-slate-200",
                        }}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                        排除与忽略目录 (Ignored Dirs)
                      </label>
                      <Input
                        size="sm"
                        variant="bordered"
                        aria-label="排除与忽略目录"
                        value={
                          Array.isArray((activeData.config as CodeInputConfig)?.ignoredDirs)
                            ? (activeData.config as CodeInputConfig).ignoredDirs!.join(", ")
                            : "node_modules, dist, .next, build, coverage"
                        }
                        onValueChange={(val) =>
                          handleConfigChange(
                            "ignoredDirs",
                            val.split(",").map((s) => s.trim()).filter(Boolean)
                          )
                        }
                        classNames={{
                          inputWrapper:
                            "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 hover:border-slate-400 dark:hover:border-slate-600 shadow-xs rounded-xl font-mono h-10 min-h-10",
                          input: "text-xs text-slate-800 dark:text-slate-200",
                        }}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                        单文件扫描大小限制 (KB)
                      </label>
                      <Input
                        size="sm"
                        variant="bordered"
                        type="number"
                        aria-label="单文件扫描大小限制"
                        endContent={<span className="text-xs text-slate-400 font-mono">KB</span>}
                        min={50}
                        max={5000}
                        step={50}
                        value={String((activeData.config as CodeInputConfig)?.maxFileSizeKb ?? 500)}
                        onValueChange={(val) =>
                          handleConfigChange("maxFileSizeKb", parseInt(val, 10) || 500)
                        }
                        classNames={{
                          inputWrapper:
                            "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 hover:border-slate-400 dark:hover:border-slate-600 shadow-xs rounded-xl font-mono h-10 min-h-10",
                          input: "text-xs text-slate-800 dark:text-slate-200",
                        }}
                      />
                    </div>

                    {/* Collapsible Sandbox Mock Code */}
                    <Card
                      shadow="none"
                      className="border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/40 rounded-2xl overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => setIsSandboxOpen((v) => !v)}
                        className="w-full px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                          <ChevronDown
                            className={cn(
                              "h-3.5 w-3.5 text-slate-400 transition-transform duration-200",
                              isSandboxOpen && "rotate-180"
                            )}
                          />
                          仿真测试用例片段 (用于策略实测)
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {isSandboxOpen ? "收起" : "展开编辑"}
                        </span>
                      </button>
                      {isSandboxOpen && (
                        <div className="p-3 pt-0 border-t border-slate-200/60 dark:border-slate-800/60 mt-1">
                          <Textarea
                            size="sm"
                            variant="bordered"
                            aria-label="仿真测试用例代码片段"
                            placeholder="输入待测试的代码片段，用于在平台中验证门禁策略实测效果..."
                            minRows={4}
                            value={(activeData.config as CodeInputConfig)?.sampleCode || ""}
                            onValueChange={(val) => handleConfigChange("sampleCode", val)}
                            classNames={{
                              inputWrapper:
                                "border-slate-200 dark:border-slate-800 bg-white dark:bg-[#080c14] font-mono text-xs rounded-xl mt-2",
                            }}
                          />
                        </div>
                      )}
                    </Card>
                  </div>
                )}

                {/* 2. 节点特异配置 - LLM_REVIEW */}
                {selectedNode.type === "llm_review" && (
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between px-0.5">
                      <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5" />
                        代码安全与漏洞审查策略
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                        驱动推演审查大模型
                      </label>
                      <Select
                        size="sm"
                        variant="bordered"
                        aria-label="驱动推演审查大模型"
                        selectedKeys={new Set([(activeData.config as LLMReviewConfig)?.model || "AI/deekseek-v4-flash-0731"])}
                        onSelectionChange={(keys) => {
                          const val = Array.from(keys)[0] as string;
                          if (val) handleConfigChange("model", val);
                        }}
                        classNames={{
                          trigger:
                            "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 hover:border-slate-400 dark:hover:border-slate-600 shadow-xs rounded-xl h-10 min-h-10",
                          value: "text-xs text-slate-800 dark:text-slate-200 font-medium",
                        }}
                      >
                        <SelectItem key="AI/deekseek-v4-flash-0731">DeepSeek-V4 Flash (推荐 · 毫秒级推演)</SelectItem>
                        <SelectItem key="deepseek-chat">DeepSeek-V3 / Chat (企业标准平衡版)</SelectItem>
                        <SelectItem key="gpt-4o">OpenAI GPT-4o</SelectItem>
                        <SelectItem key="qwen-2.5-coder">Qwen 2.5 Coder 32B</SelectItem>
                        <SelectItem key="deepseek-r1">DeepSeek-R1 (深度思维推理模式)</SelectItem>
                      </Select>
                      <input
                        type="text"
                        value={(activeData.config as LLMReviewConfig)?.model || ""}
                        onChange={(e) => handleConfigChange("model", e.target.value)}
                        placeholder="或输入任意企业自定义模型 (如: AI/deekseek-v4-flash-0731)"
                        className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                      />
                    </div>


                    {/* Segmented Pill Selector for Severity Level */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          门禁严格等级 (Severity Level)
                        </label>
                        <Chip
                          size="sm"
                          variant="flat"
                          color={
                            (activeData.config as LLMReviewConfig)?.severityLevel === "strict"
                              ? "danger"
                              : (activeData.config as LLMReviewConfig)?.severityLevel === "standard"
                              ? "secondary"
                              : "warning"
                          }
                          className="h-5 text-[10px] font-mono px-1.5"
                        >
                          {(activeData.config as LLMReviewConfig)?.severityLevel || "strict"}
                        </Chip>
                      </div>
                      <Tabs
                        size="sm"
                        fullWidth
                        color={
                          (activeData.config as LLMReviewConfig)?.severityLevel === "strict"
                            ? "danger"
                            : (activeData.config as LLMReviewConfig)?.severityLevel === "standard"
                            ? "secondary"
                            : "warning"
                        }
                        selectedKey={(activeData.config as LLMReviewConfig)?.severityLevel || "strict"}
                        onSelectionChange={(k) => handleConfigChange("severityLevel", k as string)}
                        classNames={{
                          tabList:
                            "bg-slate-100 dark:bg-slate-900/90 p-1 rounded-xl border border-slate-200/80 dark:border-slate-800/80",
                          cursor: "rounded-lg shadow-sm",
                          tab: "h-7 text-xs font-medium",
                        }}
                      >
                        <Tab key="strict" title="🚨 极严阻断" />
                        <Tab key="standard" title="🛡️ 企业标准" />
                        <Tab key="relaxed" title="⚠️ 宽松告警" />
                      </Tabs>
                    </div>

                    {/* Enterprise Hard Rules Cards with HeroUI Switches */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                        专项防御红线 (Enterprise Hard Rules)
                      </label>

                      {/* Rule 1 */}
                      <Card
                        shadow="none"
                        className="border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/60 rounded-xl"
                      >
                        <CardBody className="p-2.5 flex flex-row items-center justify-between gap-2">
                          <div className="min-w-0 pr-2">
                            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                              <ShieldAlert className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                              <span>阻断未定义解构与空指针风险</span>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              如 user.wallet.balance 崩溃隐患
                            </div>
                          </div>
                          <Switch
                            size="sm"
                            color="danger"
                            isSelected={(activeData.config as LLMReviewConfig)?.blockNullDeref ?? true}
                            onValueChange={(val) => handleConfigChange("blockNullDeref", val)}
                            aria-label="阻断未定义解构与空指针风险"
                          />
                        </CardBody>
                      </Card>

                      {/* Rule 2 */}
                      <Card
                        shadow="none"
                        className="border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/60 rounded-xl"
                      >
                        <CardBody className="p-2.5 flex flex-row items-center justify-between gap-2">
                          <div className="min-w-0 pr-2">
                            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                              <ShieldAlert className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                              <span>阻断 SQL / 命令拼接与注入漏洞</span>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              强制参数化查询，杜绝动态拼接
                            </div>
                          </div>
                          <Switch
                            size="sm"
                            color="danger"
                            isSelected={(activeData.config as LLMReviewConfig)?.blockSqlInjection ?? true}
                            onValueChange={(val) => handleConfigChange("blockSqlInjection", val)}
                            aria-label="阻断 SQL 注入"
                          />
                        </CardBody>
                      </Card>

                      {/* Rule 3 */}
                      <Card
                        shadow="none"
                        className="border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/60 rounded-xl"
                      >
                        <CardBody className="p-2.5 flex flex-row items-center justify-between gap-2">
                          <div className="min-w-0 pr-2">
                            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                              <Lock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                              <span>阻断明文秘钥 / Token 硬编码泄露</span>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              严禁写入 API Key、私钥或密码
                            </div>
                          </div>
                          <Switch
                            size="sm"
                            color="warning"
                            isSelected={(activeData.config as LLMReviewConfig)?.blockHardcodedSecrets ?? true}
                            onValueChange={(val) => handleConfigChange("blockHardcodedSecrets", val)}
                            aria-label="阻断明文秘钥泄露"
                          />
                        </CardBody>
                      </Card>

                      {/* Rule 4 */}
                      <Card
                        shadow="none"
                        className="border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/60 rounded-xl"
                      >
                        <CardBody className="p-2.5 flex flex-row items-center justify-between gap-2">
                          <div className="min-w-0 pr-2">
                            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                              <span>阻断危险 eval / Function 动态执行</span>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              防止任意代码执行逃逸
                            </div>
                          </div>
                          <Switch
                            size="sm"
                            color="warning"
                            isSelected={(activeData.config as LLMReviewConfig)?.blockDangerousEval ?? true}
                            onValueChange={(val) => handleConfigChange("blockDangerousEval", val)}
                            aria-label="阻断危险 eval 执行"
                          />
                        </CardBody>
                      </Card>
                    </div>

                    {/* Temperature Slider */}
                    <Card
                      shadow="none"
                      className="border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/60 rounded-xl p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <Cpu className="h-3.5 w-3.5 text-purple-500" />
                          推演随机度 (Temperature)
                        </label>
                        <Chip size="sm" variant="flat" color="secondary" className="h-5 text-xs font-mono font-bold px-1.5">
                          {((activeData.config as LLMReviewConfig)?.temperature ?? 0.1).toFixed(2)}
                        </Chip>
                      </div>
                      <Slider
                        size="sm"
                        color="secondary"
                        aria-label="Temperature"
                        step={0.05}
                        maxValue={1}
                        minValue={0}
                        value={(activeData.config as LLMReviewConfig)?.temperature ?? 0.1}
                        onChange={(val) =>
                          handleConfigChange("temperature", Array.isArray(val) ? val[0] : val)
                        }
                        className="max-w-full"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                        <span>0.0 (严谨确定性)</span>
                        <span>1.0 (高发散性)</span>
                      </div>
                    </Card>

                    {/* Review Aspects using HeroUI Chips */}
                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                        重点审查维度关注 (点击切换)
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {REVIEW_ASPECT_OPTIONS.map((aspect) => {
                          const currentAspects =
                            (activeData.config as LLMReviewConfig)?.reviewAspects || [];
                          const isChecked = currentAspects.includes(aspect);
                          return (
                            <Chip
                              key={aspect}
                              size="sm"
                              variant={isChecked ? "solid" : "bordered"}
                              color={isChecked ? "secondary" : "default"}
                              className={cn(
                                "cursor-pointer transition-all select-none text-xs h-7 px-2",
                                isChecked
                                  ? "shadow-xs"
                                  : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-purple-400"
                              )}
                              onClick={() => toggleAspect(aspect)}
                            >
                              {isChecked ? `✓ ${aspect}` : `+ ${aspect}`}
                            </Chip>
                          );
                        })}
                      </div>
                    </div>

                    {/* Prompt Template Customization */}
                    <Card
                      shadow="none"
                      className="border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/40 rounded-2xl overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => setIsSandboxOpen((v) => !v)}
                        className="w-full px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <span className="text-xs font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                          <ChevronDown
                            className={cn(
                              "h-3.5 w-3.5 text-slate-400 transition-transform duration-200",
                              isSandboxOpen && "rotate-180"
                            )}
                          />
                          高级 Prompt 提示词模板定制
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {isSandboxOpen ? "收起" : "展开"}
                        </span>
                      </button>
                      {isSandboxOpen && (
                        <div className="p-3 pt-0 border-t border-slate-200/60 dark:border-slate-800/60 mt-1">
                          <Textarea
                            size="sm"
                            variant="bordered"
                            aria-label="高级 Prompt 提示词模板"
                            minRows={3}
                            value={(activeData.config as LLMReviewConfig)?.promptTemplate || ""}
                            onValueChange={(val) => handleConfigChange("promptTemplate", val)}
                            classNames={{
                              inputWrapper:
                                "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-mono text-xs rounded-xl mt-2",
                            }}
                          />
                        </div>
                      )}
                    </Card>
                  </div>
                )}

                {/* 2. 节点特异配置 - TEST_GENERATOR */}
                {selectedNode.type === "test_generator" && (
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between px-0.5">
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                        <TestTube2 className="h-3.5 w-3.5" />
                        自动化单测与覆盖率卡点
                      </span>
                    </div>

                    {/* Enforce Tests Switch */}
                    <Card
                      shadow="none"
                      className="border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/60 rounded-xl"
                    >
                      <CardBody className="p-2.5 flex flex-row items-center justify-between gap-2">
                        <div className="min-w-0 pr-2">
                          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                            <span>强制单测覆盖卡点 (Enforce Tests)</span>
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            改动未编写通过单测直接阻止提交
                          </div>
                        </div>
                        <Switch
                          size="sm"
                          color="success"
                          isSelected={(activeData.config as TestGeneratorConfig)?.enforceTests ?? true}
                          onValueChange={(val) => handleConfigChange("enforceTests", val)}
                          aria-label="强制单测卡点"
                        />
                      </CardBody>
                    </Card>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                        测试驱动框架
                      </label>
                      <Select
                        size="sm"
                        variant="bordered"
                        aria-label="测试驱动框架"
                        selectedKeys={new Set([(activeData.config as TestGeneratorConfig)?.framework || "jest"])}
                        onSelectionChange={(keys) => {
                          const val = Array.from(keys)[0] as string;
                          if (val) handleConfigChange("framework", val);
                        }}
                        classNames={{
                          trigger:
                            "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 hover:border-slate-400 dark:hover:border-slate-600 shadow-xs rounded-xl h-10 min-h-10",
                          value: "text-xs text-slate-800 dark:text-slate-200 font-medium",
                        }}
                      >
                        <SelectItem key="jest">Jest (TS/JS 经典推荐)</SelectItem>
                        <SelectItem key="vitest">Vitest (Next/Vite 高速测试)</SelectItem>
                        <SelectItem key="pytest">PyTest (Python 现代测试)</SelectItem>
                        <SelectItem key="unittest">Unittest (Python 标准库)</SelectItem>
                      </Select>
                    </div>

                    {/* Target Coverage Slider */}
                    <Card
                      shadow="none"
                      className="border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/60 rounded-xl p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          目标行覆盖率红线 (%)
                        </label>
                        <Chip size="sm" variant="flat" color="success" className="h-5 text-xs font-mono font-bold px-1.5">
                          {(activeData.config as TestGeneratorConfig)?.targetCoverage ?? 80}%
                        </Chip>
                      </div>
                      <Slider
                        size="sm"
                        color="success"
                        aria-label="目标行覆盖率"
                        step={5}
                        minValue={50}
                        maxValue={100}
                        value={(activeData.config as TestGeneratorConfig)?.targetCoverage ?? 80}
                        onChange={(val) =>
                          handleConfigChange("targetCoverage", Array.isArray(val) ? val[0] : val)
                        }
                        className="max-w-full"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                        <span>50% (底线)</span>
                        <span>80% (标准)</span>
                        <span>100% (极高)</span>
                      </div>
                    </Card>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                        沙箱隔离运行超时限制 (秒)
                      </label>
                      <Input
                        size="sm"
                        variant="bordered"
                        type="number"
                        aria-label="沙箱隔离运行超时限制"
                        endContent={<span className="text-xs text-slate-400 font-mono">秒</span>}
                        min={5}
                        max={120}
                        value={String((activeData.config as TestGeneratorConfig)?.sandboxTimeoutSec ?? 30)}
                        onValueChange={(val) =>
                          handleConfigChange("sandboxTimeoutSec", parseInt(val, 10) || 30)
                        }
                        classNames={{
                          inputWrapper:
                            "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 hover:border-slate-400 dark:hover:border-slate-600 shadow-xs rounded-xl font-mono h-10 min-h-10",
                          input: "text-xs text-slate-800 dark:text-slate-200",
                        }}
                      />
                    </div>

                    {/* Mock Mode Switch */}
                    <Card
                      shadow="none"
                      className="border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/60 rounded-xl"
                    >
                      <CardBody className="p-2.5 flex flex-row items-center justify-between gap-2">
                        <div className="min-w-0 pr-2">
                          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                            自动隔离并 Mock 外部依赖
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            自动为 HTTP/DB 注入 Stub，保证单测纯粹
                          </div>
                        </div>
                        <Switch
                          size="sm"
                          color="success"
                          isSelected={(activeData.config as TestGeneratorConfig)?.mockMode ?? true}
                          onValueChange={(val) => handleConfigChange("mockMode", val)}
                          aria-label="自动隔离 Mock"
                        />
                      </CardBody>
                    </Card>
                  </div>
                )}

                {/* 2. 节点特异配置 - DIFF_EXPORT */}
                {selectedNode.type === "diff_export" && (
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between px-0.5">
                      <span className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                        <GitCompare className="h-3.5 w-3.5" />
                        门禁决策与产物输出
                      </span>
                    </div>

                    {/* Segmented Pill Selector for Failure Action */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          门禁拦截决策 (Failure Action)
                        </label>
                      </div>
                      <Tabs
                        size="sm"
                        fullWidth
                        color={
                          (activeData.config as DiffExportConfig)?.failureAction === "block_commit"
                            ? "danger"
                            : (activeData.config as DiffExportConfig)?.failureAction === "warn_only"
                            ? "warning"
                            : "primary"
                        }
                        selectedKey={(activeData.config as DiffExportConfig)?.failureAction || "block_commit"}
                        onSelectionChange={(k) => handleConfigChange("failureAction", k as string)}
                        classNames={{
                          tabList:
                            "bg-slate-100 dark:bg-slate-900/90 p-1 rounded-xl border border-slate-200/80 dark:border-slate-800/80",
                          cursor: "rounded-lg shadow-sm",
                          tab: "h-7 text-xs font-medium",
                        }}
                      >
                        <Tab key="block_commit" title="🚨 强行阻断" />
                        <Tab key="warn_only" title="⚠️ 弱告警" />
                        <Tab key="create_review_pr" title="🔄 评审补丁" />
                      </Tabs>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                          即时消息通知联动 (DevOps Webhook)
                        </label>
                        <button
                          type="button"
                          onClick={() => setSettingsModalOpen(true, "feishu")}
                          className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                        >
                          <SlidersHorizontal className="h-3 w-3" />
                          <span>配置 Webhook</span>
                        </button>
                      </div>
                      <Select
                        size="sm"
                        variant="bordered"
                        aria-label="即时消息通知联动"
                        selectedKeys={new Set([(activeData.config as DiffExportConfig)?.notifyChannel || "feishu"])}
                        onSelectionChange={(keys) => {
                          const val = Array.from(keys)[0] as string;
                          if (val) handleConfigChange("notifyChannel", val);
                        }}
                        classNames={{
                          trigger:
                            "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 hover:border-slate-400 dark:hover:border-slate-600 shadow-xs rounded-xl h-10 min-h-10",
                          value: "text-xs text-slate-800 dark:text-slate-200 font-medium",
                        }}
                      >
                        <SelectItem key="feishu">飞书群机器人 Webhook (支持卡片渲染)</SelectItem>
                        <SelectItem key="dingtalk">钉钉群机器人 Webhook</SelectItem>
                        <SelectItem key="slack">Slack DevOps #quality-alerts</SelectItem>
                        <SelectItem key="none">无外部通知 (仅本地与平台审计)</SelectItem>
                      </Select>

                      {/* Quick Webhook Config Card */}
                      {((activeData.config as DiffExportConfig)?.notifyChannel === "feishu" || !(activeData.config as DiffExportConfig)?.notifyChannel) && (
                        <div className="p-2.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 text-xs flex items-center justify-between gap-2 mt-1">
                          <div className="min-w-0">
                            <div className="font-semibold text-[11px] text-blue-700 dark:text-blue-300 flex items-center gap-1">
                              <Bot className="h-3.5 w-3.5" />
                              <span>飞书群机器人对接</span>
                            </div>
                            <div className="text-[10px] text-slate-500 truncate mt-0.5">
                              拦截代码时向飞书群推送自愈卡片
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSettingsModalOpen(true, "feishu")}
                            className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-medium shrink-0 shadow-xs transition-colors"
                          >
                            设置地址
                          </button>
                        </div>
                      )}
                    </div>


                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                        差异补丁导出格式
                      </label>
                      <Select
                        size="sm"
                        variant="bordered"
                        aria-label="差异补丁导出格式"
                        selectedKeys={new Set([(activeData.config as DiffExportConfig)?.exportFormat || "unified_diff"])}
                        onSelectionChange={(keys) => {
                          const val = Array.from(keys)[0] as string;
                          if (val) handleConfigChange("exportFormat", val);
                        }}
                        classNames={{
                          trigger:
                            "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 hover:border-slate-400 dark:hover:border-slate-600 shadow-xs rounded-xl h-10 min-h-10",
                          value: "text-xs text-slate-800 dark:text-slate-200 font-medium",
                        }}
                      >
                        <SelectItem key="unified_diff">Unified Diff 标准补丁格式</SelectItem>
                        <SelectItem key="git_patch">Git Patch (.patch 文件)</SelectItem>
                        <SelectItem key="json_report">JSON 结构化审计报告</SelectItem>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                        补丁文件落盘路径
                      </label>
                      <Input
                        size="sm"
                        variant="bordered"
                        aria-label="补丁文件落盘路径"
                        value={
                          (activeData.config as DiffExportConfig)?.outputPath ||
                          "./output/gatekeeper-patch.diff"
                        }
                        onValueChange={(val) => handleConfigChange("outputPath", val)}
                        classNames={{
                          inputWrapper:
                            "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 hover:border-slate-400 dark:hover:border-slate-600 shadow-xs rounded-xl font-mono h-10 min-h-10",
                          input: "text-xs text-slate-800 dark:text-slate-200",
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: 推演日志 (LOGS) */}
            {activeTab === "logs" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Terminal className="h-3.5 w-3.5 text-blue-500" />
                    算子独立推演日志
                  </span>
                  <Chip size="sm" variant="flat" color="default" className="h-5 text-[10px] font-mono">
                    {currentLogs.length} 条记录
                  </Chip>
                </div>

                <div className="bg-slate-950 dark:bg-[#070a12] border border-slate-800/90 rounded-2xl p-3.5 min-h-[260px] max-h-[380px] overflow-y-auto font-mono text-[11px] space-y-1.5 shadow-inner">
                  {currentLogs.length > 0 ? (
                    currentLogs.map((log, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2 text-slate-200 dark:text-slate-300 leading-relaxed font-mono"
                      >
                        <span className="text-blue-400 shrink-0 select-none font-bold">›</span>
                        <span className="break-all">{log}</span>
                      </div>
                    ))
                  ) : (
                    <div className="h-48 flex flex-col items-center justify-center text-slate-500 text-xs gap-2">
                      <Terminal className="h-8 w-8 text-slate-600/50 stroke-1" />
                      <span>暂无执行日志，点击下方「单算子推演」即可实测</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: 算子标准 (GUIDE) */}
            {activeTab === "guide" && (
              <div className="space-y-3">
                <Card
                  shadow="none"
                  className="border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/40 rounded-2xl p-4 space-y-2.5"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                    <Info className="h-4 w-4 text-blue-500" />
                    <span>企业级代码门禁标准</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    FlowDev-AI 遵循左移质量管控思想。该算子部署在开发者提交前（Pre-Commit）环节，对增量文件进行纳秒级拦截与推演。
                  </p>
                  <Divider className="my-2" />
                  <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>零网络外溢，在本地和企业私有算力中推演</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>严格遵循 Kahn DAG 拓扑顺序调度执行</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>判定不合格时返回 Exit 1，直接掐断提交</span>
                    </div>
                  </div>
                </Card>
              </div>
            )}

          </>
        ) : (
          /* Global Info State (When No Node is Selected) */
          <div className="space-y-3.5">
            <Card
              shadow="none"
              className="border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/50 rounded-2xl p-3.5 space-y-2"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                <Workflow className="h-4 w-4 text-blue-500" />
                <span>多 Agent 门禁流水线编排</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                当前工作流由 4 类标准化质量门禁算子构成。点击左侧画布中的任意节点或右键选择「配置属性」，即可在此定制提示词、模型温度与断言策略。
              </p>
            </Card>

            <Card
              shadow="none"
              className="border border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/40 rounded-2xl p-3.5 space-y-2.5"
            >
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                画布拓扑统计
              </div>
              <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-800/60">
                  <span>算子节点数</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200 font-bold">
                    ${nodes.length} 个
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-800/60">
                  <span>拓扑依赖边</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200 font-bold">
                    ${edges.length} 条
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span>调度引擎</span>
                  <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">
                    FastAPI + Kahn DAG
                  </span>
                </div>
              </div>
            </Card>

            <div className="p-3 rounded-2xl border border-blue-200/80 dark:border-blue-500/20 bg-blue-50/50 dark:bg-blue-500/5 text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
              💡 提示：在画布中选中任意节点，或右键选择「配置属性」，即可在此处定制拦截规则。
            </div>
          </div>
        )}
      </div>

      {/* Persistent Footer Actions */}
      {selectedNode && activeData && (
        <div className="p-3 border-t border-slate-200/90 dark:border-slate-800/90 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-xs flex items-center gap-2 shrink-0">
          <Button
            color="primary"
            variant="flat"
            size="sm"
            className="flex-1 font-semibold rounded-xl"
            startContent={<Play className="h-3.5 w-3.5 text-primary" />}
            onClick={handleSimulateCurrentNode}
          >
            单算子实测推演
          </Button>
          <Button
            color="danger"
            variant="light"
            size="sm"
            className="font-medium rounded-xl text-rose-500"
            startContent={<Trash2 className="h-3.5 w-3.5" />}
            onClick={handleDeleteCurrentNode}
          >
            删除
          </Button>
        </div>
      )}
    </aside>
  );
}
