"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Copy,
  Check,
  Download,
  Terminal,
  Code2,
  Cpu,
  Layers,
  BookOpen,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FolderGit2,
  FileText,
  ArrowRight,
  ChevronDown,
  Lightbulb,
  GitBranch,
  Wand2,
  Send,
  Bell,
  BellOff,
  CircleDot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScanEventItem, SynthesizedRule, CustomGateRule, AgentSkillItem } from "@/types/flow";

interface RuleEvolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  scanEvent: ScanEventItem | null;
  projectId: string;
  onRuleApplied?: () => void;
}

export function RuleEvolutionModal({
  isOpen,
  onClose,
  scanEvent,
  projectId,
  onRuleApplied,
}: RuleEvolutionModalProps) {
  const [activeTab, setActiveTab] = useState<"evolve" | "library" | "batch">("evolve");
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [synthesizedRule, setSynthesizedRule] = useState<SynthesizedRule | null>(null);
  const [applyLoading, setApplyLoading] = useState(false);
  const [appliedSuccess, setAppliedSuccess] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  // 折叠面板状态：默认收起 Skill + Gatekeeper 两块次要信息
  const [expandedSection, setExpandedSection] = useState<"skill" | "gate" | null>(null);
  // 守门员/开发者身份提示: 默认收起
  const [showRoleHint, setShowRoleHint] = useState(true);
  // === Batch aggregate state ===
  const [batchEvents, setBatchEvents] = useState<ScanEventItem[]>([]);
  const [batchSelected, setBatchSelected] = useState<string[]>([]); // event ids
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchResult, setBatchResult] = useState<SynthesizedRule | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);

  const fetchBatchEvents = async () => {
    setBatchLoading(true);
    setBatchError(null);
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/api/projects/${encodeURIComponent(targetProjectId)}/events?limit=50`
      );
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : Array.isArray(data?.events) ? data.events : [];
        setBatchEvents(list);
        if (list.length === 0) {
          setBatchError("该项目暂无拦截事件, 请在产生 critical issues 后再使用批量聚合");
        }
      } else {
        setBatchError(`获取事件列表失败 (HTTP ${res.status})`);
      }
    } catch (e) {
      setBatchError(`网络错误: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBatchLoading(false);
    }
  };

  const toggleBatchSelect = (eventId: string) => {
    setBatchSelected((prev) =>
      prev.includes(eventId) ? prev.filter((x) => x !== eventId) : [...prev, eventId]
    );
  };

  const synthesizeBatchRule = async () => {
    if (batchSelected.length < 2) {
      setBatchError("批量聚合至少选择 2 条事件");
      return;
    }
    const selected = batchEvents.filter((e) => batchSelected.includes(String(e.id ?? "")));
    if (selected.length === 0) {
      setBatchError("选中事件无法定位, 请重试");
      return;
    }
    setBatchLoading(true);
    setBatchError(null);
    try {
      const eventsPayload = selected.map((ev) => ({
        event_id: ev.id,
        filename: ev.files?.[0]?.filename ?? "unknown",
        critical_issues: ev.critical_issues ?? [],
        suggestions: ev.suggestions ?? [],
        timestamp: ev.timestamp,
      }));
      const res = await fetch("http://127.0.0.1:8000/api/rules/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: targetProjectId,
          events: eventsPayload,
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }
      const data: SynthesizedRule = await res.json();
      setBatchResult(data);
    } catch (e) {
      setBatchError(`聚合生成失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBatchLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  // Repository Library state
  const [libRules, setLibRules] = useState<CustomGateRule[]>([]);
  const [libSkills, setLibSkills] = useState<AgentSkillItem[]>([]);
  const [libLoading, setLibLoading] = useState(false);
  const [serverUrl, setServerUrl] = useState("http://127.0.0.1:8000");

  // ---- Push Mode state (server -> local repo, one-key confirmation) ----
  const [pushState, setPushState] = useState<{
    policy_version: string;
    pending_push_version: string | null;
    last_applied_version: string;
    push_enabled: boolean;
    pending: boolean;
    changelog: Array<{ reason?: string; version?: string; at?: string }>;
    last_pushed_at: string | null;
    last_applied_at: string | null;
  }>({
    policy_version: "0.0.0",
    pending_push_version: null,
    last_applied_version: "0.0.0",
    push_enabled: true,
    pending: false,
    changelog: [],
    last_pushed_at: null,
    last_applied_at: null,
  });
  const [pushLoading, setPushLoading] = useState(false);
  const [pushToast, setPushToast] = useState<{ kind: "success" | "error" | "info"; text: string } | null>(null);

  // Fetch or synthesize when opened
  useEffect(() => {
    if (!isOpen) return;

    if (typeof window !== "undefined") {
      const currentHost = window.location.hostname;
      const protocol = window.location.protocol;
      if (currentHost === "localhost" || currentHost === "127.0.0.1") {
        setServerUrl("http://127.0.0.1:8000");
      } else {
        setServerUrl(`${protocol}//${window.location.host}`);
      }
    }

    if (scanEvent) {
      setActiveTab("evolve");
      synthesizeRuleFromEvent(scanEvent);
    } else {
      // Opened via "批量聚合" entry on dashboard: default to batch tab
      setActiveTab("batch");
      fetchBatchEvents();
    }
  }, [isOpen, scanEvent, projectId]);

  const targetProjectId = scanEvent?.project_id || (projectId === "all" ? "" : projectId) || "";

  const synthesizeRuleFromEvent = async (event: ScanEventItem) => {
    setLoading(true);
    setAppliedSuccess(false);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/rules/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: targetProjectId,
          critical_issues: event.critical_issues || [],
          suggestions: event.suggestions || [],
          filename: event.files?.[0]?.filename || "src/index.ts",
          code_snippet: "",
          language: "typescript",
        }),
      });

      if (res.ok) {
        const data: SynthesizedRule = await res.json();
        setSynthesizedRule(data);
      }
    } catch (err) {
      console.error("Failed to synthesize rule", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectLibrary = async () => {
    setLibLoading(true);
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/api/projects/${encodeURIComponent(targetProjectId)}/policy`
      );
      if (res.ok) {
        const data = await res.json();
        setLibRules(data.custom_rules || []);
        setLibSkills(data.agent_skills || []);
      }
    } catch (err) {
      console.error("Failed to fetch project library", err);
    } finally {
      setLibLoading(false);
    }
  };

  const handleApplyRule = async () => {
    if (!synthesizedRule) return;
    setApplyLoading(true);

    try {
      const res = await fetch(
        `http://127.0.0.1:8000/api/projects/${encodeURIComponent(targetProjectId)}/rules/apply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            custom_rule: synthesizedRule.gate_rule,
            agent_skill: {
              title: synthesizedRule.title,
              summary: synthesizedRule.summary,
              category: synthesizedRule.category,
              markdown: synthesizedRule.skill_markdown,
            },
          }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        setAppliedSuccess(true);
        if (onRuleApplied) onRuleApplied();
        fetchProjectLibrary();

        // Push Mode feedback: tell the gatekeeper the沉淀 has already auto-
        // dispatched to every local repo. No extra "push" click needed.
        if (data?.auto_pushed && data?.pending_push_version) {
          setPushState((prev) => ({
            ...prev,
            policy_version: data.policy_version || prev.policy_version,
            pending_push_version: data.pending_push_version,
            pending: true,
          }));
          setPushToast({
            kind: "success",
            text: `✅ 沉淀成功！已自动下发给所有本地仓库（v${data.pending_push_version}）。开发者下次 git commit 时会在终端收到 Y/n 询问，无需手动同步。`,
          });
          setTimeout(() => setPushToast(null), 8000);
        } else if (data?.policy_version) {
          setPushState((prev) => ({
            ...prev,
            policy_version: data.policy_version,
          }));
          setPushToast({
            kind: "info",
            text: `✅ 沉淀成功（v${data.policy_version}）。推送模式已关闭，规则不会主动下发到本地仓库。`,
          });
          setTimeout(() => setPushToast(null), 6000);
        }
      }
    } catch (err) {
      console.error("Failed to apply rule", err);
    } finally {
      setApplyLoading(false);
    }
  };

  const handleDeleteRule = async (title: string) => {
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/api/projects/${encodeURIComponent(targetProjectId)}/rules`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        setLibRules(data.custom_rules || []);
        setLibSkills(data.agent_skills || []);
        if (onRuleApplied) onRuleApplied();
      }
    } catch (err) {
      console.error("Failed to delete rule", err);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // ============ Push Mode handlers (server -> local repo) ============
  const fetchPushState = async () => {
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/api/projects/${encodeURIComponent(targetProjectId)}/sync-status`
      );
      if (res.ok) {
        const data = await res.json();
        setPushState((prev) => ({
          policy_version: data.latest_version ?? prev.policy_version,
          pending_push_version: data.pending_push_version ?? null,
          last_applied_version: data.last_applied_version ?? prev.last_applied_version,
          push_enabled: data.push_enabled ?? prev.push_enabled,
          pending: Boolean(data.pending),
          changelog: data.changelog ?? prev.changelog,
          last_pushed_at: data.last_pushed_at ?? prev.last_pushed_at,
          last_applied_at: data.last_applied_at ?? prev.last_applied_at,
        }));
      }
    } catch (err) {
      console.error("Failed to fetch push state", err);
    }
  };

  const handleTriggerPush = async () => {
    if (pushLoading) return;
    setPushLoading(true);
    setPushToast(null);
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/api/projects/${encodeURIComponent(targetProjectId)}/push`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "从规则治理中心推送" }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        const version = data?.version || data?.push_state?.policy_version;
        setPushToast({
          kind: "success",
          text: `已标记 v${version} 待推送到本地仓库。开发者下次 git commit 时只需按 Y 确认即可同步。`,
        });
        await fetchPushState();
        if (onRuleApplied) onRuleApplied();
      } else {
        const errText = await res.text().catch(() => "");
        setPushToast({ kind: "error", text: `推送失败：HTTP ${res.status} ${errText?.slice(0, 120) ?? ""}` });
      }
    } catch (err: any) {
      setPushToast({ kind: "error", text: `推送失败：${err?.message ?? err}` });
    } finally {
      setPushLoading(false);
      setTimeout(() => setPushToast(null), 6000);
    }
  };

  const handleTogglePushEnabled = async () => {
    if (pushLoading) return;
    setPushLoading(true);
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/api/projects/${encodeURIComponent(targetProjectId)}/push-enabled`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: !pushState.push_enabled }),
        }
      );
      if (res.ok) {
        await fetchPushState();
      }
    } catch (err) {
      console.error("toggle push-enabled failed", err);
    } finally {
      setPushLoading(false);
    }
  };

  const handleCancelPending = async () => {
    if (pushLoading) return;
    setPushLoading(true);
    try {
      await fetch(
        `http://127.0.0.1:8000/api/projects/${encodeURIComponent(targetProjectId)}/cancel-push`,
        { method: "POST" }
      );
      await fetchPushState();
      setPushToast({ kind: "info", text: "已取消本次待推送标记。本地开发者下次 commit 不会再收到询问。" });
      setTimeout(() => setPushToast(null), 4000);
    } catch (err) {
      console.error(err);
    } finally {
      setPushLoading(false);
    }
  };

  // Subscribe to SSE so we can refresh push state in real time across all open tabs.
  useEffect(() => {
    if (!isOpen) return;
    fetchPushState();
    let es: EventSource | null = null;
    try {
      es = new EventSource("http://127.0.0.1:8000/api/events/stream");
      const onPush = () => fetchPushState();
      const onApplied = () => fetchPushState();
      const onCancelled = () => fetchPushState();
      es.addEventListener("rule_pushed", onPush);
      es.addEventListener("rule_applied", onApplied);
      es.addEventListener("rule_push_cancelled", onCancelled);
    } catch (err) {
      console.warn("SSE subscribe failed", err);
    }
    return () => {
      try {
        es?.close();
      } catch (e) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, targetProjectId]);

  const handleDownloadCursorRules = (content: string, filename: string = ".cursorrules") => {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadFormat = async (
    format: "antigravity_skill" | "gemini_md" | "cursorrules" | "claude_md" | "copilot" | "windsurf"
  ) => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/projects/${encodeURIComponent(targetProjectId)}/skills/export?format=${format}`);
      if (res.ok) {
        const text = await res.text();
        const filename =
          format === "antigravity_skill"
            ? "SKILL.md"
            : format === "gemini_md"
            ? "GEMINI.md"
            : format === "cursorrules"
            ? ".cursorrules"
            : format === "claude_md"
            ? "CLAUDE.md"
            : format === "copilot"
            ? "copilot-instructions.md"
            : ".windsurfrules";
        handleDownloadCursorRules(text, filename);
      }
    } catch (e) {
      console.error("Failed to export skills", e);
    }
  };

  if (!isOpen || !mounted) return null;
  if (typeof document === "undefined" || !document?.body) return null;

  const totalActiveRulesCount = libRules.length;

  // === 角色提示 banner: 明确告诉开发者这里是为守门员设计的 ===

  // 当前闭环进度：已应用=4；Evolve 加载中=1；Evolve 出结果=2；Library=3
  const activeStage: 1 | 2 | 3 | 4 = appliedSuccess
    ? 4
    : activeTab === "evolve"
    ? loading
      ? 1
      : 2
    : 3;

  // 闭环流程图子组件
  const FlowDiagram = () => {
    const steps = [
      { icon: ShieldAlert, label: "① 拦截", desc: "Pre-Commit 捕获缺陷", activeColor: "rose" },
      { icon: Wand2, label: "② 提炼", desc: "AI 总结防御原则", activeColor: "amber" },
      { icon: Layers, label: "③ 固化", desc: "入库为规则与 Skill", activeColor: "indigo" },
      { icon: GitBranch, label: "④ 生效", desc: "AI Review / 提交自动应用", activeColor: "emerald" },
    ];
    return (
      <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-rose-50/30 via-amber-50/20 to-emerald-50/30 dark:from-rose-950/10 dark:via-amber-950/10 dark:to-emerald-950/10">
        <div className="flex items-center gap-1.5">
          {steps.map((step, idx) => {
            const isActive = activeStage >= (idx + 1);
            const Icon = step.icon;
            return (
              <React.Fragment key={step.label}>
                <div
                  className={cn(
                    "flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all",
                    isActive
                      ? "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm"
                      : "border-slate-200/50 dark:border-slate-800/50 bg-white/40 dark:bg-slate-900/30"
                  )}
                >
                  <div
                    className={cn(
                      "h-7 w-7 rounded-md flex items-center justify-center shrink-0 transition-colors",
                      isActive
                        ? step.activeColor === "rose"
                          ? "bg-rose-500 text-white"
                          : step.activeColor === "amber"
                          ? "bg-amber-500 text-white"
                          : step.activeColor === "indigo"
                          ? "bg-indigo-500 text-white"
                          : "bg-emerald-500 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div
                      className={cn(
                        "text-[11px] font-bold leading-tight",
                        isActive ? "text-slate-900 dark:text-slate-100" : "text-slate-400"
                      )}
                    >
                      {step.label}
                    </div>
                    <div className="text-[9px] text-slate-500 dark:text-slate-400 leading-tight truncate">
                      {step.desc}
                    </div>
                  </div>
                </div>
                {idx < steps.length - 1 && (
                  <ArrowRight
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      activeStage > idx + 1
                        ? "text-indigo-500 dark:text-indigo-400"
                        : "text-slate-300 dark:text-slate-700"
                    )}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
        {/* 角色提示 banner: 守门员 vs 开发者 */}
        {showRoleHint && (
          <div className="px-6 pt-4 pb-0">
            <div className="flex items-start gap-3 rounded-lg border border-sky-200/70 dark:border-sky-800/40 bg-sky-50/60 dark:bg-sky-950/20 px-3 py-2 text-xs">
              <span className="text-base leading-none">🛡️</span>
              <div className="flex-1 text-sky-900 dark:text-sky-200">
                <strong>该控制台主要为守门员设计。</strong>
                <span className="ml-1 text-sky-700 dark:text-sky-300">
                  开发者只需 <code className="px-1 py-0.5 rounded bg-white/70 dark:bg-slate-900/60 font-mono text-[11px]">git commit</code>，由 hook 零交互完成：拉推送、AI 审查、AI 重写。不需要打开此页面。
                </span>
              </div>
              <button
                type="button"
                aria-label="隐藏提示"
                onClick={() => setShowRoleHint(false)}
                className="text-sky-500 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-200 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-amber-500 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-md shadow-amber-500/20 text-white shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  代码经验自沉淀与 AI Skill 进化闭环
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  Self-Evolving Guard
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                <FolderGit2 className="h-3.5 w-3.5 text-slate-400" />
                <span>目标仓库:</span>
                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                  {targetProjectId}
                </span>
                <span>· 将拦截到的缺陷转化为永久工程防御卡点与 IDE Agent 智能体技能</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* AI Skill Evolution Loop Diagram */}
        <FlowDiagram />

        {/* Navigation Tabs */}
        <div className="flex items-center px-6 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <button
            onClick={() => setActiveTab("evolve")}
            className={cn(
              "flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors",
              activeTab === "evolve"
                ? "border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-50/20 dark:bg-amber-950/10"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>提炼沉淀规则 (Synthesize & Learn)</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("batch");
              fetchBatchEvents();
            }}
            className={cn(
              "flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors",
              activeTab === "batch"
                ? "border-cyan-500 text-cyan-600 dark:text-cyan-400 bg-cyan-50/20 dark:bg-cyan-950/10"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            )}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>批量聚合提炼 (Batch Aggregate)</span>
            {batchSelected.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-cyan-500 text-white font-mono leading-none">
                {batchSelected.length}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab("library");
              fetchProjectLibrary();
            }}
            className={cn(
              "flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors relative",
              activeTab === "library"
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-indigo-50/20 dark:bg-indigo-950/10"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            )}
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>已沉淀知识库与规则列表</span>
            {totalActiveRulesCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-indigo-500 text-white font-mono leading-none">
                {totalActiveRulesCount}
              </span>
            )}
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === "batch" ? (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-start gap-3 rounded-lg border border-cyan-200/60 dark:border-cyan-800/40 bg-cyan-50/60 dark:bg-cyan-950/20 px-4 py-3">
                <Layers className="h-4 w-4 text-cyan-600 dark:text-cyan-400 mt-0.5 shrink-0" />
                <div className="text-xs text-cyan-900 dark:text-cyan-200">
                  <strong className="font-semibold">批量聚合提炼:</strong>
                  <span className="ml-1">
                    从多条拦截事件中提取共同根因, 一次性提炼为一条跨场景的通用规则, 避免 N 条窄规则凑团难维护。
                  </span>
                </div>
              </div>

              {/* Error / status */}
              {batchError && (
                <div className="px-3 py-2 rounded-md bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-700 dark:text-rose-300">
                  ⚠️ {batchError}
                </div>
              )}

              {/* Events list (multi-select) */}
              {batchLoading && batchEvents.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center">
                  <div className="h-8 w-8 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                  <div className="mt-3 text-xs text-slate-500">加载拦截事件列表...</div>
                </div>
              ) : batchEvents.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                  暂无可聚合事件。请让 hook 拦截一些 critical issues 后再来。
                </div>
              ) : (
                <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-2">
                  {batchEvents.map((ev, idx) => {
                    const id = String(ev.id ?? idx);
                    const selected = batchSelected.includes(id);
                    const ci = (ev.critical_issues ?? []).slice(0, 2);
                    const fname = ev.files?.[0]?.filename ?? ev.filename ?? "unknown";
                    return (
                      <label
                        key={id}
                        className={cn(
                          "flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors",
                          selected
                            ? "border-cyan-400 dark:border-cyan-700 bg-cyan-50/50 dark:bg-cyan-950/20"
                            : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleBatchSelect(id)}
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-mono font-semibold text-slate-700 dark:text-slate-300 truncate">
                              {fname}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 font-mono">
                              {ev.critical_issues?.length ?? 0} critical
                            </span>
                            <span className="text-[10px] text-slate-400 ml-auto font-mono shrink-0">
                              {ev.timestamp ? new Date(ev.timestamp).toLocaleString("zh-CN", { hour12: false }).slice(5, 16) : ""}
                            </span>
                          </div>
                          {ci.length > 0 && (
                            <ul className="mt-1.5 space-y-0.5 text-[11px] text-slate-600 dark:text-slate-400">
                              {ci.map((c, i) => (
                                <li key={i} className="line-clamp-1">
                                  ❌ {c}
                                </li>
                              ))}
                              {(ev.critical_issues?.length ?? 0) > 2 && (
                                <li className="text-[10px] text-slate-400 italic">
                                  +{(ev.critical_issues?.length ?? 0) - 2} 项更多...
                                </li>
                              )}
                            </ul>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}

              {/* Action bar */}
              {batchEvents.length > 0 && (
                <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    已选 <strong className="text-cyan-600 dark:text-cyan-400 font-mono">{batchSelected.length}</strong> 条事件
                    {batchSelected.length > 0 && batchSelected.length < 2 && (
                      <span className="ml-2 text-rose-500">(至少 2 条才能聚合)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setBatchSelected([]);
                        setBatchResult(null);
                      }}
                      className="px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      清空选择
                    </button>
                    <button
                      type="button"
                      onClick={synthesizeBatchRule}
                      disabled={batchSelected.length < 2 || batchLoading}
                      className={cn(
                        "flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-md transition-colors",
                        batchSelected.length < 2 || batchLoading
                          ? "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                          : "bg-cyan-600 hover:bg-cyan-700 text-white shadow-sm shadow-cyan-500/20"
                      )}
                    >
                      {batchLoading ? (
                        <>
                          <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>AI 聚合提炼中...</span>
                        </>
                      ) : (
                        <>
                          <Wand2 className="h-3.5 w-3.5" />
                          <span>聚合生成规则</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Aggregated result preview */}
              {batchResult && (
                <div className="mt-4 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50/30 dark:bg-emerald-950/20 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                        ✓ AI 聚合结果 (跨 {batchResult.source_events ?? batchSelected.length} 条事件)
                      </div>
                      <h3 className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100">
                        {batchResult.title}
                      </h3>
                      {batchResult.common_root_cause && (
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                          🔑 共同根因: {batchResult.common_root_cause}
                        </p>
                      )}
                      {batchResult.source_files && batchResult.source_files.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {batchResult.source_files.slice(0, 6).map((f) => (
                            <span key={f} className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              {f}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setBatchResult(null)}
                      className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      aria-label="关闭"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {batchResult.summary && (
                    <p className="text-xs text-slate-700 dark:text-slate-300">
                      {batchResult.summary}
                    </p>
                  )}
                  <details className="text-xs">
                    <summary className="cursor-pointer text-cyan-600 dark:text-cyan-400 font-semibold">
                      查看正反示例 + Skill 内容
                    </summary>
                    <div className="mt-2 space-y-2">
                      {batchResult.bad_snippet && (
                        <pre className="p-2 rounded bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-[11px] overflow-x-auto whitespace-pre">
                          {batchResult.bad_snippet}
                        </pre>
                      )}
                      {batchResult.good_snippet && (
                        <pre className="p-2 rounded bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-[11px] overflow-x-auto whitespace-pre">
                          {batchResult.good_snippet}
                        </pre>
                      )}
                    </div>
                  </details>
                </div>
              )}
            </div>
          ) : activeTab === "evolve" ? (
            loading ? (
              <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
                <div className="h-10 w-10 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  AI 正在深度分析拦截日志与缺陷模式...
                </div>
                <p className="text-xs text-slate-400 max-w-sm">
                  正在提炼防御性编程准则、提取 Pre-Commit 正则表达式并生成 IDE Agent Skill 规范
                </p>
              </div>
            ) : synthesizedRule ? (
              <div className="space-y-5">
                {/* 进度条：当前所在闭环阶段 */}
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
                  {[
                    { label: "① 拦截事件", done: true },
                    { label: "② AI 提炼", done: true },
                    { label: "③ 准备固化", done: appliedSuccess },
                  ].map((step, idx, arr) => (
                    <React.Fragment key={step.label}>
                      <div className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors",
                        step.done
                          ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50"
                          : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800"
                      )}>
                        {step.done ? <CheckCircle2 className="h-3 w-3" /> : <div className="h-3 w-3 rounded-full border-2 border-slate-300 dark:border-slate-700" />}
                        <span>{step.label}</span>
                      </div>
                      {idx < arr.length - 1 && (
                        <ArrowRight className="h-3 w-3 text-slate-300 dark:text-slate-700 shrink-0" />
                      )}
                    </React.Fragment>
                  ))}
                  <span className="ml-auto text-[10px] text-slate-400 font-mono">点击底部按钮完成固化</span>
                </div>

                {/* 1. Bad vs Good Code Comparison (主视觉) */}
                <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/40 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
                      <Code2 className="h-4 w-4 text-indigo-500" />
                      <span>规范正反例对比</span>
                      <span className="text-[10px] text-slate-400 font-normal">Negative vs Positive</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">点击复制</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 divide-x divide-slate-100 dark:divide-slate-800">
                    {/* Bad Code */}
                    <div className="bg-rose-50/30 dark:bg-rose-950/10">
                      <div className="flex items-center justify-between px-3 py-2 border-b border-rose-100 dark:border-rose-900/30">
                        <span className="flex items-center gap-1.5 text-xs font-bold text-rose-700 dark:text-rose-300">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          ❌ 拦截反例
                        </span>
                        <button
                          onClick={() => handleCopy(synthesizedRule.bad_snippet, "bad")}
                          className="text-[10px] text-rose-600 hover:text-rose-800 dark:hover:text-rose-200 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-rose-100 dark:hover:bg-rose-950/40 transition-colors"
                        >
                          {copiedKey === "bad" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          {copiedKey === "bad" ? "已复制" : "复制"}
                        </button>
                      </div>
                      <pre className="p-3 text-[12px] font-mono text-rose-900 dark:text-rose-200 overflow-x-auto whitespace-pre-wrap leading-relaxed min-h-[100px]">
                        {synthesizedRule.bad_snippet}
                      </pre>
                    </div>

                    {/* Good Code */}
                    <div className="bg-emerald-50/30 dark:bg-emerald-950/10">
                      <div className="flex items-center justify-between px-3 py-2 border-b border-emerald-100 dark:border-emerald-900/30">
                        <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          ✅ 沉淀正例
                        </span>
                        <button
                          onClick={() => handleCopy(synthesizedRule.good_snippet, "good")}
                          className="text-[10px] text-emerald-600 hover:text-emerald-800 dark:hover:text-emerald-200 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-emerald-100 dark:hover:bg-emerald-950/40 transition-colors"
                        >
                          {copiedKey === "good" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          {copiedKey === "good" ? "已复制" : "复制"}
                        </button>
                      </div>
                      <pre className="p-3 text-[12px] font-mono text-emerald-900 dark:text-emerald-200 overflow-x-auto whitespace-pre-wrap leading-relaxed min-h-[100px]">
                        {synthesizedRule.good_snippet}
                      </pre>
                    </div>
                  </div>
                </div>

                {/* 2. Rule Summary (精简 chip 行) */}
                <div className="flex items-center gap-2 flex-wrap px-3 py-2.5 rounded-xl border border-amber-200/80 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/20">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                    {synthesizedRule.category === "stability"
                      ? "🛡️ 稳定性守护"
                      : synthesizedRule.category === "security"
                      ? "🔒 安全防护"
                      : "⚡ 性能与架构"}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
                    {synthesizedRule.severity === "critical" ? "致命阻断" : "优化建议"}
                  </span>
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate flex-1 min-w-0">
                    {synthesizedRule.title}
                  </span>
                  <Lightbulb className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  <span className="text-[11px] text-slate-700 dark:text-slate-300 font-medium line-clamp-1 max-w-md">
                    {synthesizedRule.summary}
                  </span>
                </div>

                {/* 3. IDE Agent Skill (默认折叠) */}
                <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/40 overflow-hidden">
                  <button
                    onClick={() => setExpandedSection(expandedSection === "skill" ? null : "skill")}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50/60 dark:hover:bg-slate-900/60 transition-colors"
                  >
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
                      <Cpu className="h-4 w-4 text-cyan-500" />
                      <span>IDE AI 智能体 Skill 规范</span>
                      <span className="text-[10px] text-slate-400 font-normal">(.cursorrules / SKILL.md)</span>
                    </div>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-slate-400 transition-transform",
                        expandedSection === "skill" && "rotate-180"
                      )}
                    />
                  </button>

                  {expandedSection === "skill" && (
                    <div className="px-4 pb-3 space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleCopy(synthesizedRule.skill_markdown, "skill")}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors"
                        >
                          {copiedKey === "skill" ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                          {copiedKey === "skill" ? "已复制 Skill" : "复制 Skill Markdown"}
                        </button>
                        <button
                          onClick={() => handleDownloadCursorRules(synthesizedRule.skill_markdown, ".cursorrules")}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-xs font-medium text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 transition-colors"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>导出 .cursorrules</span>
                        </button>
                      </div>
                      <div className="p-3 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-900 text-slate-200 font-mono text-xs overflow-x-auto">
                        <pre className="whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto text-slate-300">
                          {synthesizedRule.skill_markdown}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Pre-Commit Gatekeeper Rule (默认折叠) */}
                <div className="rounded-xl border border-indigo-200/80 dark:border-indigo-900/40 bg-indigo-50/20 dark:bg-indigo-950/10 overflow-hidden">
                  <button
                    onClick={() => setExpandedSection(expandedSection === "gate" ? null : "gate")}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-colors"
                  >
                    <div className="flex items-center gap-2 text-xs font-bold text-indigo-900 dark:text-indigo-200">
                      <ShieldAlert className="h-4 w-4 text-indigo-500" />
                      <span>Git Pre-Commit 门禁静态卡点规则</span>
                      <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono font-normal">
                        本地提交前实时正则拦截
                      </span>
                    </div>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-indigo-400 transition-transform",
                        expandedSection === "gate" && "rotate-180"
                      )}
                    />
                  </button>

                  {expandedSection === "gate" && (
                    <div className="px-4 pb-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs border-t border-indigo-100 dark:border-indigo-900/40 pt-3">
                      <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/60">
                        <span className="text-[10px] text-slate-400 block mb-0.5">静态检测正则 (Pattern):</span>
                        <code className="font-mono text-indigo-600 dark:text-indigo-400 font-bold break-all">
                          {synthesizedRule.gate_rule.pattern}
                        </code>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/60">
                        <span className="text-[10px] text-slate-400 block mb-0.5">拦截提示文案 (Message):</span>
                        <span className="text-slate-700 dark:text-slate-300 font-medium">
                          {synthesizedRule.gate_rule.message}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-slate-400">
                请选择一条审计拦截事件以触发规则提炼。
              </div>
            )
          ) : (
            /* Tab 2: Repository Rules & Skills Library */
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    仓库已固化的质量规范与 Skill 资产
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    该项目在本地提交时受以下门禁规则强制卡点，AI Reviewer 与 IDE 智能体亦自动加载相关上下文。
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchProjectLibrary}
                    disabled={libLoading}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="刷新规则库"
                  >
                    <RefreshCw className={cn("h-4 w-4", libLoading && "animate-spin")} />
                  </button>

                  {libSkills.length > 0 && (
                    <button
                      onClick={() => {
                        const fullMd = libSkills
                          .map((s) => s.markdown || `# ${s.title}\n\n${s.summary}`)
                          .join("\n\n---\n\n");
                        handleDownloadCursorRules(fullMd, `.cursorrules`);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-semibold shadow-sm transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>一键导出全部 Skill (.cursorrules)</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Push Mode: server -> local repo, one-key confirmation */}
              <PushModeCard
                pushState={pushState}
                pushLoading={pushLoading}
                pushToast={pushToast}
                onTriggerPush={handleTriggerPush}
                onCancelPending={handleCancelPending}
                onToggleEnabled={handleTogglePushEnabled}
              />

              {/* Developer Skill Usage & Consumption Guide */}
              <div className="p-4 rounded-xl border border-indigo-200/80 dark:border-indigo-900/50 bg-gradient-to-br from-indigo-50/60 via-white to-indigo-50/20 dark:from-indigo-950/30 dark:via-slate-900 dark:to-slate-900/50 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400 animate-pulse" />
                    <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
                      💡 开发者如何在项目中使用这些已沉淀的 Skill？
                    </span>
                  </div>
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono">
                    原生适配 Cursor / Copilot / Claude Code / Windsurf
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-2">
                    <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Terminal className="h-3.5 w-3.5 text-cyan-500" />
                      <span>方式 1：终端一行命令拉取 (任何外部项目通用 · 零文件依赖)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      外部项目无需包含任何本地脚本，直接使用系统自带的 <code className="text-cyan-600 font-mono">curl</code> 一行写入规范：
                    </p>
                    <div className="flex items-center justify-between p-2 rounded bg-slate-900 text-slate-200 font-mono text-[10.5px]">
                      <code className="break-all">{`curl -s ${serverUrl}/api/projects/${targetProjectId}/skills/export -o .cursorrules`}</code>
                      <button
                        onClick={() => handleCopy(`curl -s ${serverUrl}/api/projects/${targetProjectId}/skills/export -o .cursorrules`, "cmd-curl")}
                        className="text-slate-400 hover:text-white transition-colors ml-2 shrink-0"
                        title="复制命令"
                      >
                        {copiedKey === "cmd-curl" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      * 若该项目已按指引安装了 Git 门禁，亦可直接运行: <code className="text-indigo-400 font-mono">node .git/hooks/pre-commit --sync-skills</code>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-2">
                    <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <FolderGit2 className="h-3.5 w-3.5 text-indigo-500" />
                      <span>方式 2：提交入库全员自动生效 (Team Git Sync)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      执行同步后，生成的 <code className="text-indigo-600 font-mono">.agent/skills/flowdev-quality/SKILL.md</code> 与 <code className="text-indigo-600 font-mono">GEMINI.md</code> 提交入库：
                    </p>
                    <div className="p-2 rounded bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-mono text-[11px] leading-relaxed">
                      <code>git add .agent GEMINI.md .cursorrules &amp;&amp; git commit -m &quot;chore: 沉淀团队 AI 规范&quot;</code>
                    </div>
                    <p className="text-[10.5px] text-emerald-600 dark:text-emerald-400 font-medium">
                      ✓ 团队其他成员执行 <code>git pull</code> 后，本地 Antigravity / Cursor / Copilot 全员自动生效！
                    </p>
                  </div>
                </div>

                <div className="pt-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 font-semibold">按需导出规则文件到项目</span>
                    <span className="text-[10px] text-slate-400 font-mono">点击卡片下载到本地</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {/* Antigravity Skill - 主推 */}
                    <button
                      onClick={() => handleDownloadFormat("antigravity_skill")}
                      className="group flex flex-col items-start gap-1.5 p-2.5 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white transition-all shadow-sm text-left"
                    >
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
                        <span className="text-[11px] font-bold">Antigravity Skill</span>
                      </div>
                      <span className="text-[10px] text-blue-100 font-mono">SKILL.md</span>
                      <span className="text-[9px] text-blue-200 leading-tight">智能体技能模块</span>
                    </button>

                    <button
                      onClick={() => handleDownloadFormat("gemini_md")}
                      className="group flex flex-col items-start gap-1.5 p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 transition-all text-left"
                    >
                      <div className="flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-blue-500" />
                        <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100">Antigravity Rules</span>
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">GEMINI.md</span>
                      <span className="text-[9px] text-slate-400 leading-tight">Antigravity 项目规则</span>
                    </button>

                    <button
                      onClick={() => handleDownloadFormat("cursorrules")}
                      className="group flex flex-col items-start gap-1.5 p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 transition-all text-left"
                    >
                      <div className="flex items-center gap-1.5">
                        <Download className="h-3.5 w-3.5 text-indigo-500" />
                        <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100">Cursor</span>
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">.cursorrules</span>
                      <span className="text-[9px] text-slate-400 leading-tight">Cursor AI 规则</span>
                    </button>

                    <button
                      onClick={() => handleDownloadFormat("claude_md")}
                      className="group flex flex-col items-start gap-1.5 p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-amber-400 dark:hover:border-amber-500 transition-all text-left"
                    >
                      <div className="flex items-center gap-1.5">
                        <Download className="h-3.5 w-3.5 text-amber-500" />
                        <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100">Claude Code</span>
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">CLAUDE.md</span>
                      <span className="text-[9px] text-slate-400 leading-tight">Claude Code 指南</span>
                    </button>

                    <button
                      onClick={() => handleDownloadFormat("copilot")}
                      className="group flex flex-col items-start gap-1.5 p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-cyan-400 dark:hover:border-cyan-500 transition-all text-left"
                    >
                      <div className="flex items-center gap-1.5">
                        <Download className="h-3.5 w-3.5 text-cyan-500" />
                        <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100">Copilot</span>
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">copilot-instructions.md</span>
                      <span className="text-[9px] text-slate-400 leading-tight">GitHub Copilot 指令</span>
                    </button>

                    <button
                      onClick={() => handleDownloadFormat("windsurf")}
                      className="group flex flex-col items-start gap-1.5 p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-teal-400 dark:hover:border-teal-500 transition-all text-left"
                    >
                      <div className="flex items-center gap-1.5">
                        <Download className="h-3.5 w-3.5 text-teal-500" />
                        <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100">Windsurf</span>
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">.windsurfrules</span>
                      <span className="text-[9px] text-slate-400 leading-tight">Windsurf 规范</span>
                    </button>
                  </div>
                </div>
              </div>

              {libLoading ? (
                <div className="py-16 flex flex-col items-center justify-center text-center space-y-2">
                  <div className="h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-slate-400">正在读取仓库策略数据库...</span>
                </div>
              ) : libRules.length === 0 && libSkills.length === 0 ? (
                <div className="p-8 rounded-xl border border-dashed border-slate-300 dark:border-slate-800 text-center space-y-3 bg-slate-50/50 dark:bg-slate-900/30">
                  <div className="h-10 w-10 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    当前仓库尚未沉淀自学习规则
                  </div>
                  <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                    在质量大盘的提交审计记录中，点击「💡 沉淀为规则与 Skill」，即可将拦截教训转化为长效防御资产。
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Gatekeeper Rules */}
                  {libRules.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <ShieldAlert className="h-3.5 w-3.5 text-rose-500" />
                        <span>Pre-Commit 门禁静态卡点规则 ({libRules.length})</span>
                      </div>
                      <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900/40">
                        {libRules.map((rule, idx) => (
                          <div
                            key={idx}
                            className="p-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                          >
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                                  {rule.title || `卡点规则 #${idx + 1}`}
                                </span>
                                <span className="px-2 py-0.2 rounded text-[10px] font-mono bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40">
                                  {rule.level === "critical" ? "致命阻断" : "告警建议"}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                                <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-indigo-600 dark:text-indigo-400">
                                  {rule.pattern}
                                </span>
                                <span>· {rule.message}</span>
                              </div>
                            </div>

                            <button
                              onClick={() => handleDeleteRule(rule.title)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded transition-colors"
                              title="删除此卡点规则"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Agent Skills */}
                  {libSkills.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Cpu className="h-3.5 w-3.5 text-cyan-500" />
                        <span>已入库 IDE AI Agent Skills ({libSkills.length})</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {libSkills.map((skill, idx) => (
                          <div
                            key={idx}
                            className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/50 space-y-2 hover:shadow-sm transition-shadow"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                                {skill.title}
                              </span>
                              <button
                                onClick={() => handleCopy(skill.markdown || skill.summary, `lib-skill-${idx}`)}
                                className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                                title="复制 Skill 内容"
                              >
                                {copiedKey === `lib-skill-${idx}` ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2">
                              {skill.summary}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span>门禁闭环保障: 固化后即刻在后续提交与 AI Review 中自动生效</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              关闭
            </button>

            {activeTab === "evolve" && synthesizedRule && (
              <button
                onClick={handleApplyRule}
                disabled={applyLoading || appliedSuccess}
                className={cn(
                  "inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md",
                  appliedSuccess
                    ? "bg-emerald-600 text-white cursor-default"
                    : "bg-gradient-to-r from-amber-500 via-indigo-600 to-cyan-500 hover:from-amber-600 hover:to-indigo-700 text-white hover:shadow-lg"
                )}
              >
                {applyLoading ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>正在固化策略并更新门禁...</span>
                  </>
                ) : appliedSuccess ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>已成功固化到本仓库门禁！</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>🌟 固化并同步至本仓库门禁</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
// ---------------------------------------------------------------------------
// Push Mode Card — "一键推送至本地代码仓库"
// ---------------------------------------------------------------------------
interface PushStateShape {
  policy_version: string;
  pending_push_version: string | null;
  last_applied_version: string;
  push_enabled: boolean;
  pending: boolean;
  changelog: Array<{ reason?: string; version?: string; at?: string }>;
  last_pushed_at: string | null;
  last_applied_at: string | null;
}

interface PushModeCardProps {
  pushState: PushStateShape;
  pushLoading: boolean;
  pushToast: { kind: "success" | "error" | "info"; text: string } | null;
  onTriggerPush: () => void;
  onCancelPending: () => void;
  onToggleEnabled: () => void;
}

function PushModeCard({
  pushState,
  pushLoading,
  pushToast,
  onTriggerPush,
  onCancelPending,
  onToggleEnabled,
}: PushModeCardProps) {
  const lastAppliedDisplay = pushState.last_applied_at
    ? pushState.last_applied_at.replace("T", " ").replace("Z", "").slice(0, 19)
    : null;

  return (
    <div
      className={cn(
        "p-3.5 rounded-xl border space-y-2.5 shadow-sm transition-colors",
        pushState.pending
          ? "border-amber-300 dark:border-amber-700/60 bg-gradient-to-br from-amber-50 via-white to-amber-50/30 dark:from-amber-950/30 dark:via-slate-900 dark:to-slate-900/50"
          : "border-emerald-200/80 dark:border-emerald-900/50 bg-gradient-to-br from-emerald-50/60 via-white to-emerald-50/20 dark:from-emerald-950/30 dark:via-slate-900 dark:to-slate-900/50"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Send
              className={cn(
                "h-4 w-4",
                pushState.pending
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-emerald-600 dark:text-emerald-400"
              )}
            />
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
              📤 一键推送至本地代码仓库
            </span>
            <span
              className={cn(
                "px-1.5 py-0.5 rounded text-[10px] font-mono border",
                pushState.pending
                  ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                  : "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
              )}
            >
              v{pushState.policy_version}
            </span>
            {pushState.pending && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 animate-pulse">
                ● 待本地确认
              </span>
            )}
          </div>

          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
            {pushState.pending ? (
              <>
                📦 刚刚沉淀了{" "}
                <code className="px-1 rounded bg-amber-100 dark:bg-amber-900/40 font-mono">
                  v{pushState.last_applied_version || pushState.policy_version}
                </code>
                ，本地开发者下次{" "}
                <code className="px-1 rounded bg-slate-100 dark:bg-slate-800 font-mono">
                  git commit
                </code>{" "}
                时会在终端询问是否同步，按{" "}
                <kbd className="px-1 rounded border border-amber-300 dark:border-amber-700 font-mono">
                  Y
                </kbd>{" "}
                即自动写入 AGENTS.md / .cursorrules / SKILL.md 并随本次 commit 入库。
              </>
            ) : lastAppliedDisplay ? (
              <>
                ✅ 最近一次沉淀{" "}
                <code className="px-1 rounded bg-slate-100 dark:bg-slate-800 font-mono">
                  v{pushState.last_applied_version}
                </code>{" "}
                已于{" "}
                <span className="font-mono text-emerald-700 dark:text-emerald-300">
                  {lastAppliedDisplay}
                </span>{" "}
                被开发者应用入库。下次守门员点击【沉淀】时会自动下发新版本。
              </>
            ) : (
              <>
                守门员点击【沉淀】后，规则会自动下发给所有本地仓库。开发者下次{" "}
                <code className="px-1 rounded bg-slate-100 dark:bg-slate-800 font-mono">
                  git commit
                </code>{" "}
                时会收到 Y/n 询问，无需手动同步。
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {pushState.pending && (
            <button
              onClick={onCancelPending}
              disabled={pushLoading}
              className="px-2.5 py-1.5 text-[11px] rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              title="取消本次推送标记"
            >
              取消
            </button>
          )}
          <button
            onClick={onToggleEnabled}
            disabled={pushLoading}
            className={cn(
              "p-1.5 rounded-md border transition-colors disabled:opacity-50",
              pushState.push_enabled
                ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/50"
                : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
            )}
            title={pushState.push_enabled ? "推送模式已开启 · 点击关闭" : "推送模式已关闭 · 点击开启"}
          >
            {pushState.push_enabled ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={onTriggerPush}
            disabled={pushLoading || !pushState.push_enabled}
            className={cn(
              "px-3 py-1.5 text-[11px] font-bold rounded-md transition-all flex items-center gap-1.5",
              pushState.pending
                ? "bg-amber-500 hover:bg-amber-600 text-white shadow-sm"
                : "bg-slate-700 hover:bg-slate-800 text-white shadow-sm",
              (pushLoading || !pushState.push_enabled) && "opacity-50 cursor-not-allowed"
            )}
            title="通常无需点击：守门员点击【沉淀】后，系统已自动下发给所有本地仓库。仅在需要强制 bump 版本号时使用。"
          >
            {pushLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {pushState.pending ? "强制再推一次" : "手动再推送"}
          </button>
        </div>
      </div>

      {pushToast && (
        <div
          className={cn(
            "px-2.5 py-1.5 rounded-md text-[11px] flex items-start gap-1.5 border",
            pushToast.kind === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
              : pushToast.kind === "error"
              ? "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800"
              : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
          )}
        >
          {pushToast.kind === "success" ? (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          ) : pushToast.kind === "error" ? (
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          ) : (
            <CircleDot className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          )}
          <span className="flex-1">{pushToast.text}</span>
        </div>
      )}

      <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 font-mono flex-wrap">
        <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
          ① 守门员点击【沉淀】
        </span>
        <ArrowRight className="h-3 w-3" />
        <span className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60">
          ② 后端标记 pending_push_version
        </span>
        <ArrowRight className="h-3 w-3" />
        <span className="px-1.5 py-0.5 rounded bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-300 border border-cyan-200/60 dark:border-cyan-800/60">
          ③ 本地 git commit → 终端询问 Y/n
        </span>
        <ArrowRight className="h-3 w-3" />
        <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
          ④ 自动写入 + git add
        </span>
        <ArrowRight className="h-3 w-3" />
        <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
          ⑤ 入库 · 团队 pull 即生效
        </span>
      </div>
    </div>
  );
}
