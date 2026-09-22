"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Search,
  Plus,
  Copy,
  Check,
  Download,
  Trash2,
  Code2,
  Cpu,
  Layers,
  Terminal,
  BookOpen,
  RefreshCw,
  FileCode,
  CheckCircle2,
  Eye,
  X,
  AlertTriangle,
  ArrowUpRight,
} from "lucide-react";
import { useFlowStore } from "@/stores/useFlowStore";
import { AgentSkillItem, CustomGateRule } from "@/types/flow";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Checkbox } from "@heroui/react";
import { BatchSkillDrawer } from "./BatchSkillDrawer";

type IdeFormat = "antigravity_skill" | "gemini_md";

interface IdeTabInfo {
  id: IdeFormat;
  label: string;
  iconText: string;
  filename: string;
  desc: string;
}

const IDE_TABS: IdeTabInfo[] = [
  {
    id: "antigravity_skill",
    label: "Google Antigravity 原生技能",
    iconText: "🌟",
    filename: ".agent/skills/flowdev-quality/SKILL.md",
    desc: "Google DeepMind 原生技能格式 (YAML Frontmatter + Skill Guidelines 架构防御规范)",
  },
  {
    id: "gemini_md",
    label: "Google Gemini / AGY 上下文守则",
    iconText: "♊",
    filename: "GEMINI.md & AGENTS.md",
    desc: "Google 智能体上下文规则与 Git Pre-Commit 门禁卡点自动同步守则",
  },
];

// In-Memory SWR Cache for project policy and IDE export previews
const policyMemoryCache = new Map<string, { data: any; timestamp: number }>();
const idePreviewMemoryCache = new Map<string, { text: string; timestamp: number }>();

