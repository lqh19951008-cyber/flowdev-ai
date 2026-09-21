"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Layers,
  Wand2,
  Send,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ProjectHealthRow {
  id: string;
  name: string;
  policy_version: string;
  last_applied_version: string;
  pending_push_version?: string | null;
  push_enabled: boolean;
  failure_action: string;
  total_events_7d: number;
  critical_events_7d: number;
  pass_rate_7d: number;
  top_files_7d: Array<{ file: string; count: number }>;
  top_issues_7d: Array<{ issue: string; count: number }>;
  recent_event_ids: string[];
  health_grade: "A" | "B" | "C" | "D" | "F";
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  at: number;
}

interface RuleDraft {
  title: string;
  category?: string;
  severity?: string;
  summary?: string;
  bad_snippet?: string;
  good_snippet?: string;
  skill_markdown?: string;
  gate_rule?: { title: string; pattern: string; message: string; level: string };
  source_events?: number;
  source_files?: string[];
  common_root_cause?: string;
}

interface CrossProjectRuleGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  onApplied?: () => void;
}

const gradeColor: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300",
  B: "bg-lime-100 text-lime-700 border-lime-300 dark:bg-lime-950/40 dark:text-lime-300",
  C: "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300",
  D: "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950/40 dark:text-orange-300",
  F: "bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300",
};

