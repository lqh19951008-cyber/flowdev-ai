"use client";

/**
 * AuditChatSkillModal
 * ---------------------------------------------------------------------------
 * Powers the "AI 对话生成对应 Skill 下发" feature in the "全员提交拦截与审计流水"
 * dashboard. The flow is:
 *
 *   1. Gatekeeper selects 1+ audit events (rows in the audit log table).
 *   2. Opens this modal — events are passed in via the `events` prop.
 *   3. AI synthesizes the first rule draft from the aggregated events
 *      (calls `/api/rules/synthesize` with `events[]`).
 *   4. Gatekeeper chats with the AI in natural language — each turn hits
 *      `/api/rules/refine` to produce a new rule draft.
 *   5. On Apply, this modal calls the unified `/api/rules/dispatch-from-events`
 *      endpoint, which atomically:
 *        - Saves the rule to every selected project's policy.
 *        - Bumps policy_version for each project.
 *        - Marks a pending_push so every local Git hook prompts the
 *          developer with Y/n on their next commit.
 *        - Broadcasts `rule_pushed` SSE events back to the dashboard.
 *
 * The modal shows push status per-project in real time so the gatekeeper can
 * see whether each team member's local repo will receive the new skill.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  Wand2,
  Send,
  ArrowRight,
  Sparkles,
  GitBranch,
  User,
  AlertTriangle,
  ChevronDown,
  Layers,
  Rocket,
  CheckCircle2,
  Copy,
  Check,
  RotateCw,
  AlertOctagon,
} from "lucide-react";
import {
  Button,
  Input,
  Spinner,
  Checkbox,
  Tabs,
  Tab,
  Chip,
  Tooltip,
  Divider,
  Card,
  CardBody,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  Table,
  TableHeader,
  TableBody,
  TableColumn,
  TableRow,
  TableCell,
  Snippet,
  useDisclosure,
} from "@heroui/react";
import { cn } from "@/lib/utils";
import {
  AuditChatMessage,
  AuditDispatchResponse,
  ScanEventItem,
  SynthesizedRule,
} from "@/types/flow";

interface AuditChatSkillModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Audit events selected by the gatekeeper from the dashboard table. */
  events: ScanEventItem[];
  /** All projects available to dispatch to. */
  projectIds: string[];
  /** Optional default selection (e.g. projects involved in the events). */
  defaultProjectIds?: string[];
  /** Called after a successful dispatch so the dashboard can refresh. */
  onDispatched?: (response: AuditDispatchResponse) => void;
}

type Step = "context" | "chat" | "dispatch" | "done";

