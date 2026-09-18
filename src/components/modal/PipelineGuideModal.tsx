"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Workflow,
  FileCode2,
  Sparkles,
  GitCompare,
  CheckCircle2,
  LayoutTemplate,
} from "lucide-react";
import { useFlowStore } from "@/stores/useFlowStore";

interface PipelineGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PipelineGuideModal({ isOpen, onClose }: PipelineGuideModalProps) {
  const loadPreset = useFlowStore((s) => s?.loadPreset);
  const selectedProjectId = useFlowStore((s) => s?.selectedProjectId);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;
  if (typeof document === "undefined" || !document?.body) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-2xl text-slate-800 dark:text-slate-200 select-none overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4 shrink-0 bg-slate-50/70 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Workflow className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>门禁流水线编排与使用指南</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 font-mono">
                  Guide
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                如何为代码仓库制定自动化代码审查、单测卡点与提交阻断策略
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* 1. DAG Physical Pipeline Model */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 dark:bg-cyan-400" />
            <span>一、门禁流水线模型（Kahn DAG 拓扑执行流）</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs">
            {/* Step 1 */}
            <div className="space-y-1.5 p-2 rounded-lg bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400">
                <FileCode2 className="h-3.5 w-3.5" />
                <span>1. 触发与范围 (Scope)</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                捕获本地 Git 提交变更（<code className="text-amber-700 dark:text-amber-300 font-semibold">pre-commit</code>），过滤匹配的文件（如 <code className="text-amber-700 dark:text-amber-300">**/*.ts</code>），忽略第三方目录。
              </p>
            </div>

            {/* Step 2 */}
            <div className="space-y-1.5 p-2 rounded-lg bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center gap-1.5 font-semibold text-purple-600 dark:text-purple-400">
                <Sparkles className="h-3.5 w-3.5" />
                <span>2. 并行规则卡点 (Audit)</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                并发执行：① DeepSeek 语义推演阻断空指针/注入；② 自动化单测覆盖率门槛（如 80%）与沙箱验证。
              </p>
            </div>

            {/* Step 3 */}
            <div className="space-y-1.5 p-2 rounded-lg bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center gap-1.5 font-semibold text-cyan-600 dark:text-cyan-400">
                <GitCompare className="h-3.5 w-3.5" />
                <span>3. 裁决与阻断 (Enforce)</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                汇聚判定结论：若有红线缺陷直接终端 <code className="text-rose-600 dark:text-rose-400 font-semibold">Exit 1</code> 强行阻止提交，并生成修复补丁与消息通知。
              </p>
            </div>
          </div>
        </div>

        {/* 2. Step-by-Step Practical Usage */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 dark:bg-blue-400" />
            <span>二、四步操作闭环（如何编排并生效）</span>
          </h3>

          <div className="space-y-2 text-xs">
            <div className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
              <div className="h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-600/20 border border-blue-300 dark:border-blue-500/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                1
              </div>
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-200">
                  选择目标代码仓库
                </div>
                <div className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5">
                  在顶部导航栏下拉框选择当前要定制策略的项目（如 <span className="font-mono text-cyan-600 dark:text-cyan-300 font-semibold">{selectedProjectId || "rxjs"}</span>），系统会自动读取并加载该仓库专属的门禁拓扑。
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
              <div className="h-5 w-5 rounded-full bg-purple-100 dark:bg-purple-600/20 border border-purple-300 dark:border-purple-500/30 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                2
              </div>
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-200">
                  在画布与属性抽屉微调门禁规则
                </div>
                <div className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5">
                  从左侧拖拽算子、连线建立依赖。点击画布中的节点，在右侧展开的抽屉中开启红线开关（如开启「空指针阻断」、调整目标覆盖率至 85%）。
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
              <div className="h-5 w-5 rounded-full bg-emerald-100 dark:bg-emerald-600/20 border border-emerald-300 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                3
              </div>
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-200">
                  策略拦截力实测 (仿真验证)
                </div>
                <div className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5">
                  点击顶部「<span className="text-blue-600 dark:text-blue-300 font-semibold">🧪 策略实测</span>」，系统会在本地调度器运行仿真用例，验证该规则流水线能否精准拦截缺陷并放行合格代码。
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
              <div className="h-5 w-5 rounded-full bg-cyan-100 dark:bg-cyan-600/20 border border-cyan-300 dark:border-cyan-500/30 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                4
              </div>
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-200">
                  一键下发策略至该代码仓库
                </div>
                <div className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5">
                  点击顶部「<span className="text-emerald-600 dark:text-emerald-300 font-semibold">🚀 下发策略</span>」，配置即时持久化到数据库。该仓库任何开发者在本地执行 <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded text-cyan-700 dark:text-cyan-300 font-mono">git commit</code> 时，探针即刻自动按新策略生效拦截！
                </div>
              </div>
            </div>
          </div>
        </div>

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/70 dark:bg-slate-900/50">
          <button
            onClick={() => {
              loadPreset("full_review_heal");
              onClose();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors shadow-xs cursor-pointer"
          >
            <LayoutTemplate className="h-3.5 w-3.5 text-blue-500" />
            <span>载入标准企业全流程模版</span>
          </button>

          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-all shadow-md shadow-blue-500/20 cursor-pointer"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>开始编排</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