export function CrossProjectRuleGenerator({
  isOpen,
  onClose,
  onApplied,
}: CrossProjectRuleGeneratorProps) {
  const [mounted, setMounted] = useState(false);
  const [rows, setRows] = useState<ProjectHealthRow[]>([]);
  const [loadingMatrix, setLoadingMatrix] = useState(false);
  const [matrixError, setMatrixError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [step, setStep] = useState<"matrix" | "chat" | "apply">("matrix");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [currentRule, setCurrentRule] = useState<RuleDraft | null>(null);
  const [pushImmediately, setPushImmediately] = useState(true);
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<{
    applied: number;
    results: Array<{ project_id: string; ok: boolean; error?: string; pushed?: boolean }>;
  } | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!isOpen) return;
    if (rows.length === 0 && !loadingMatrix) fetchMatrix();
  }, [isOpen]);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const fetchMatrix = async () => {
    setLoadingMatrix(true);
    setMatrixError(null);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/projects/health-matrix");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setMatrixError(`加载健康度矩阵失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoadingMatrix(false);
    }
  };

  const toggleSelect = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const selectedRows = rows.filter((r) => selected.includes(r.id));
  const totalCritical = selectedRows.reduce((s, r) => s + (r.critical_events_7d || 0), 0);
  const totalFiles = new Set(selectedRows.flatMap((r) => r.top_files_7d.map((f) => f.file))).size;

  const startChat = async () => {
    if (selected.length === 0) return;
    setStep("chat");
    setMessages([]);
    setCurrentRule(null);
    await synthesizeInitial();
  };

  const synthesizeInitial = async () => {
    setChatLoading(true);
    try {
      const aggregatedIssues: string[] = [];
      const aggregatedFilenames: string[] = [];
      for (const r of selectedRows) {
        for (const it of r.top_issues_7d) aggregatedIssues.push(`[${r.id}] ${it.issue}`);
        for (const f of r.top_files_7d) aggregatedFilenames.push(`[${r.id}] ${f.file}`);
      }
      const res = await fetch("http://127.0.0.1:8000/api/rules/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: selectedRows[0]?.id ?? "default",
          events: [
            {
              filename: aggregatedFilenames[0] ?? "unknown",
              critical_issues: aggregatedIssues.slice(0, 30),
              suggestions: [],
            },
          ],
          language: "typescript",
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const rule: RuleDraft = await res.json();
      rule.source_events = totalCritical;
      rule.source_files = aggregatedFilenames.slice(0, 10);
      setCurrentRule(rule);
      setMessages([
        {
          role: "assistant",
          content: `已基于跨 ${selected.length} 个项目 / ${totalCritical} 项历史 critical 提炼出第一版规则。请在下方继续对话修改。`,
          at: Date.now(),
        },
      ]);
    } catch (e) {
      setMessages([
        { role: "assistant", content: `生成失败: ${e instanceof Error ? e.message : String(e)}`, at: Date.now() },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const sendChat = async () => {
    const text = input.trim();
    if (!text || !currentRule || chatLoading) return;
    const newUserMsg: ChatMessage = { role: "user", content: text, at: Date.now() };
    setMessages((prev) => [...prev, newUserMsg]);
    setInput("");
    setChatLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/rules/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          previous_rule: currentRule,
          messages: [...messages, newUserMsg].map((m) => ({ role: m.role, content: m.content })),
          context: { project_ids: selected },
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = await res.json();
      const newRule: RuleDraft = data.rule;
      setCurrentRule(newRule);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `已根据"${text.slice(0, 30)}${text.length > 30 ? "…" : ""}"调整。`,
          at: Date.now(),
        },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Refine 失败: ${e instanceof Error ? e.message : String(e)}`, at: Date.now() },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const applyRule = async () => {
    if (!currentRule) return;
    setApplying(true);
    setApplyResult(null);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/rules/apply-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_ids: selected,
          rule: currentRule,
          push_immediately: pushImmediately,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = await res.json();
      setApplyResult(data);
      onApplied?.();
    } catch (e) {
      setApplyResult({
        applied: 0,
        results: selected.map((pid) => ({
          project_id: pid,
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        })),
      });
    } finally {
      setApplying(false);
    }
  };

  if (!isOpen || !mounted) return null;
  if (typeof document === "undefined" || !document?.body) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-6xl max-h-[94vh] flex flex-col rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-cyan-50/40 via-slate-50/40 to-indigo-50/40 dark:from-cyan-950/10 dark:via-slate-900/40 dark:to-indigo-950/10">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-cyan-500 via-indigo-600 to-amber-500 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                跨项目规则生成器 (Cross-Project Rule Generator)
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                守门员专用 · 选仓库 → AI 对话迭代 → 一键应用推送
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭" className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1.5 px-5 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40">
          {[
            { key: "matrix", label: "① 选仓库", desc: "矩阵勾选" },
            { key: "chat", label: "② AI 对话", desc: "迭代修改" },
            { key: "apply", label: "③ 一键应用", desc: "推送规则" },
          ].map((s, idx, arr) => {
            const reached =
              step === s.key ||
              (step === "chat" && s.key === "matrix") ||
              (step === "apply" && (s.key === "matrix" || s.key === "chat"));
            const active = step === s.key;
            return (
              <React.Fragment key={s.key}>
                <button
                  type="button"
                  onClick={() => {
                    if (s.key === "matrix") setStep("matrix");
                    else if (s.key === "chat" && currentRule) setStep("chat");
                    else if (s.key === "apply" && currentRule) setStep("apply");
                  }}
                  className={cn(
                    "flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors",
                    active
                      ? "border-cyan-400 dark:border-cyan-600 bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-300"
                      : reached
                      ? "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300"
                      : "border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/30 text-slate-400 cursor-not-allowed"
                  )}
                  disabled={!reached}
                >
                  <span className="font-mono">{s.label}</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">{s.desc}</span>
                </button>
                {idx < arr.length - 1 && <ArrowRight className="h-3 w-3 text-slate-300 shrink-0" />}
              </React.Fragment>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden">
          {/* === STEP 1: Matrix === */}
          {step === "matrix" && (
            <div className="h-full overflow-y-auto p-5 space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-cyan-200/60 dark:border-cyan-800/40 bg-cyan-50/60 dark:bg-cyan-950/20 px-4 py-3">
                <Layers className="h-4 w-4 text-cyan-600 dark:text-cyan-400 mt-0.5 shrink-0" />
                <div className="text-xs text-cyan-900 dark:text-cyan-200">
                  <strong className="font-semibold">多仓库质量健康度矩阵</strong>
                  <span className="ml-1">
                    — 列出过去 7 天所有接入项目的质量快照, 勾选需要治理的项目, AI 将聚合所有 critical issues 提炼一条统一规则。
                  </span>
                </div>
              </div>
              {matrixError && (
                <div className="px-3 py-2 rounded-md bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-700 dark:text-rose-300">
                  ⚠️ {matrixError}
                  <button onClick={fetchMatrix} className="ml-2 underline">重试</button>
                </div>
              )}
              {loadingMatrix ? (
                <div className="py-20 flex flex-col items-center justify-center">
                  <div className="h-8 w-8 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                  <div className="mt-3 text-xs text-slate-500">加载多项目健康度矩阵...</div>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400">
                      <tr>
                        <th className="px-3 py-2 text-left w-8"></th>
                        <th className="px-3 py-2 text-left font-semibold">仓库</th>
                        <th className="px-3 py-2 text-center font-semibold w-16">等级</th>
                        <th className="px-3 py-2 text-center font-semibold w-24">通过率</th>
                        <th className="px-3 py-2 text-center font-semibold w-32">critical / 7d</th>
                        <th className="px-3 py-2 text-center font-semibold w-24">策略版本</th>
                        <th className="px-3 py-2 text-left font-semibold">主要缺陷 (top1)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => {
                        const sel = selected.includes(r.id);
                        return (
                          <tr
                            key={r.id}
                            onClick={() => toggleSelect(r.id)}
                            className={cn(
                              "border-t border-slate-100 dark:border-slate-800 cursor-pointer transition-colors",
                              sel ? "bg-cyan-50/50 dark:bg-cyan-950/20" : "hover:bg-slate-50 dark:hover:bg-slate-900/40"
                            )}
                          >
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                checked={sel}
                                onChange={() => toggleSelect(r.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <div className="font-mono font-semibold text-slate-800 dark:text-slate-200">{r.id}</div>
                              <div className="text-[10px] text-slate-400 truncate max-w-[200px]">{r.name}</div>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className={cn("inline-flex items-center justify-center h-6 w-6 rounded-full text-[10px] font-bold border", gradeColor[r.health_grade])}>
                                {r.health_grade}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center font-mono">{r.pass_rate_7d}%</td>
                            <td className="px-3 py-2 text-center font-mono">
                              <span className="text-rose-600 dark:text-rose-400 font-bold">{r.critical_events_7d}</span>
                              <span className="text-slate-400"> / {r.total_events_7d}</span>
                            </td>
                            <td className="px-3 py-2 text-center font-mono text-[11px]">
                              <span className="text-slate-500">{r.last_applied_version}</span>
                              {r.pending_push_version && (
                                <span className="ml-1 px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-[9px]">待推</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-[11px] text-slate-600 dark:text-slate-400">
                              <div className="line-clamp-1 max-w-[400px]">{r.top_issues_7d[0]?.issue ?? "—"}</div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {rows.length > 0 && (
                <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    已选{" "}
                    <strong className="text-cyan-600 dark:text-cyan-400 font-mono">{selected.length}</strong>{" "}
                    个项目
                    {selected.length > 0 && (
                      <span className="ml-2 text-slate-500">
                        (涉及{" "}
                        <strong className="font-mono text-rose-600 dark:text-rose-400">{totalCritical}</strong>{" "}
                        项 critical, {totalFiles} 个文件)
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={startChat}
                    disabled={selected.length === 0}
                    className={cn(
                      "flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-md transition-colors",
                      selected.length === 0
                        ? "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                        : "bg-cyan-600 hover:bg-cyan-700 text-white shadow-sm shadow-cyan-500/20"
                    )}
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                    <span>下一步: AI 对话提炼</span>
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* === STEP 2: Chat === */}
          {step === "chat" && (
            <div className="h-full grid grid-cols-2 gap-0 divide-x divide-slate-100 dark:divide-slate-800">
              <div className="flex flex-col h-full">
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.map((m, idx) => (
                    <div key={idx} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[85%] rounded-lg px-3 py-2 text-xs",
                          m.role === "user"
                            ? "bg-cyan-600 text-white"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                        )}
                      >
                        {m.content}
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-2 text-xs flex items-center gap-2">
                        <div className="h-3 w-3 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                        AI 思考中...
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
                <div className="border-t border-slate-100 dark:border-slate-800 p-3 flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendChat();
                      }
                    }}
                    placeholder="例如: 把示例改用 Python, 改更宽松一点, 加上 SQL 注入专项..."
                    className="flex-1 px-3 py-2 text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:border-cyan-500"
                    disabled={chatLoading || !currentRule}
                  />
                  <button
                    type="button"
                    onClick={sendChat}
                    disabled={chatLoading || !input.trim() || !currentRule}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md transition-colors",
                      chatLoading || !input.trim() || !currentRule
                        ? "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                        : "bg-cyan-600 hover:bg-cyan-700 text-white"
                    )}
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>发送</span>
                  </button>
                </div>
              </div>
              <div className="flex flex-col h-full overflow-y-auto">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">当前规则草稿</h3>
                    {currentRule && (
                      <span className="text-[10px] font-mono text-slate-400">跨 {currentRule.source_events ?? 0} 项 critical</span>
                    )}
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  {!currentRule ? (
                    <div className="py-12 text-center text-xs text-slate-400">等待 AI 生成第一版...</div>
                  ) : (
                    <>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{currentRule.title}</h4>
                        {currentRule.common_root_cause && (
                          <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">🔑 {currentRule.common_root_cause}</p>
                        )}
                        {currentRule.summary && <p className="mt-2 text-xs text-slate-700 dark:text-slate-300">{currentRule.summary}</p>}
                      </div>
                      {currentRule.source_files && currentRule.source_files.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {currentRule.source_files.slice(0, 8).map((f) => (
                            <span key={f} className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{f}</span>
                          ))}
                        </div>
                      )}
                      {currentRule.bad_snippet && (
                        <div>
                          <div className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 mb-1">❌ BAD</div>
                          <pre className="p-2 rounded bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-[11px] overflow-x-auto whitespace-pre-wrap">
                            {currentRule.bad_snippet}
                          </pre>
                        </div>
                      )}
                      {currentRule.good_snippet && (
                        <div>
                          <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mb-1">✅ GOOD</div>
                          <pre className="p-2 rounded bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-[11px] overflow-x-auto whitespace-pre-wrap">
                            {currentRule.good_snippet}
                          </pre>
                        </div>
                      )}
                      {currentRule.gate_rule?.pattern && (
                        <div>
                          <div className="text-[10px] font-semibold text-slate-500 mb-1">🔍 Gate Pattern</div>
                          <code className="block px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-mono overflow-x-auto">
                            {currentRule.gate_rule.pattern}
                          </code>
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 sticky bottom-0 bg-white dark:bg-slate-900">
                  <button
                    type="button"
                    onClick={() => setStep("apply")}
                    disabled={!currentRule}
                    className={cn(
                      "w-full flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md transition-colors",
                      !currentRule
                        ? "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                        : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                    )}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>下一步: 一键应用</span>
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* === STEP 3: Apply === */}
          {step === "apply" && (
            <div className="h-full overflow-y-auto p-5 space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-emerald-200/60 dark:border-emerald-800/40 bg-emerald-50/60 dark:bg-emerald-950/20 px-4 py-3">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                <div className="text-xs text-emerald-900 dark:text-emerald-200">
                  <strong>即将应用:</strong>
                  <span className="ml-1">
                    "{currentRule?.title}" 到 {selected.length} 个选中项目, 作为新 policy 版本入库。
                  </span>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">目标项目 ({selected.length})</h4>
                <div className="flex flex-wrap gap-1.5">
                  {selectedRows.map((r) => (
                    <span key={r.id} className="px-2 py-1 text-xs font-mono rounded-md bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-300 border border-cyan-200/60 dark:border-cyan-800/40">
                      {r.id}
                    </span>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={pushImmediately}
                  onChange={(e) => setPushImmediately(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                />
                <span>应用后立即推送 (push_immediately) — 开发者下次 commit 自动拉取</span>
              </label>
              <button
                type="button"
                onClick={applyRule}
                disabled={applying || !currentRule}
                className={cn(
                  "w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold rounded-md transition-colors",
                  applying || !currentRule
                    ? "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20"
                )}
              >
                {applying ? "应用中..." : `🚀 应用到 ${selected.length} 个项目`}
              </button>
              {applyResult && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    ✓ 已成功应用 {applyResult.applied} / {selected.length} 个项目
                  </div>
                  <div className="space-y-1">
                    {applyResult.results.map((r) => (
                      <div
                        key={r.project_id}
                        className={cn(
                          "px-3 py-2 rounded-md text-xs flex items-center gap-2",
                          r.ok
                            ? "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300"
                            : "bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300"
                        )}
                      >
                        <span className="font-mono">{r.project_id}</span>
                        {r.ok ? (
                          <span>✓ 应用成功{r.pushed ? " + 已推送" : ""}</span>
                        ) : (
                          <span>✗ {r.error}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}