export function AuditChatSkillModal({
  isOpen,
  onClose,
  events,
  projectIds,
  defaultProjectIds,
  onDispatched,
}: AuditChatSkillModalProps) {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<Step>("context");
  const [messages, setMessages] = useState<AuditChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [currentRule, setCurrentRule] = useState<SynthesizedRule | null>(null);
  const [synthError, setSynthError] = useState<string | null>(null);
  const [pushImmediately, setPushImmediately] = useState(true);
  const [language, setLanguage] = useState<string>("typescript");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Target projects for dispatch (multi-select)
  const initialProjects = useMemo(() => {
    if (defaultProjectIds && defaultProjectIds.length > 0) {
      const eventProjects = Array.from(
        new Set(
          (events ?? [])
            .map((e) => e?.project_id)
            .filter(Boolean) as string[]
        )
      );
      const merged = Array.from(new Set([...defaultProjectIds, ...eventProjects]));
      return merged.filter((p) => projectIds.includes(p));
    }
    const eventProjects = Array.from(
      new Set(
        (events ?? []).map((e) => e?.project_id).filter(Boolean) as string[]
      )
    );
    return eventProjects.length > 0 ? eventProjects : projectIds.slice(0, 1);
  }, [events, defaultProjectIds, projectIds]);
  const [targetProjects, setTargetProjects] = useState<string[]>(initialProjects);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);

  const [dispatching, setDispatching] = useState(false);
  const [dispatchResult, setDispatchResult] =
    useState<AuditDispatchResponse | null>(null);
  const [dispatchError, setDispatchError] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const [showEventsPanel, setShowEventsPanel] = useState(true);

  useEffect(() => setMounted(true), []);

  // Re-init whenever modal opens with new events
  useEffect(() => {
    if (!isOpen) return;
    setStep("context");
    setMessages([]);
    setInput("");
    setCurrentRule(null);
    setSynthError(null);
    setDispatchResult(null);
    setDispatchError(null);
    setTargetProjects(initialProjects);
  }, [isOpen, events, initialProjects]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, chatLoading]);

  // Auto-trigger initial synthesis when entering chat step (only once)
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (step !== "chat") {
      autoStartedRef.current = false;
      return;
    }
    if (autoStartedRef.current) return;
    if (currentRule || chatLoading) return;
    autoStartedRef.current = true;
    synthesizeInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const safeEvents = useMemo(
    () => (events ?? []).filter(Boolean),
    [events]
  );

  const totalCritical = useMemo(
    () => safeEvents.reduce((s, e) => s + (e?.critical_issues?.length ?? 0), 0),
    [safeEvents]
  );

  const distinctCommitters = useMemo(() => {
    const set = new Set<string>();
    safeEvents.forEach((e) => {
      const c = (e?.committer ?? "").trim();
      if (c) set.add(c);
    });
    return set.size;
  }, [safeEvents]);

  const distinctFiles = useMemo(() => {
    const set = new Set<string>();
    safeEvents.forEach((e) => {
      (e?.files ?? []).forEach((f) => {
        if (f?.filename) set.add(f.filename);
      });
    });
    return set.size;
  }, [safeEvents]);

  // ---------- Initial synthesis from events ----------
  const synthesizeInitial = async () => {
    setChatLoading(true);
    setSynthError(null);
    try {
      const eventsPayload = safeEvents.map((ev) => ({
        event_id: ev?.id ?? "",
        filename: (ev?.files ?? [])[0]?.filename ?? "unknown",
        committer: ev?.committer ?? "unknown",
        branch: ev?.branch ?? "main",
        critical_issues: ev?.critical_issues ?? [],
        suggestions: ev?.suggestions ?? [],
        timestamp: ev?.created_at ?? "",
      }));

      const primaryProject = safeEvents[0]?.project_id || "default";

      const res = await fetch("http://127.0.0.1:8000/api/rules/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: primaryProject,
          events: eventsPayload,
          language,
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
      }
      const rule: SynthesizedRule = await res.json();
      rule.source_events = safeEvents.length;
      rule.source_files = Array.from(
        new Set(
          safeEvents.flatMap(
            (e) =>
              (e?.files ?? [])
                .map((f) => f?.filename)
                .filter(Boolean) as string[]
          )
        )
      );
      setCurrentRule(rule);
      setMessages([
        {
          role: "assistant",
          content:
            `已基于 ${safeEvents.length} 条拦截事件（${distinctCommitters} 位开发者 / ${distinctFiles} 个文件 / ${totalCritical} 项 critical）` +
            ` 提炼出第一版规则。请在下方继续对话修改或直接进入"全员下发"。`,
          at: Date.now(),
        },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setSynthError(msg);
      setMessages([
        { role: "assistant", content: `❌ 初始生成失败：${msg}`, at: Date.now() },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  // ---------- Chat refinement ----------
  const sendChat = async () => {
    const text = input.trim();
    if (!text || !currentRule || chatLoading) return;
    const newUserMsg: AuditChatMessage = {
      role: "user",
      content: text,
      at: Date.now(),
    };
    const nextHistory: AuditChatMessage[] = [...messages, newUserMsg];
    setMessages(nextHistory);
    setInput("");
    setChatLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/rules/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          previous_rule: currentRule,
          messages: nextHistory.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          context: {
            project_ids: targetProjects,
            events: safeEvents.map((e) => ({
              filename: (e?.files ?? [])[0]?.filename ?? "unknown",
              committer: e?.committer ?? "unknown",
              critical_issues: e?.critical_issues ?? [],
              suggestions: e?.suggestions ?? [],
            })),
          },
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
      }
      const data: { rule: SynthesizedRule; previous_title?: string } =
        await res.json();
      const newRule = data?.rule;
      if (newRule && typeof newRule === "object") {
        newRule.source_events = currentRule.source_events ?? safeEvents.length;
        newRule.source_files = currentRule.source_files ?? [];
        setCurrentRule(newRule);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              `已根据 "${text.slice(0, 40)}${text.length > 40 ? "…" : ""}" 迭代优化。当前规则: ` +
              `${newRule.title ?? "未命名"} (共 ${safeEvents.length} 条事件)`,
            at: Date.now(),
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `⚠️ AI 返回格式异常，未能更新规则。`,
            at: Date.now(),
          },
        ]);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `❌ 迭代失败：${msg}`, at: Date.now() },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  // ---------- One-shot dispatch ----------
  const dispatchToAll = async () => {
    if (!currentRule || targetProjects.length === 0) return;
    setDispatching(true);
    setDispatchError(null);
    try {
      const res = await fetch(
        "http://127.0.0.1:8000/api/rules/dispatch-from-events",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            events: safeEvents,
            messages: messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            current_rule: currentRule,
            project_ids: targetProjects,
            push_immediately: pushImmediately,
            language,
          }),
        }
      );
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
      }
      const data: AuditDispatchResponse = await res.json();
      setDispatchResult(data);
      setStep("done");
      onDispatched?.(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setDispatchError(msg);
    } finally {
      setDispatching(false);
    }
  };

  const handleCopy = (text: string, key: string) => {
    if (typeof navigator !== "undefined" && navigator?.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  if (!isOpen || !mounted) return null;

  if (safeEvents.length === 0) {
    return (
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        size="md"
        placement="right"
        backdrop="blur"
        hideCloseButton
        classNames={{
          base: "bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl",
          backdrop: "bg-slate-950/50 backdrop-blur-xs",
        }}
      >
        <DrawerContent>
          <DrawerHeader className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 py-3 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-bold text-sm text-slate-900 dark:text-slate-100">AI 对话 Skill 生成器</span>
            </div>
            <Button isIconOnly size="sm" variant="light" onPress={onClose} aria-label="关闭抽屉">
              <X className="h-4 w-4 text-slate-400" />
            </Button>
          </DrawerHeader>
          <DrawerBody className="p-6 space-y-4">
            <div className="p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-200 leading-relaxed space-y-2">
              <p className="font-semibold">未选中拦截事件</p>
              <p>
                请先在「全员提交拦截与审计流水」列表中勾选至少 1 条记录，或直接在任意流水项右侧点击「✨ 提炼 Skill」快捷开启抽屉。
              </p>
            </div>
            <Button
              fullWidth
              size="sm"
              variant="flat"
              color="primary"
              onPress={onClose}
              className="font-semibold"
            >
              返回流水列表选择
            </Button>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      size="5xl"
      placement="right"
      backdrop="blur"
      scrollBehavior="inside"
      hideCloseButton
      classNames={{
        base: "bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl max-w-full sm:max-w-[850px] lg:max-w-[960px] xl:max-w-[1060px] w-full h-full",
        backdrop: "bg-slate-950/50 backdrop-blur-xs",
        body: "p-0",
      }}
    >
      <DrawerContent className="h-full flex flex-col overflow-hidden">
        {/* ========== Header (DrawerHeader) ========== */}
        <DrawerHeader className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-violet-50/60 via-indigo-50/40 to-cyan-50/40 dark:from-violet-950/20 dark:via-indigo-950/10 dark:to-cyan-950/10 shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-violet-500 via-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-violet-500/20 shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                AI 对话 Skill 生成器 · 选中事件 → 对话 → 全员下发
              </h2>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap mt-0.5">
                <Chip startContent
                  size="sm"
                  variant="flat"
                  color="secondary"
                  classNames={{ base: "h-5", content: "text-[10px] font-mono font-semibold px-1.5" }}
                >
                  {safeEvents.length} 条事件
                </Chip>
                <span className="text-slate-300">·</span>
                <span className="text-[11px]">{distinctCommitters} 位提交人</span>
                <span className="text-slate-300">·</span>
                <span className="text-[11px]">{distinctFiles} 个文件</span>
                <span className="text-slate-300">·</span>
                <Chip startContent
                  size="sm"
                  variant="flat"
                  color="danger"
                  classNames={{ base: "h-5", content: "text-[10px] font-mono font-semibold px-1.5" }}
                >
                  {totalCritical} 项 critical
                </Chip>
              </div>
            </div>
          </div>
          <Tooltip content="关闭 (ESC)" placement="left">
            <Button
              isIconOnly
              size="sm"
              variant="light"
              onPress={onClose}
              aria-label="关闭"
              className="text-slate-400 data-[hover=true]:text-slate-700 dark:data-[hover=true]:text-slate-200 shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </Tooltip>
        </DrawerHeader>

        {/* ========== Step indicator ========== */}
        <div className="flex items-center gap-1.5 px-5 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 overflow-x-auto shrink-0">
          {[
            { key: "context", label: "① 选中事件", desc: `${safeEvents.length} 条` },
            { key: "chat", label: "② AI 对话", desc: "迭代规则" },
            {
              key: "dispatch",
              label: "③ 全员下发",
              desc: `${targetProjects.length} 仓库`,
            },
            { key: "done", label: "④ 下发结果", desc: "Push 状态" },
          ].map((s, idx, arr) => {
            const reached =
              step === s.key ||
              (step === "chat" && s.key === "context") ||
              (step === "dispatch" &&
                (s.key === "context" || s.key === "chat")) ||
              (step === "done" && s.key !== "done");
            const active = step === s.key;
            return (
              <React.Fragment key={s.key}>
                <button
                  type="button"
                  onClick={() => {
                    if (s.key === "context") setStep("context");
                    else if (s.key === "chat" && currentRule) setStep("chat");
                    else if (s.key === "dispatch" && currentRule)
                      setStep("dispatch");
                    else if (s.key === "done" && dispatchResult)
                      setStep("done");
                  }}
                  className={cn(
                    "flex-1 min-w-[110px] flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer whitespace-nowrap",
                    active
                      ? "border-violet-400 dark:border-violet-600 bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300"
                      : reached
                      ? "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300"
                      : "border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/30 text-slate-400 cursor-not-allowed"
                  )}
                  disabled={!reached}
                >
                  <span className="font-mono">{s.label}</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
                    {s.desc}
                  </span>
                </button>
                {idx < arr.length - 1 && (
                  <ArrowRight className="h-3 w-3 text-slate-300 shrink-0" />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* ========== Body ========== */}
        <DrawerBody className="p-0 flex-1 overflow-hidden flex flex-col min-h-0">
          {/* === STEP 1: Context (selected events) === */}
          {step === "context" && (
            <div className="h-full overflow-y-auto p-5 space-y-4">
              <Card
                shadow="none"
                classNames={{
                  base: "bg-violet-50/60 dark:bg-violet-950/20 border border-violet-200/60 dark:border-violet-800/40",
                }}
              >
                <CardBody className="flex flex-row items-start gap-3 p-4">
                  <div className="h-7 w-7 shrink-0 rounded-full bg-violet-100 dark:bg-violet-950/40 flex items-center justify-center">
                    <Wand2 className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div className="text-xs text-violet-900 dark:text-violet-200 flex-1">
                    <strong className="font-semibold">守门员工作流</strong>
                    <span className="ml-1">
                      — 从「全员提交拦截与审计流水」勾选 {safeEvents.length} 条拦截事件 →
                      AI 提炼共性规则 → 自然语言对话微调 → 一键下发到 {targetProjects.length} 个仓库。
                      本地下次 git commit 会自动拉取并应用新规则。
                    </span>
                  </div>
                </CardBody>
              </Card>

              {/* Aggregate summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card shadow="none" classNames={{ base: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800" }}>
                  <CardBody className="p-3">
                    <div className="text-[11px] text-slate-500 flex items-center gap-1">
                      <Layers className="h-3 w-3" />
                      事件数
                    </div>
                    <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
                      {safeEvents.length}
                    </div>
                  </CardBody>
                </Card>
                <Card shadow="none" classNames={{ base: "bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-800/40" }}>
                  <CardBody className="p-3">
                    <div className="text-[11px] text-rose-600 dark:text-rose-400 flex items-center gap-1">
                      <AlertOctagon className="h-3 w-3" />
                      Critical 总数
                    </div>
                    <div className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-1">
                      {totalCritical}
                    </div>
                  </CardBody>
                </Card>
                <Card shadow="none" classNames={{ base: "bg-blue-50/40 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/40" }}>
                  <CardBody className="p-3">
                    <div className="text-[11px] text-blue-600 dark:text-blue-400 flex items-center gap-1">
                      <User className="h-3 w-3" />
                      涉及提交人
                    </div>
                    <div className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-1">
                      {distinctCommitters}
                    </div>
                  </CardBody>
                </Card>
                <Card shadow="none" classNames={{ base: "bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-800/40" }}>
                  <CardBody className="p-3">
                    <div className="text-[11px] text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                      <GitBranch className="h-3 w-3" />
                      涉及文件
                    </div>
                    <div className="text-2xl font-bold font-mono text-indigo-600 dark:text-indigo-400 mt-1">
                      {distinctFiles}
                    </div>
                  </CardBody>
                </Card>
              </div>

              {/* Selected events table */}
              <Card shadow="none" classNames={{ base: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden" }}>
                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/60">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-violet-500" />
                    选中事件列表 ({safeEvents.length})
                  </h4>
                  <Button
                    size="sm"
                    variant="light"
                    onPress={() => setShowEventsPanel((p) => !p)}
                    className="text-[11px] h-6 min-w-0 px-2"
                  >
                    {showEventsPanel ? "收起" : "展开"}
                  </Button>
                </div>
                {showEventsPanel && (
                  <div className="max-h-72 overflow-y-auto">
                    <Table
                      removeWrapper
                      aria-label="选中事件列表"
                      classNames={{
                        base: "min-w-full",
                        th: "bg-slate-50/60 dark:bg-slate-900/40 text-slate-500 text-[11px] font-semibold",
                        td: "text-xs py-2",
                      }}
                    >
                      <TableHeader>
                        <TableColumn className="text-left">状态</TableColumn>
                        <TableColumn className="text-left">仓库</TableColumn>
                        <TableColumn className="text-left">提交人 / 分支</TableColumn>
                        <TableColumn className="text-left">主要缺陷</TableColumn>
                        <TableColumn className="text-right">Critical</TableColumn>
                      </TableHeader>
                      <TableBody>
                        {safeEvents.map((ev) => (
                          <TableRow key={ev?.id ?? Math.random()}>
                            <TableCell>
                              {ev?.passed ? (
                                <Chip size="sm" variant="flat" color="success" classNames={{ base: "h-5", content: "text-[10px] font-mono px-1.5" }}>✓</Chip>
                              ) : (
                                <Chip size="sm" variant="flat" color="danger" classNames={{ base: "h-5", content: "text-[10px] font-mono px-1.5" }}>✗</Chip>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="font-mono text-blue-600 dark:text-cyan-400">
                                {ev?.project_id}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                                <User className="h-3 w-3 shrink-0" />
                                <span className="truncate max-w-[120px]">
                                  {ev?.committer}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono mt-0.5">
                                <GitBranch className="h-2.5 w-2.5 shrink-0" />
                                <span>{ev?.branch}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-1 max-w-[280px] block">
                                {ev?.critical_issues?.[0] ?? ev?.summary}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <Chip startContent
                                size="sm"
                                variant="flat"
                                color={(ev?.critical_issues?.length ?? 0) > 0 ? "danger" : "default"}
                                classNames={{ base: "h-5", content: "text-[10px] font-bold font-mono px-1.5" }}
                              >
                                {ev?.critical_issues?.length ?? 0}
                              </Chip>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </Card>

              {/* Target projects selector */}
              <Card shadow="none" classNames={{ base: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800" }}>
                <CardBody className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-violet-500" />
                      下发目标仓库（多选）
                    </h4>
                    <Button
                      size="sm"
                      variant="light"
                      onPress={() => setProjectPickerOpen((p) => !p)}
                      endContent={
                        <ChevronDown
                          className={cn(
                            "h-3 w-3 transition-transform",
                            projectPickerOpen && "rotate-180"
                          )}
                        />
                      }
                      className="text-[11px] h-6 min-w-0 px-2 text-violet-600 dark:text-violet-400"
                    >
                      {projectPickerOpen ? "收起" : "选择仓库"}
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {targetProjects.length === 0 && (
                      <Chip startContent
                        size="sm"
                        variant="flat"
                        color="warning"
                        classNames={{ base: "h-6", content: "text-[11px] px-2" }}
                      >
                        ⚠ 请至少选择 1 个仓库
                      </Chip>
                    )}
                    {targetProjects.map((p) => (
                      <Chip startContent
                        key={p}
                        size="sm"
                        variant="flat"
                        color="secondary"
                        onClose={() =>
                          setTargetProjects((prev) =>
                            prev.filter((x) => x !== p)
                          )
                        }
                        classNames={{
                          base: "h-6 font-mono",
                          content: "text-[11px] pl-2 pr-1",
                        }}
                      >
                        {p}
                      </Chip>
                    ))}
                  </div>
                  {projectPickerOpen && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40">
                      {projectIds.map((p) => {
                        const sel = targetProjects.includes(p);
                        return (
                          <Button
                            key={p}
                            size="sm"
                            variant={sel ? "flat" : "bordered"}
                            color={sel ? "secondary" : "default"}
                            onPress={() =>
                              setTargetProjects((prev) =>
                                sel
                                  ? prev.filter((x) => x !== p)
                                  : [...prev, p]
                              )
                            }
                            className={cn(
                              "h-7 min-w-0 font-mono text-[11px] justify-start px-2",
                              !sel && "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 data-[hover=true]:border-violet-300"
                            )}
                          >
                            {sel ? "✓ " : ""}
                            {p}
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </CardBody>
              </Card>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button
                  size="sm"
                  color="secondary"
                  variant="shadow"
                  isDisabled={targetProjects.length === 0}
                  onPress={() => setStep("chat")}
                  startContent={<Sparkles className="h-3.5 w-3.5" />}
                  endContent={<ArrowRight className="h-3 w-3" />}
                  className="font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 data-[hover=true]:from-violet-700 data-[hover=true]:to-indigo-700"
                >
                  下一步：AI 对话生成
                </Button>
              </div>
            </div>
          )}

          {/* === STEP 2: Chat === */}
          {step === "chat" && (
            <div className="h-full grid grid-cols-1 lg:grid-cols-2 gap-0 divide-x divide-slate-100 dark:divide-slate-800 min-h-0">
              {/* Left: chat history */}
              <div className="flex flex-col h-full min-h-0">
                <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                  {messages.length === 0 && chatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-2 text-xs flex items-center gap-2">
                        <Spinner size="sm" color="secondary" />
                        <span>AI 提炼中，扫描 {safeEvents.length} 条事件 / {totalCritical} 项 critical...</span>
                      </div>
                    </div>
                  )}
                  {messages.map((m, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "flex",
                        m.role === "user" ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap break-words",
                          m.role === "user"
                            ? "bg-violet-600 text-white"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                        )}
                      >
                        {m.content}
                      </div>
                    </div>
                  ))}
                  {chatLoading && messages.length > 0 && (
                    <div className="flex justify-start">
                      <div className="bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-2 text-xs flex items-center gap-2">
                        <Spinner size="sm" color="secondary" />
                        <span>AI 思考中（提炼规则）...</span>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
                <div className="border-t border-slate-100 dark:border-slate-800 p-3 flex gap-2 shrink-0 bg-white dark:bg-slate-900">
                  <Input
                    type="text"
                    value={input}
                    onValueChange={setInput}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendChat();
                      }
                    }}
                    placeholder="例如: 把示例改用 Python、加 SQL 注入专项、把卡点正则改宽松一点..."
                    size="sm"
                    variant="bordered"
                    isDisabled={chatLoading || !currentRule}
                    classNames={{
                      inputWrapper: "h-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 data-[hover=true]:bg-slate-50 dark:data-[hover=true]:bg-slate-800/50",
                      input: "text-xs",
                    }}
                  />
                  <Button
                    size="sm"
                    color="secondary"
                    isDisabled={chatLoading || !input.trim() || !currentRule}
                    onPress={sendChat}
                    startContent={<Send className="h-3.5 w-3.5" />}
                    className="shrink-0 font-semibold"
                  >
                    发送
                  </Button>
                </div>
              </div>

              {/* Right: current rule preview */}
              <div className="flex flex-col h-full min-h-0 overflow-y-auto">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10 shrink-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      当前规则草稿
                    </h3>
                    {currentRule && (
                      <Chip startContent
                        size="sm"
                        variant="flat"
                        color="secondary"
                        classNames={{ base: "h-5", content: "text-[10px] font-mono px-1.5" }}
                      >
                        跨 {currentRule.source_events ?? 0} 项 critical
                      </Chip>
                    )}
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  {synthError && (
                    <Chip
                      variant="flat"
                      color="danger"
                      classNames={{ base: "h-auto py-2 px-3 w-full", content: "text-xs whitespace-normal text-left justify-start" }}
                      startContent={<AlertOctagon className="h-3.5 w-3.5 shrink-0" />}
                    >
                      初始生成错误：{synthError}
                    </Chip>
                  )}
                  {!currentRule && !chatLoading ? (
                    <div className="py-12 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                      <Spinner size="md" color="secondary" />
                      <span>等待 AI 生成第一版...</span>
                    </div>
                  ) : !currentRule ? null : (
                    <>
                      <Card shadow="none" classNames={{ base: "bg-slate-50/40 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60" }}>
                        <CardBody className="p-3 space-y-2">
                          <div className="flex items-center gap-1.5 flex-wrap mb-1">
                            {currentRule.scope && (
                              <Chip
                                size="sm"
                                variant="flat"
                                color={
                                  currentRule.scope === "security"
                                    ? "danger"
                                    : currentRule.scope === "frontend"
                                    ? "primary"
                                    : currentRule.scope === "backend"
                                    ? "success"
                                    : "default"
                                }
                                classNames={{ base: "h-5", content: "text-[10px] font-medium px-1.5" }}
                              >
                                {currentRule.scope === "security"
                                  ? "🛡️ 高危安全防线"
                                  : currentRule.scope === "frontend"
                                  ? "🎨 前端 TS/React"
                                  : currentRule.scope === "backend"
                                  ? "⚙️ 后端 Python/API"
                                  : "📚 通用工程准则"}
                              </Chip>
                            )}
                            <Chip
                              size="sm"
                              variant="flat"
                              color={currentRule.check_type === "static_regex" ? "warning" : "secondary"}
                              classNames={{ base: "h-5", content: "text-[10px] font-medium px-1.5" }}
                            >
                              {currentRule.check_type === "static_regex"
                                ? "🔬 静态正则探针"
                                : "🧠 AI 规范指导"}
                            </Chip>
                            {currentRule.category && (
                              <Chip
                                size="sm"
                                variant="bordered"
                                classNames={{ base: "h-5", content: "text-[10px] px-1.5" }}
                              >
                                {currentRule.category}
                              </Chip>
                            )}
                          </div>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            {currentRule.title}
                          </h4>
                          {currentRule.file_globs && currentRule.file_globs.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap text-[10px] text-slate-500">
                              <span className="text-slate-400">文件范围:</span>
                              {currentRule.file_globs.map((g) => (
                                <span
                                  key={g}
                                  className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-[10px]"
                                >
                                  {g}
                                </span>
                              ))}
                            </div>
                          )}
                          {currentRule.common_root_cause && (
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 flex items-start gap-1">
                              <span className="shrink-0">🔑</span>
                              <span>{currentRule.common_root_cause}</span>
                            </p>
                          )}
                          {currentRule.summary && (
                            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                              {currentRule.summary}
                            </p>
                          )}
                        </CardBody>
                      </Card>

                      {currentRule.source_files && currentRule.source_files.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {currentRule.source_files.slice(0, 8).map((f) => (
                            <Chip startContent
                              key={f}
                              size="sm"
                              variant="flat"
                              classNames={{ base: "h-5 bg-slate-100 dark:bg-slate-800", content: "text-[10px] font-mono px-1.5 text-slate-600 dark:text-slate-300" }}
                            >
                              {f}
                            </Chip>
                          ))}
                        </div>
                      )}

                      {currentRule.bad_snippet && (
                        <Card shadow="none" classNames={{ base: "bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50" }}>
                          <CardBody className="p-3 space-y-1">
                            <div className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                              <span>❌</span>
                              <span>反例</span>
                            </div>
                            <pre className="text-[11px] overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
                              {currentRule.bad_snippet}
                            </pre>
                          </CardBody>
                        </Card>
                      )}

                      {currentRule.good_snippet && (
                        <Card shadow="none" classNames={{ base: "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50" }}>
                          <CardBody className="p-3 space-y-1">
                            <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <span>✅</span>
                              <span>正例</span>
                            </div>
                            <pre className="text-[11px] overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
                              {currentRule.good_snippet}
                            </pre>
                          </CardBody>
                        </Card>
                      )}

                      {currentRule.gate_rule?.pattern && (
                        <Card shadow="none" classNames={{ base: "bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800" }}>
                          <CardBody className="p-3 space-y-1">
                            <div className="text-[10px] font-semibold text-slate-500 flex items-center gap-1">
                              <span>🔍</span>
                              <span>Pre-Commit 卡点正则</span>
                            </div>
                            <Snippet
                              size="sm"
                              variant="flat"
                              codeString={currentRule.gate_rule.pattern}
                              classNames={{
                                base: "bg-slate-100 dark:bg-slate-800 p-2",
                                pre: "text-[10px] font-mono whitespace-pre-wrap",
                                copyButton: "text-slate-400",
                              }}
                            >
                              {currentRule.gate_rule.pattern}
                            </Snippet>
                            {currentRule.gate_rule?.message && (
                              <div className="text-[11px] text-slate-600 dark:text-slate-400 flex items-start gap-1">
                                <span className="shrink-0">💬</span>
                                <span>{currentRule.gate_rule.message}</span>
                              </div>
                            )}
                          </CardBody>
                        </Card>
                      )}

                      {currentRule.skill_markdown && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-slate-500 dark:text-slate-400 font-medium">
                            📄 IDE Agent Skill Markdown ({currentRule.skill_markdown.length} 字符)
                          </summary>
                          <pre className="mt-2 p-2 rounded bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-[11px] overflow-x-auto whitespace-pre-wrap max-h-48">
                            {currentRule.skill_markdown}
                          </pre>
                        </details>
                      )}
                    </>
                  )}
                </div>
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 sticky bottom-0 bg-white dark:bg-slate-900 z-10 shrink-0">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="light"
                      isDisabled={!currentRule}
                      onPress={() =>
                        handleCopy(
                          currentRule?.skill_markdown ||
                            currentRule?.title ||
                            "",
                          "rule_md"
                        )
                      }
                      startContent={
                        copiedKey === "rule_md" ? (
                          <Check className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )
                      }
                      className="text-[11px] h-7 min-w-0 px-2 text-slate-500 data-[hover=true]:text-slate-700 dark:data-[hover=true]:text-slate-200"
                    >
                      复制 Skill MD
                    </Button>
                    <Button
                      size="sm"
                      color="success"
                      variant="shadow"
                      isDisabled={!currentRule}
                      onPress={() => setStep("dispatch")}
                      startContent={<Rocket className="h-3.5 w-3.5" />}
                      endContent={<ArrowRight className="h-3 w-3" />}
                      className="ml-auto font-semibold"
                    >
                      下一步：下发到全员
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* === STEP 3: Dispatch (apply & push) === */}
          {step === "dispatch" && (
            <div className="h-full overflow-y-auto p-5 space-y-4">
              <Card
                shadow="none"
                classNames={{
                  base: "bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40",
                }}
              >
                <CardBody className="flex flex-row items-start gap-3 p-4">
                  <div className="h-7 w-7 shrink-0 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center">
                    <Rocket className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="text-xs text-emerald-900 dark:text-emerald-200 flex-1">
                    <strong className="font-semibold">即将下发:</strong>
                    <span className="ml-1">
                      “{currentRule?.title}” 到 {targetProjects.length} 个选中项目。开启推送后，本地开发者下次{" "}
                      <code className="px-1 rounded bg-emerald-100 dark:bg-emerald-900/40 font-mono">git commit</code>{" "}
                      会自动收到 Y/n 确认并拉取新规则。
                    </span>
                  </div>
                </CardBody>
              </Card>

              <Card shadow="none" classNames={{ base: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800" }}>
                <CardBody className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-violet-500" />
                      下发目标仓库 ({targetProjects.length})
                    </h4>
                    <Button
                      size="sm"
                      variant="light"
                      onPress={() => setProjectPickerOpen((p) => !p)}
                      endContent={
                        <ChevronDown
                          className={cn(
                            "h-3 w-3 transition-transform",
                            projectPickerOpen && "rotate-180"
                          )}
                        />
                      }
                      className="text-[11px] h-6 min-w-0 px-2 text-violet-600 dark:text-violet-400"
                    >
                      {projectPickerOpen ? "收起" : "调整目标仓库"}
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {targetProjects.map((p) => (
                      <Chip startContent
                        key={p}
                        size="sm"
                        variant="flat"
                        color="success"
                        classNames={{
                          base: "h-6 font-mono",
                          content: "text-[11px] px-2",
                        }}
                      >
                        {p}
                      </Chip>
                    ))}
                  </div>
                  {projectPickerOpen && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40">
                      {projectIds.map((p) => {
                        const sel = targetProjects.includes(p);
                        return (
                          <Button
                            key={p}
                            size="sm"
                            variant={sel ? "flat" : "bordered"}
                            color={sel ? "success" : "default"}
                            onPress={() =>
                              setTargetProjects((prev) =>
                                sel ? prev.filter((x) => x !== p) : [...prev, p]
                              )
                            }
                            className={cn(
                              "h-7 min-w-0 font-mono text-[11px] justify-start px-2",
                              !sel && "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 data-[hover=true]:border-emerald-300"
                            )}
                          >
                            {sel ? "✓ " : ""}
                            {p}
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </CardBody>
              </Card>

              <Card shadow="none" classNames={{ base: "bg-violet-50 dark:bg-violet-950/20 border border-violet-200/60 dark:border-violet-800/40" }}>
                <CardBody className="p-0">
                  <Checkbox
                    isSelected={pushImmediately}
                    onValueChange={setPushImmediately}
                    size="sm"
                    classNames={{
                      base: "flex items-start gap-2 w-full p-3 cursor-pointer",
                      wrapper: "before:border-slate-300 mt-0.5 group-data-[selected=true]:before:bg-emerald-600",
                      label: "text-xs",
                    }}
                  >
                    <span>
                      <strong className="text-slate-900 dark:text-slate-100">立即推送 (push_immediately)</strong>
                      <span className="text-slate-600 dark:text-slate-400"> — 开发者下次 git commit 自动拉取，无需手动同步。</span>
                    </span>
                  </Checkbox>
                </CardBody>
              </Card>

              {dispatchError && (
                <Chip
                  variant="flat"
                  color="danger"
                  classNames={{ base: "h-auto py-2 px-3 w-full", content: "text-xs whitespace-normal text-left justify-start gap-2" }}
                  startContent={<AlertOctagon className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
                >
                  下发失败：{dispatchError}
                </Chip>
              )}

              <Button
                fullWidth
                size="md"
                variant="shadow"
                isDisabled={dispatching || !currentRule || targetProjects.length === 0}
                onPress={dispatchToAll}
                startContent={
                  dispatching ? (
                    <Spinner size="sm" color="white" />
                  ) : (
                    <Rocket className="h-4 w-4" />
                  )
                }
                className="font-bold bg-gradient-to-r from-emerald-600 via-violet-600 to-indigo-600 data-[hover=true]:from-emerald-700 data-[hover=true]:to-indigo-700 data-[disabled=true]:bg-slate-200 dark:data-[disabled=true]:bg-slate-800"
              >
                {dispatching ? "下发中..." : `🚀 下发到 ${targetProjects.length} 个仓库全员`}
              </Button>

              <div className="flex items-center justify-between">
                <Button
                  size="sm"
                  variant="light"
                  onPress={() => setStep("chat")}
                  className="text-[11px] h-6 min-w-0 px-2 text-slate-500 data-[hover=true]:text-slate-700 dark:data-[hover=true]:text-slate-200"
                >
                  ← 返回 AI 对话微调
                </Button>
                <Button
                  size="sm"
                  variant="light"
                  onPress={() => {
                    // Re-run synthesis with the same events (allow gatekeeper to start fresh)
                    setCurrentRule(null);
                    setMessages([]);
                    setStep("chat");
                    setTimeout(() => {
                      autoStartedRef.current = false;
                      synthesizeInitial();
                    }, 100);
                  }}
                  className="text-[11px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-1"
                >
                  <RotateCw className="h-3 w-3" />
                  重新提炼
                </Button>
              </div>
            </div>
          )}

          {/* === STEP 4: Done === */}
          {step === "done" && dispatchResult && (
            <div className="h-full overflow-y-auto p-5 space-y-4">
              <Card
                shadow="none"
                classNames={{
                  base: "bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40",
                }}
              >
                <CardBody className="flex flex-row items-start gap-3 p-4">
                  <div className="h-9 w-9 shrink-0 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="text-xs text-emerald-900 dark:text-emerald-200 flex-1">
                    <strong className="font-bold">✓ Skill 下发完成</strong>
                    <div className="mt-1">
                      规则 “{dispatchResult.rule?.title}” 已保存到 {dispatchResult.applied} 个项目。
                      {dispatchResult.audit_summary?.all_pushed ? (
                        <span>推送模式已开启，所有本地仓库下次 commit 自动拉取。</span>
                      ) : (
                        <span>可手动前往“规则与 Skill 库”页面下发。</span>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>

              {/* Per-project push status */}
              <Card shadow="none" classNames={{ base: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden" }}>
                <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-violet-500" />
                    按仓库下发明细 ({dispatchResult.push_states?.length ?? 0})
                  </h4>
                </div>
                <div className="overflow-x-auto">
                  <Table
                    removeWrapper
                    aria-label="按仓库下发明细"
                    classNames={{
                      base: "min-w-full",
                      th: "bg-slate-50/60 dark:bg-slate-900/40 text-slate-500 text-[11px] font-semibold",
                      td: "text-xs py-2",
                    }}
                  >
                    <TableHeader>
                      <TableColumn className="text-left">仓库</TableColumn>
                      <TableColumn className="text-left">策略版本</TableColumn>
                      <TableColumn className="text-center">推送模式</TableColumn>
                      <TableColumn className="text-center">下发状态</TableColumn>
                      <TableColumn className="text-right">推送时间</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {(dispatchResult.push_states ?? []).map((ps) => (
                        <TableRow key={ps.project_id}>
                          <TableCell>
                            <span className="font-mono text-blue-600 dark:text-cyan-400">
                              {ps.project_id}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-slate-700 dark:text-slate-300">
                              {ps.policy_version ?? "—"}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Chip startContent
                              size="sm"
                              variant="flat"
                              color={ps.push_enabled ? "success" : "default"}
                              classNames={{ base: "h-5", content: "text-[10px] font-mono px-1.5" }}
                            >
                              {ps.push_enabled ? "启用" : "关闭"}
                            </Chip>
                          </TableCell>
                          <TableCell className="text-center">
                            {ps.pending ? (
                              <Chip startContent
                                size="sm"
                                variant="flat"
                                color="warning"
                                classNames={{ base: "h-5", content: "text-[10px] font-bold px-1.5" }}
                              >
                                ⏳ 待推送
                              </Chip>
                            ) : ps.pending_push_version ? (
                              <Chip startContent
                                size="sm"
                                variant="flat"
                                color="secondary"
                                classNames={{ base: "h-5", content: "text-[10px] font-bold px-1.5" }}
                              >
                                已标记 {ps.pending_push_version}
                              </Chip>
                            ) : (
                              <Chip startContent
                                size="sm"
                                variant="flat"
                                classNames={{ base: "h-5 bg-slate-100 dark:bg-slate-800", content: "text-[10px] font-bold text-slate-500 px-1.5" }}
                              >
                                未推送
                              </Chip>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="text-[11px] font-mono text-slate-500">
                              {ps.last_pushed_at
                                ? new Date(ps.last_pushed_at).toLocaleString("zh-CN", {
                                    hour12: false,
                                  })
                                : "—"}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button
                  size="sm"
                  variant="light"
                  onPress={() => {
                    setStep("context");
                    setDispatchResult(null);
                    setCurrentRule(null);
                    setMessages([]);
                  }}
                  className="text-[11px] h-7 min-w-0 px-2 text-violet-600 dark:text-violet-400 data-[hover=true]:underline"
                >
                  再提炼一条
                </Button>
                <Button
                  size="sm"
                  color="default"
                  variant="shadow"
                  onPress={onClose}
                  startContent={<Check className="h-3.5 w-3.5" />}
                  className="font-semibold bg-slate-900 text-white data-[hover=true]:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:data-[hover=true]:bg-slate-200"
                >
                  完成
                </Button>
              </div>
            </div>
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}

export { AuditChatSkillModal as AuditChatSkillDrawer };

