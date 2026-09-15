"use client";

import React, { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  X,
  Download,
  Copy,
  Check,
  GitCompare,
  TestTube2,
  CheckCircle2,
} from "lucide-react";
import { useFlowStore } from "@/stores/useFlowStore";
import { generateGitUnifiedPatch, downloadFile, copyToClipboard } from "@/lib/patch";
import { useTheme } from "@/components/providers/HeroUIProvider";

// Dynamically import Monaco DiffEditor and Editor to prevent SSR issues
const DiffEditor = dynamic(
  () => import("@monaco-editor/react").then((mod) => mod.DiffEditor),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex flex-col items-center justify-center bg-slate-100 dark:bg-[#1e1e1e] text-slate-500 dark:text-slate-400 font-mono text-xs gap-2">
        <div className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span>正在装载 Monaco Diff 渲染引擎...</span>
      </div>
    ),
  }
);

const Editor = dynamic(
  () => import("@monaco-editor/react").then((mod) => mod.Editor),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex flex-col items-center justify-center bg-slate-100 dark:bg-[#1e1e1e] text-slate-500 dark:text-slate-400 font-mono text-xs gap-2">
        <div className="h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span>正在装载 Monaco 单测代码查看器...</span>
      </div>
    ),
  }
);

export function DiffModal() {
  const { isDiffModalOpen, setDiffModalOpen, artifacts } = useFlowStore();
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<"diff" | "tests">("diff");
  const [copiedType, setCopiedType] = useState<string | null>(null);

  // Close on Escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isDiffModalOpen) {
        setDiffModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDiffModalOpen, setDiffModalOpen]);

  const originalCode = artifacts.originalCode || "";
  const refactoredCode = artifacts.refactoredCode || originalCode;
  const testCode = artifacts.testCode || "";
  const language = artifacts.language || "python";

  // Compute standard git patch
  const patchContent = useMemo(() => {
    const ext = language === "python" ? ".py" : ".ts";
    return generateGitUnifiedPatch(`source_code${ext}`, originalCode, refactoredCode);
  }, [originalCode, refactoredCode, language]);

  if (!isDiffModalOpen) return null;

  const handleCopy = async (type: string, content: string) => {
    const ok = await copyToClipboard(content);
    if (ok) {
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2000);
    }
  };

  const handleDownloadPatch = () => {
    downloadFile(patchContent, `review_patch_${Date.now()}.patch`);
  };

  const handleDownloadTests = () => {
    const ext = language === "python" ? "test_suite.py" : "test_suite.test.ts";
    downloadFile(testCode, ext);
  };

  // Map language to Monaco language identifier
  const monacoLang =
    language === "typescript"
      ? "typescript"
      : language === "javascript"
      ? "javascript"
      : "python";

  const monacoTheme = theme === "dark" ? "vs-dark" : "light";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-200 select-none cursor-pointer"
      onClick={() => setDiffModalOpen(false)}
    >
      <div
        className="relative w-full max-w-6xl h-[90vh] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-2xl flex flex-col overflow-hidden cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="h-14 px-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <GitCompare className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Monaco 双向 Diff 代码比对与单测成果
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-indigo-700 dark:text-indigo-300">
                  {language.toUpperCase()}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                左侧为原始输入源码，右侧为 ReviewAgent 推荐的重构方案
              </p>
            </div>
          </div>

          {/* Tab Switcher & Close */}
          <div className="flex items-center gap-3">
            <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs">
              <button
                onClick={() => setActiveTab("diff")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
                  activeTab === "diff"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                <GitCompare className="h-3.5 w-3.5" />
                <span>代码 Diff 对比</span>
              </button>
              <button
                onClick={() => setActiveTab("tests")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
                  activeTab === "tests"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                <TestTube2 className="h-3.5 w-3.5" />
                <span>自动化单测套件</span>
              </button>
            </div>

            <button
              onClick={() => setDiffModalOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ml-2"
              title="关闭 (Esc)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 w-full bg-slate-50 dark:bg-[#1e1e1e] overflow-hidden relative">
          {activeTab === "diff" ? (
            <DiffEditor
              original={originalCode}
              modified={refactoredCode}
              language={monacoLang}
              theme={monacoTheme}
              options={{
                renderSideBySide: true,
                readOnly: true,
                automaticLayout: true,
                fontSize: 13,
                fontFamily: "Fira Code, Consolas, Monaco, monospace",
                lineNumbers: "on",
                renderOverviewRuler: false,
                diffWordWrap: "on",
              }}
            />
          ) : (
            <Editor
              value={testCode}
              language={monacoLang}
              theme={monacoTheme}
              options={{
                readOnly: true,
                automaticLayout: true,
                fontSize: 13,
                fontFamily: "Fira Code, Consolas, Monaco, monospace",
                lineNumbers: "on",
                minimap: { enabled: false },
                wordWrap: "on",
              }}
            />
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="h-14 px-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>
              {activeTab === "diff"
                ? "绿色高亮为 Agent 优化增补逻辑，红色高亮为剔除的隐患代码"
                : "已在本地沙箱通过自动化断言验证，支持直接落地生产环境"}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Copy Actions */}
            {activeTab === "diff" ? (
              <button
                onClick={() => handleCopy("refactored", refactoredCode)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg transition-colors shadow-xs"
              >
                {copiedType === "refactored" ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>已复制优化代码</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>复制重构代码</span>
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={() => handleCopy("tests", testCode)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg transition-colors shadow-xs"
              >
                {copiedType === "tests" ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>已复制单测代码</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>复制单测套件</span>
                  </>
                )}
              </button>
            )}

            {/* Export Actions */}
            <button
              onClick={handleDownloadPatch}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-md shadow-indigo-600/20 transition-all active:scale-95"
            >
              <Download className="h-3.5 w-3.5" />
              <span>导出 Git 补丁 (.patch)</span>
            </button>

            <button
              onClick={handleDownloadTests}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-md shadow-emerald-600/20 transition-all active:scale-95"
            >
              <Download className="h-3.5 w-3.5" />
              <span>导出单测文件 (.test)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