export function SkillsGovernanceView() {
  const router = useRouter();
  const projects = useFlowStore((s) => s?.projects ?? []);
  const selectedProjectId = useFlowStore((s) => s?.selectedProjectId ?? "all");

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Policy data for target project
  const [agentSkills, setAgentSkills] = useState<AgentSkillItem[]>([]);
  const [customRules, setCustomRules] = useState<CustomGateRule[]>([]);
  const [gateEnabled, setGateEnabled] = useState(true);
  const [failureAction, setFailureAction] = useState<string>("block_commit");

  // IDE Preview Tab State
  const [activeIdeTab, setActiveIdeTab] = useState<IdeFormat>("antigravity_skill");
  const [idePreviewContent, setIdePreviewContent] = useState<string>("");
  const [isIdePreviewLoading, setIsIdePreviewLoading] = useState(false);

  // Modals state
  const [previewSkill, setPreviewSkill] = useState<AgentSkillItem | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [deleteConfirmTitle, setDeleteConfirmTitle] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Batch multi-select & merge drawer state
  const [selectedSkillTitles, setSelectedSkillTitles] = useState<string[]>([]);
  const [isBatchDrawerOpen, setIsBatchDrawerOpen] = useState(false);

  // New Skill form state
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("stability");
  const [newScope, setNewScope] = useState("frontend");
  const [newFileGlobs, setNewFileGlobs] = useState("");
  const [newSummary, setNewSummary] = useState("");
  const [newMarkdown, setNewMarkdown] = useState("");
  const [newRegexPattern, setNewRegexPattern] = useState("");
  const [newGateLevel, setNewGateLevel] = useState<"critical" | "warning">("critical");
  const [isSavingNewSkill, setIsSavingNewSkill] = useState(false);

  // Determine actual target project ID
  const targetProjectId = useMemo(() => {
    if (!selectedProjectId || selectedProjectId === "all") {
      // Never fabricate a project id; empty means "no repo registered yet".
      return projects?.[0]?.id ?? "";
    }
    return selectedProjectId;
  }, [selectedProjectId, projects]);

  // Fetch Policy & Skills with In-Memory Caching
  const fetchPolicy = async (projId: string, force: boolean = false) => {
    const cached = policyMemoryCache.get(projId);
    const now = Date.now();
    if (!force && cached && now - cached.timestamp < 30000) {
      setAgentSkills(cached.data?.agent_skills ?? []);
      setCustomRules(cached.data?.custom_rules ?? []);
      setGateEnabled(cached.data?.gate_enabled ?? true);
      setFailureAction(cached.data?.failure_action ?? "block_commit");
      return;
    }

    setIsLoading(!cached);
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/projects/${encodeURIComponent(projId)}/policy`);
      if (res?.ok) {
        const data = await res.json();
        policyMemoryCache.set(projId, { data, timestamp: Date.now() });
        setAgentSkills(data?.agent_skills ?? []);
        setCustomRules(data?.custom_rules ?? []);
        setGateEnabled(data?.gate_enabled ?? true);
        setFailureAction(data?.failure_action ?? "block_commit");
      }
    } catch (err) {
      console.error("Failed to load policy for project:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch IDE Preview Text with In-Memory Caching
  const fetchIdePreview = async (projId: string, format: IdeFormat, force: boolean = false) => {
    const cacheKey = `${projId}_${format}`;
    const cached = idePreviewMemoryCache.get(cacheKey);
    const now = Date.now();
    if (!force && cached && now - cached.timestamp < 30000) {
      setIdePreviewContent(cached.text ?? "");
      return;
    }

    setIsIdePreviewLoading(!cached);
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/api/projects/${encodeURIComponent(projId)}/skills/export?format=${format}`
      );
      if (res?.ok) {
        const text = await res.text();
        idePreviewMemoryCache.set(cacheKey, { text: text ?? "", timestamp: Date.now() });
        setIdePreviewContent(text ?? "");
      }
    } catch (e) {
      console.error("Failed to load IDE export content", e);
    } finally {
      setIsIdePreviewLoading(false);
    }
  };

  useEffect(() => {
    if (targetProjectId) {
      fetchPolicy(targetProjectId);
      fetchIdePreview(targetProjectId, activeIdeTab);
    }
  }, [targetProjectId]);

  const handleSwitchIdeTab = (tab: IdeFormat) => {
    setActiveIdeTab(tab);
    if (targetProjectId) {
      fetchIdePreview(targetProjectId, tab);
    }
  };

  const handleCopy = (text: string, key: string) => {
    if (typeof navigator !== "undefined" && navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  const handleDownloadFile = (content: string, filename: string) => {
    if (typeof window === "undefined") return;
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteSkill = async (title: string) => {
    setIsDeleting(true);
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/projects/${encodeURIComponent(targetProjectId)}/rules`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (res?.ok) {
        const data = await res.json();
        policyMemoryCache.delete(targetProjectId);
        idePreviewMemoryCache.clear();
        setCustomRules(data?.custom_rules ?? []);
        setAgentSkills(data?.agent_skills ?? []);
        setDeleteConfirmTitle(null);
        fetchIdePreview(targetProjectId, activeIdeTab, true);
      }
    } catch (err) {
      console.error("Failed to delete skill:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveNewSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setIsSavingNewSkill(true);
    try {
      const payload: any = {
        agent_skill: {
          title: newTitle.trim(),
          category: newCategory,
          scope: newScope,
          file_globs: newFileGlobs
            ? newFileGlobs
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            : undefined,
          check_type: newRegexPattern.trim() ? "static_regex" : "ai_guideline",
          summary: newSummary.trim() || newTitle.trim(),
          markdown: newMarkdown.trim() || `# Skill: ${newTitle}\n\n${newSummary}`,
        },
      };

      if (newRegexPattern.trim()) {
        payload.custom_rule = {
          title: newTitle.trim(),
          pattern: newRegexPattern.trim(),
          message: `🚫 [FlowDev-Gate] 拦截到违规代码：${newSummary || newTitle}`,
          level: newGateLevel,
        };
      }

      const res = await fetch(`http://127.0.0.1:8000/api/projects/${encodeURIComponent(targetProjectId)}/rules/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res?.ok) {
        policyMemoryCache.delete(targetProjectId);
        idePreviewMemoryCache.clear();
        setIsCreateModalOpen(false);
        setNewTitle("");
        setNewCategory("stability");
        setNewScope("frontend");
        setNewFileGlobs("");
        setNewSummary("");
        setNewMarkdown("");
        setNewRegexPattern("");
        await fetchPolicy(targetProjectId, true);
        await fetchIdePreview(targetProjectId, activeIdeTab, true);
      }
    } catch (err) {
      console.error("Failed to apply new skill:", err);
    } finally {
      setIsSavingNewSkill(false);
    }
  };

  const SCOPE_META: Record<string, { label: string; icon: string; color: string }> = {
    security: {
      label: "高危安全防线",
      icon: "🛡️",
      color: "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800",
    },
    frontend: {
      label: "前端 TS/React",
      icon: "🎨",
      color: "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800",
    },
    backend: {
      label: "后端 Python/API",
      icon: "⚙️",
      color: "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800",
    },
    general: {
      label: "通用工程准则",
      icon: "📚",
      color: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700",
    },
  };

  const categories = useMemo(() => {
    const list = ["all"];
    (agentSkills ?? []).forEach((s) => {
      const cat = s?.category ?? "general";
      if (cat && !list.includes(cat)) {
        list.push(cat);
      }
    });
    return list;
  }, [agentSkills]);

  const filteredSkills = useMemo(() => {
    return (agentSkills ?? []).filter((s) => {
      if (!s) return false;
      const cat = s?.category ?? "general";
      if (selectedCategory !== "all" && cat !== selectedCategory) {
        return false;
      }
      const q = (searchQuery ?? "").trim().toLowerCase();
      if (q) {
        const matchTitle = (s?.title ?? "").toLowerCase().includes(q);
        const matchSummary = (s?.summary ?? "").toLowerCase().includes(q);
        const matchMarkdown = (s?.markdown ?? "").toLowerCase().includes(q);
        return matchTitle || matchSummary || matchMarkdown;
      }
      return true;
    });
  }, [agentSkills, selectedCategory, searchQuery]);

  const categoryLabels: Record<string, { label: string; color: string }> = {
    all: { label: "全部规范", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
    stability: { label: "空指针与稳定性", color: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300" },
    security: { label: "安全防注入与 RCE", color: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300" },
    performance: { label: "性能与渲染优化", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300" },
    architecture: { label: "架构与模块分层", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300" },
    general: { label: "通用工程准则", color: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300" },
  };

  // Batch selection derived state
  const selectedSkills = useMemo(() => {
    const set = new Set(selectedSkillTitles ?? []);
    return (agentSkills ?? []).filter((s) => s && set.has(s?.title ?? ""));
  }, [agentSkills, selectedSkillTitles]);

  const allFilteredSelected = useMemo(
    () => filteredSkills.length > 0 && filteredSkills.every((s) => selectedSkillTitles.includes(s?.title ?? "")),
    [filteredSkills, selectedSkillTitles]
  );

  const toggleSkillSelect = (title: string) => {
    setSelectedSkillTitles((prev) =>
      (prev ?? []).includes(title) ? (prev ?? []).filter((t) => t !== title) : [...(prev ?? []), title]
    );
  };

  const handleSelectAllFiltered = () => {
    setSelectedSkillTitles((prev) =>
      Array.from(new Set([...(prev ?? []), ...filteredSkills.map((s) => s?.title ?? "").filter(Boolean)]))
    );
  };

  const handleClearSelection = () => setSelectedSkillTitles([]);

  const handleBatchApplied = () => {
    if (!targetProjectId) return;
    fetchPolicy(targetProjectId);
    fetchIdePreview(targetProjectId, activeIdeTab);
  };

  return (
    <div className="flex-1 w-full h-full overflow-y-auto bg-slate-50 dark:bg-[#0b0f19] p-4 md:p-6 space-y-6 transition-colors duration-200">
      {/* 1. Header Banner & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/90 bg-gradient-to-r from-amber-50/80 via-indigo-50/30 to-white dark:from-slate-900/90 dark:via-slate-900/60 dark:to-slate-950 shadow-sm dark:shadow-xl backdrop-blur">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-amber-500 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0 text-white">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                AI 智能体 Skill 规范与工程资产中心
              </h1>
              <span className="rounded-full bg-gradient-to-r from-amber-500/10 to-indigo-500/10 border border-amber-500/25 px-2.5 py-0.5 text-xs font-mono font-semibold text-amber-700 dark:text-amber-300">
                Multi-Agent Governance
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
              <span>当前治理目标：</span>
              <span className="font-mono font-semibold text-blue-600 dark:text-cyan-400 bg-blue-50 dark:bg-blue-950/50 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                {targetProjectId || "未选择项目"}
              </span>
              <span>· 沉淀团队最佳实践，原生适配 Google Antigravity & Gemini 智能体规范与 Git 门禁</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsSyncModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors shadow-xs cursor-pointer"
            title="查看并同步至本地 Git 仓库"
          >
            <Terminal className="h-3.5 w-3.5 text-cyan-500" />
            <span>一键同步配置</span>
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 via-indigo-600 to-blue-600 hover:from-amber-600 hover:to-indigo-700 text-white text-xs font-semibold shadow-sm hover:shadow transition-all cursor-pointer"
            title="手动录入一条新的团队规范与 Skill"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>新建 Skill 资产</span>
          </button>

          <button
            onClick={() => setIsBatchDrawerOpen(true)}
            disabled={(selectedSkillTitles ?? []).length === 0}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
              (selectedSkillTitles ?? []).length > 0
                ? "bg-gradient-to-r from-indigo-500 via-purple-600 to-fuchsia-600 hover:from-indigo-600 hover:to-fuchsia-700 text-white shadow-sm hover:shadow cursor-pointer"
                : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed"
            )}
            title={
              (selectedSkillTitles ?? []).length > 0
                ? `将已勾选的 ${(selectedSkillTitles ?? []).length} 条资产合并生成一个 Skill`
                : "请先在下方卡片勾选需要合并的 Skill 资产"
            }
          >
            <Layers className="h-3.5 w-3.5" />
            <span>批量生成 Skill</span>
            {(selectedSkillTitles ?? []).length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-[10px] font-mono">
                {(selectedSkillTitles ?? []).length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 2. 4 Core Governance KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Skills */}
        <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/50 shadow-sm hover:border-amber-400/50 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>已沉淀 Agent Skills</span>
            <BookOpen className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1.5 font-mono flex items-baseline gap-2">
            <span>{agentSkills?.length ?? 0}</span>
            <span className="text-xs font-normal text-slate-500 font-sans">项团队工程标准</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <span className="text-amber-600 dark:text-amber-400 font-medium">持续进化</span>
            <span>· 拦截反模式自动沉淀</span>
          </div>
        </div>

        {/* Associated Gatekeeper Regex Rules */}
        <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/50 shadow-sm hover:border-blue-400/50 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Pre-Commit 门禁探针</span>
            <ShieldCheck className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1.5 font-mono flex items-baseline gap-2">
            <span>{customRules?.length ?? 0}</span>
            <span className="text-xs font-normal text-slate-500 font-sans">条硬性正则卡点</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">双层防线</span>
            <span>· IDE AI + Git 物理阻断</span>
          </div>
        </div>

        {/* Supported Google Ecosystems */}
        <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/50 shadow-sm hover:border-indigo-400/50 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>智能体规范生态</span>
            <Cpu className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1.5 font-mono flex items-baseline gap-2">
            <span>Google</span>
            <span className="text-xs font-normal text-slate-500 font-sans">Antigravity / Gemini</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 truncate">
            <span>.agent/skills & GEMINI.md 原生直驱</span>
          </div>
        </div>

        {/* Gate Enforcement Status */}
        <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/50 shadow-sm hover:border-cyan-400/50 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>门禁卡点管控模式</span>
            <ShieldAlert className="h-4 w-4 text-rose-500" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-2 font-mono flex items-center gap-2">
            {failureAction === "warn_only" ? (
              <span className="text-amber-500 text-sm font-semibold flex items-center gap-1">
                ⚠️ 仅提示不阻断
              </span>
            ) : failureAction === "disabled" || !gateEnabled ? (
              <span className="text-slate-400 text-sm font-semibold flex items-center gap-1">
                ⚪ 门禁已关闭
              </span>
            ) : (
              <span className="text-rose-600 dark:text-rose-400 text-sm font-semibold flex items-center gap-1">
                🛑 严格物理阻断
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>可在质量大盘一键切换</span>
            <Link
              href={targetProjectId ? `/dashboard?project=${encodeURIComponent(targetProjectId)}` : "/dashboard"}
              className="text-blue-500 hover:underline inline-flex items-center gap-0.5"
            >
              <span>查看详情</span>
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* 3. Skill Cards Management Section */}
      <div className="bg-white dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {/* Toolbar: Search + Category Filter */}
        <div className="p-4 border-b border-slate-200/80 dark:border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/40">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {categories.map((catKey) => {
              const meta = categoryLabels?.[catKey] ?? {
                label: catKey,
                color: "bg-slate-100 text-slate-700",
              };
              const isSelected = selectedCategory === catKey;
              return (
                <button
                  key={catKey}
                  onClick={() => setSelectedCategory(catKey)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer",
                    isSelected
                      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs font-semibold"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  )}
                >
                  {meta.label}
                  {catKey === "all" ? ` (${agentSkills?.length ?? 0})` : ""}
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px] shrink-0">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索规范、关键字或拦截提示..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Batch Selection Toolbar */}
        <div className="px-4 py-2.5 border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-indigo-50/30 dark:bg-indigo-950/20">
          <div className="flex items-center gap-2 flex-wrap">
            <Checkbox
              size="sm"
              isSelected={allFilteredSelected}
              onValueChange={(checked) => (checked ? handleSelectAllFiltered() : handleClearSelection())}
              isDisabled={filteredSkills.length === 0}
              classNames={{ label: "text-[11px] text-slate-700 dark:text-slate-300" }}
            >
              全选当前 {filteredSkills.length} 项
            </Checkbox>
            {(selectedSkillTitles ?? []).length > 0 && (
              <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                已选 {(selectedSkillTitles ?? []).length} 项
              </span>
            )}
          </div>

          {(selectedSkillTitles ?? []).length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsBatchDrawerOpen(true)}
                className="flex items-center gap-1 px-3 py-1 rounded-lg bg-gradient-to-r from-indigo-500 via-purple-600 to-fuchsia-600 text-white text-[11px] font-semibold shadow-xs hover:shadow transition-all cursor-pointer"
              >
                <Layers className="h-3 w-3" />
                <span>批量生成 Skill</span>
              </button>
              <button
                onClick={handleClearSelection}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="h-3 w-3" />
                <span>清空</span>
              </button>
            </div>
          )}
        </div>

        {/* Skill Cards Grid */}
        <div className="p-4">
          {isLoading ? (
            <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="h-5 w-5 animate-spin text-amber-500" />
              <span>正在获取智能体 Skill 资产库...</span>
            </div>
          ) : filteredSkills.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
              <BookOpen className="h-8 w-8 text-slate-300 dark:text-slate-700" />
              <div className="font-medium text-slate-600 dark:text-slate-300">未检索到匹配的 Skill 规范</div>
              <div className="text-[11px] text-slate-400">
                可点击右上角“新建 Skill 资产”，或在质量大盘对门禁拦截事件点击“💡 沉淀为规则与 Skill”
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
              {filteredSkills.map((skill, index) => {
                if (!skill) return null;
                const catMeta = categoryLabels?.[skill?.category ?? "general"] ?? categoryLabels.general;
                const scopeMeta = SCOPE_META[skill?.scope ?? "general"] ?? SCOPE_META.general;
                const matchedRule = (customRules ?? []).find(
                  (r) => r?.title?.toLowerCase() === skill?.title?.toLowerCase()
                );

                return (
                  <div
                    key={index}
                    className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 hover:border-amber-400/60 dark:hover:border-slate-700 transition-all flex flex-col justify-between group shadow-xs hover:shadow-md"
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Checkbox
                            size="sm"
                            isSelected={(selectedSkillTitles ?? []).includes(skill?.title ?? "")}
                            onValueChange={() => toggleSkillSelect(skill?.title ?? "")}
                            aria-label={`勾选 ${skill?.title ?? ""} 用于批量生成`}
                          />
                          <span className={cn("px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1", scopeMeta.color)}>
                            <span>{scopeMeta.icon}</span>
                            <span>{scopeMeta.label}</span>
                          </span>
                          <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", catMeta.color)}>
                            {catMeta.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          {matchedRule ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-semibold flex items-center gap-1">
                              <ShieldAlert className="h-3 w-3" />
                              <span>Pre-Commit 卡点 ({matchedRule.level === "critical" ? "阻断" : "警告"})</span>
                            </span>
                          ) : skill?.check_type === "static_regex" ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 font-medium">
                              🔬 静态正则探针
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20 font-medium">
                              🧠 AI 规范指导
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Title & Summary */}
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight line-clamp-1">
                        {skill.title}
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed line-clamp-2">
                        {skill.summary || "暂无描述"}
                      </p>

                      {/* Applied file globs */}
                      {skill?.file_globs && skill.file_globs.length > 0 && (
                        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] text-slate-400">文件范围:</span>
                          {skill.file_globs.map((g) => (
                            <span
                              key={g}
                              className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-mono border border-slate-200 dark:border-slate-700"
                            >
                              {g}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Associated Regex Pattern snippet */}
                      {matchedRule?.pattern && (
                        <div className="mt-3 p-2 rounded-lg bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-600 dark:text-slate-300">
                          <div className="text-[10px] text-slate-400 font-sans flex items-center gap-1 mb-1">
                            <Code2 className="h-3 w-3 text-cyan-500" />
                            <span>门禁物理拦截正则 (Pre-commit Regex)</span>
                          </div>
                          <div className="truncate text-rose-600 dark:text-rose-400 font-semibold">
                            {matchedRule.pattern}
                          </div>
                        </div>
                      )}

                      {/* Google Antigravity Supported platforms badge */}
                      <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-slate-400">规范生态:</span>
                        <span className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-medium flex items-center gap-1">
                          <span>🌟</span>
                          <span>Google Antigravity (.agent/skills)</span>
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-mono">
                          GEMINI.md
                        </span>
                      </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-2">
                      <button
                        onClick={() => setPreviewSkill(skill)}
                        className="flex items-center gap-1 text-xs text-blue-600 dark:text-cyan-400 hover:text-blue-700 font-medium cursor-pointer"
                        title="查看 Markdown 详细内容"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>查看 Markdown 详情</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleCopy(skill?.markdown || `# ${skill.title}\n${skill.summary}`, skill.title)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="复制 Skill 规范内容"
                        >
                          {copiedKey === skill.title ? (
                            <Check className="h-3.5 w-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>

                        <button
                          onClick={() =>
                            handleDownloadFile(
                              skill?.markdown || `# ${skill.title}\n${skill.summary}`,
                              `${skill.title.toLowerCase().replace(/[^a-z0-9_-]/g, "_")}.md`
                            )
                          }
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="下载为此规范的 Markdown 文件"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>

                        <button
                          onClick={() => setDeleteConfirmTitle(skill.title)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                          title="从当前仓库移除此项 Skill 资产"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 5. Modal: Markdown Detail Preview */}
      {previewSkill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-amber-500" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate max-w-md">
                  {previewSkill.title}
                </h3>
              </div>
              <button
                onClick={() => setPreviewSkill(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {/* Badges: Scope, Check Type, File Globs */}
              <div className="flex items-center gap-2 flex-wrap">
                {(() => {
                  const sMeta = SCOPE_META[previewSkill?.scope ?? "general"] ?? SCOPE_META.general;
                  return (
                    <span className={cn("px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1", sMeta.color)}>
                      <span>{sMeta.icon}</span>
                      <span>{sMeta.label}</span>
                    </span>
                  );
                })()}
                {previewSkill?.check_type === "static_regex" ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-medium">
                    🔬 静态正则卡点
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20 font-medium">
                    🧠 AI 规范指导 (无物理阻断)
                  </span>
                )}
                {previewSkill?.file_globs && previewSkill.file_globs.length > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400">文件范围:</span>
                    {previewSkill.file_globs.map((g) => (
                      <span key={g} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-mono">
                        {g}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300">
                <div className="font-semibold mb-0.5">规范摘要 (Summary)</div>
                <div>{previewSkill.summary}</div>
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                  <FileCode className="h-3.5 w-3.5 text-cyan-500" />
                  <span>智能体 Prompt 指引与规范 Markdown 内容</span>
                </div>
                <pre className="p-4 rounded-xl bg-slate-950 text-slate-200 font-mono text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap">
                  {previewSkill.markdown || `# ${previewSkill.title}\n\n${previewSkill.summary}`}
                </pre>
              </div>
            </div>

            <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-end gap-2">
              <button
                onClick={() =>
                  handleCopy(
                    previewSkill?.markdown || `# ${previewSkill.title}\n\n${previewSkill.summary}`,
                    "preview_copy"
                  )
                }
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                {copiedKey === "preview_copy" ? "已复制" : "复制 Markdown"}
              </button>
              <button
                onClick={() => setPreviewSkill(null)}
                className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium cursor-pointer"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Modal: Create New Skill Asset */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-blue-500" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  录入沉淀新 Skill 规范资产
                </h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNewSkill} className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  规范标题 (Title) *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="例：React/TS 组件空值安全访问与可选链防御规范"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    技术作用域 (Scope)
                  </label>
                  <select
                    value={newScope}
                    onChange={(e) => setNewScope(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  >
                    <option value="frontend">🎨 前端 TS/React (frontend)</option>
                    <option value="backend">⚙️ 后端 Python/API (backend)</option>
                    <option value="security">🛡️ 高危安全防线 (security)</option>
                    <option value="general">📚 通用工程准则 (general)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    规范分类 (Category)
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  >
                    <option value="stability">空指针与稳定性 (stability)</option>
                    <option value="security">安全注入与 RCE (security)</option>
                    <option value="performance">性能与渲染优化 (performance)</option>
                    <option value="architecture">架构与模块分层 (architecture)</option>
                    <option value="general">通用工程准则 (general)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    作用文件匹配 (File Globs，逗号分隔)
                  </label>
                  <input
                    type="text"
                    value={newFileGlobs}
                    onChange={(e) => setNewFileGlobs(e.target.value)}
                    placeholder="例：*.tsx, *.ts, src/**"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    卡点管控级别 (Level)
                  </label>
                  <select
                    value={newGateLevel}
                    onChange={(e) => setNewGateLevel(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  >
                    <option value="warning">⚠️ 仅提示警告 (放行提交 - 推荐)</option>
                    <option value="critical">🛑 严格卡点 (阻断提交)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  核心原则与总结 (Summary)
                </label>
                <textarea
                  rows={2}
                  value={newSummary}
                  onChange={(e) => setNewSummary(e.target.value)}
                  placeholder="简要说明此规范的设计原则，如：禁止直接对可能为 null/undefined 的对象做深层解构..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  智能体规范指引 Markdown (Prompt Instructions)
                </label>
                <textarea
                  rows={4}
                  value={newMarkdown}
                  onChange={(e) => setNewMarkdown(e.target.value)}
                  placeholder="# Skill 详细指引&#10;1. 永远使用可选链 ?.&#10;2. 使用 ?? 提供默认值..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                <label className="block font-medium text-slate-700 dark:text-slate-300">
                  可选：绑定 Git Pre-Commit 正则拦截卡点
                </label>
                <input
                  type="text"
                  value={newRegexPattern}
                  onChange={(e) => setNewRegexPattern(e.target.value)}
                  placeholder="例：\b(null|undefined)\.[a-zA-Z0-9_]+"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono text-[11px]"
                />
                <p className="text-[10px] text-slate-400">
                  若填写正则，提交代码触发该模式时将自动依据“卡点管控级别”在 Git 客户端阻断或警告。
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSavingNewSkill}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  {isSavingNewSkill ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>正在录入...</span>
                    </>
                  ) : (
                    <span>保存并生效</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Modal: One-Click Local Repo Sync Guide */}
      {isSyncModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-cyan-500" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  一键同步至本地代码仓库
                </h3>
              </div>
              <button
                onClick={() => setIsSyncModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                在您本地的代码仓库根目录下执行以下命令，即可从 FlowDev-AI 自动化拉取并覆盖全部 IDE 规范配置与 Git 门禁探针：
              </p>

              <div className="p-3 rounded-xl bg-slate-950 text-cyan-400 font-mono relative group">
                <code>node .git/hooks/pre-commit --sync-skills</code>
                <button
                  onClick={() => handleCopy("node .git/hooks/pre-commit --sync-skills", "cmd_sync")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                >
                  {copiedKey === "cmd_sync" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>

              <div className="space-y-1.5 text-slate-500 dark:text-slate-400 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <span>自动生成 <code>.agent/skills/flowdev-quality/SKILL.md</code> (Google Antigravity 原生技能规范)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <span>自动生成 <code>GEMINI.md</code> & <code>AGENTS.md</code> (Google 智能体上下文守则)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <span>自动注入 Git Pre-Commit 正则检测阻断器</span>
                </div>
              </div>
            </div>

            <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-end">
              <button
                onClick={() => setIsSyncModalOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold cursor-pointer"
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Modal: Delete Confirmation */}
      {deleteConfirmTitle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-5 space-y-3">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                确认移除此项 Skill 资产？
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              将从项目 <code className="font-mono text-blue-600 dark:text-cyan-400">{targetProjectId}</code> 中删除规范：
              <br />
              <strong className="text-slate-800 dark:text-slate-200 mt-1 block">
                {deleteConfirmTitle}
              </strong>
            </p>
            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirmTitle(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                取消
              </button>
              <button
                disabled={isDeleting}
                onClick={() => handleDeleteSkill(deleteConfirmTitle)}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                {isDeleting ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                <span>确认删除</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. HeroUI Drawer: Batch Multi-Select → Merge Skill Generation */}
      <BatchSkillDrawer
        isOpen={isBatchDrawerOpen}
        onOpenChange={setIsBatchDrawerOpen}
        selectedSkills={selectedSkills}
        customRules={customRules}
        targetProjectId={targetProjectId}
        onApplied={handleBatchApplied}
      />
    </div>
  );
}
