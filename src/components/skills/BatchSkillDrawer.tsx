"use client";

/**
 * BatchSkillDrawer
 * ---------------------------------------------------------------------------
 * HeroUI Drawer (placement="right") 实现"选中多条 Skill 资产 → 合并生成一个 Skill"。
 *
 * 流程：
 *   1. 用户在 Skill 资产中心勾选多条 AgentSkillItem 卡片；
 *   2. 打开本抽屉，自动合并生成单个 SKILL.md（含 YAML Frontmatter）；
 *   3. 支持在抽屉内编辑标题 / 分类 / 摘要 / Markdown；
 *   4. 可复制、可下载；
 *   5. 可一键 Apply 落库（复用 POST /api/projects/{id}/rules/apply），成功后回调 onApplied
 *      触发父页面刷新 policy 与 IDE 预览。
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  Drawer,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
  Button,
  Chip,
  Divider,
  Spinner,
} from "@heroui/react";
import {
  Sparkles,
  Copy,
  Download,
  RefreshCw,
  Layers,
  FileCode,
  Rocket,
  CheckCircle2,
  AlertTriangle,
  Check,
  X,
} from "lucide-react";
import { AgentSkillItem, CustomGateRule } from "@/types/flow";
import { cn } from "@/lib/utils";

interface BatchSkillDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** 被勾选的 Skill 资产（由父页面传入） */
  selectedSkills: AgentSkillItem[];
  /** 当前项目的门禁正则规则（仅用于展示关联卡点，不参与合并） */
  customRules?: CustomGateRule[];
  /** 落库目标项目 ID */
  targetProjectId: string;
  /** Apply 成功后的刷新回调（fetchPolicy + fetchIdePreview） */
  onApplied?: () => void;
}

const CATEGORY_OPTIONS = [
  { value: "stability", label: "空指针与稳定性 (stability)" },
  { value: "security", label: "安全注入与 RCE (security)" },
  { value: "performance", label: "性能与渲染优化 (performance)" },
  { value: "architecture", label: "架构与模块分层 (architecture)" },
  { value: "general", label: "通用工程准则 (general)" },
];

const CATEGORY_COLORS: Record<string, string> = {
  stability: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  security: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
  performance: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  architecture: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300",
  general: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
};

// 分类 → 关注点短语（用于生成"更像 Skill"的 description / title / Context）
const CATEGORY_CONCERN: Record<string, string> = {
  stability: "运行时稳定性与空指针防御",
  security: "安全注入与 RCE 防护",
  performance: "性能与渲染优化",
  architecture: "架构与模块边界",
  general: "通用工程准则",
};

// 分类 → 英文令牌（用于生成干净的 Frontmatter name）
const CATEGORY_TOKEN: Record<string, string> = {
  stability: "stability",
  security: "security",
  performance: "performance",
  architecture: "architecture",
  general: "general",
};

/**
 * 内置生成模板（Prompt）。
 * 用户可在抽屉中查看并修改；通过 {{placeholder}} 占位符注入动态数据。
 * 支持的占位符：
 *   {{name}}                Frontmatter name（英文 kebab）
 *   {{description}}         Frontmatter description（一句话说明何时用）
 *   {{title}}               合并技能标题
 *   {{count}}               选中资产数量
 *   {{gate_note}}           已绑定门禁正则的说明片段（无可绑定为空）
 *   {{concern_text}}        分类关注点汇总（如 "运行时稳定性与空指针防御、安全注入与 RCE 防护"）
 *   {{titles}}              选中资产标题列表（顿号连接）
 *   {{gate_requirements}}   门禁正则卡点章节（无绑定时为空；含 `## 🛡️ ...` 与配套二级标题）
 *   {{synthesized_rules}}   逐条规范章节（含 `## 📚 ...` 标题与每条 Rule N）
 */
const DEFAULT_MERGE_PROMPT = `---
name: "{{name}}"
description: "{{description}}"
---

# {{title}}

本技能聚合了 **{{count}}** 条团队已沉淀的工程规范资产{{gate_note}}，覆盖 {{concern_text}}：{{titles}}。

{{gate_requirements}}## 📚 Synthesized Engineering Best Practices

{{synthesized_rules}}`;

function slugify(title: string): string {
  const slug = (title ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
  return slug || "merged-skill";
}

function skillFallbackMarkdown(skill: AgentSkillItem): string {
  const markdown = skill?.markdown?.trim();
  if (markdown) return markdown;
  return `# Skill: ${skill?.title ?? "Untitled"}\n\n${skill?.summary ?? "暂无描述"}`;
}

/**
 * 合并生成逻辑（纯函数）。
 * 忠实参照本项目真实合成技能 .agent/skills/flowdev-quality/SKILL.md 的形态：
 * - 单条：直接沿用原 markdown，不改变内容；
 * - 多条：以用户可编辑的模板（promptTemplate，缺省为 DEFAULT_MERGE_PROMPT）渲染——
 *   Frontmatter + 简介 + 可选 "🛡️ Critical Quality Gate Requirements"（命中选中资产的
 *   既有门禁正则）+ "📚 Synthesized Engineering Best Practices"（Rule N + Principle + 原文完整内嵌）。
 */
function buildMergedMarkdown(
  selectedSkills: AgentSkillItem[],
  customRules?: CustomGateRule[],
  promptTemplate?: string,
  override?: { title?: string; summary?: string }
): { title: string; category: string; summary: string; markdown: string } {
  const skills = (selectedSkills ?? []).filter(Boolean) as AgentSkillItem[];
  const first = skills[0];

  if (skills.length <= 1) {
    const title = first?.title ?? "未命名 Skill";
    return {
      title,
      category: first?.category ?? "general",
      summary: first?.summary ?? title,
      markdown: skillFallbackMarkdown(first ?? ({} as AgentSkillItem)),
    };
  }

  const titles = skills.map((s) => s?.title ?? "未命名");

  // 标题主题：由选中资产的分类关注点推导，而非机械拼接标题
  const catSet = Array.from(new Set(skills.map((s) => s?.category ?? "general")));
  const concerns = catSet
    .map((c) => CATEGORY_CONCERN?.[c] ?? c)
    .filter(Boolean) as string[];
  const concernText = concerns.length > 0 ? concerns.join("、") : "工程规范";
  const firstConcern = (concerns[0] ?? "工程").replace(/防御$/, "");
  const title =
    override?.title?.trim() ||
    (concerns.length <= 1
      ? `${firstConcern}防御规范`
      : `${firstConcern}等${concerns.length}类工程防御规范`);

  const summary =
    override?.summary?.trim() ||
    `编写或重构代码时落实 ${concernText}（聚合 ${skills.length} 条团队工程规范资产）：` +
      `${titles.join("、")}。`;

  // Frontmatter description：对齐 hub/仓库写法——一句话说明"何时用"
  const description =
    `Defensive coding guidelines for ${concernText}. ` +
    `Apply these rules when writing or refactoring code in this repository, aggregated from ` +
    `${skills.length} team-approved engineering standards.`;

  // Frontmatter name：由分类英文令牌生成干净的 kebab-case 标识
  const nameTokens = catSet.map((c) => CATEGORY_TOKEN?.[c] ?? slugify(c));
  const name = `${nameTokens.join("-")}-defensive-coding`;

  // 🛡️ 门禁正则卡点：仅收录与选中资产标题匹配的既有规则
  const skillTitleSet = new Set(skills.map((s) => s?.title?.toLowerCase()));
  const boundRules = (customRules ?? []).filter(
    (r) => r?.title && skillTitleSet.has(r.title.toLowerCase())
  );

  const gateNote =
    boundRules.length > 0
      ? `（其中 ${boundRules.length} 条已作为 Pre-Commit 门禁正则生效）`
      : "";

  const gateSections: string[] = [];
  if (boundRules.length > 0) {
    gateSections.push(
      "## 🛡️ Critical Quality Gate Requirements",
      "",
      "When generating or refactoring code in this repository, you MUST adhere to the following rules:",
      "",
      "### Active Pre-Commit Gatekeeper Regex Checks"
    );
    boundRules.forEach((r) => {
      gateSections.push(
        `- **${r.title}**: \`${r.pattern}\` (Level: ${r.level})`,
        `  *Enforcement:* ${r.message ?? "请按门禁提示修正后再提交。"}`
      );
    });
    // 空行收尾，保证与后续章节自然分隔
    gateSections.push("", "");
  }
  const gateRequirements = gateSections.join("\n").replace(/^[ \t]+$/gm, "");

  // 📚 逐条规则的合成章节（镜像 flowdev-quality 的 Rule N 结构）
  const rulesLines: string[] = [];
  skills.forEach((s, idx) => {
    rulesLines.push(
      `### Rule ${idx + 1}: ${s?.title ?? "未命名规范"}`,
      "",
      `**Principle:** ${(s?.summary?.trim() || s?.title) ?? "未命名规范"}`,
      "",
      skillFallbackMarkdown(s),
      ""
    );
  });
  const synthesizedRules = rulesLines.join("\n").replace(/^[ \t]+$/gm, "");

  // 模板渲染：替换 {{placeholder}}；未识别占位符原样保留，供用户自行观察调整
  const template = promptTemplate?.trim() ? promptTemplate : DEFAULT_MERGE_PROMPT;
  const vars: Record<string, string> = {
    name,
    description,
    title,
    count: String(skills.length),
    gate_note: gateNote,
    concern_text: concernText,
    titles: titles.join("、"),
    gate_requirements: gateRequirements,
    synthesized_rules: synthesizedRules,
  };
  const markdown = template
    .replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`)
    .replace(/^[ \t]+$/gm, "");

  return {
    title,
    category: first?.category ?? "general",
    summary,
    markdown,
  };
}

export function BatchSkillDrawer({
  isOpen,
  onOpenChange,
  selectedSkills,
  customRules,
  targetProjectId,
  onApplied,
}: BatchSkillDrawerProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("general");
  const [summary, setSummary] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [promptTemplate, setPromptTemplate] = useState(DEFAULT_MERGE_PROMPT);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [appliedOk, setAppliedOk] = useState(false);

  // 选中项签名：仅当勾选集合真正变化时才重置编辑内容，避免抽屉打开期间反复覆盖用户改动
  const selectionKey = useMemo(
    () => (selectedSkills ?? []).map((s) => s?.title ?? "").join("|"),
    [selectedSkills]
  );

  useEffect(() => {
    if (!isOpen) return;
    const merged = buildMergedMarkdown(selectedSkills ?? [], customRules, promptTemplate);
    setTitle(merged.title);
    setCategory(merged.category);
    setSummary(merged.summary);
    setMarkdown(merged.markdown);
    setCopiedKey(null);
    setApplyError(null);
    setAppliedOk(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectionKey]);

  // 用户修改生成模板后，用当前标题/摘要重新渲染 markdown（打开抽屉时自动执行一次）
  const handlePromptChange = (value: string) => {
    setPromptTemplate(value);
    const merged = buildMergedMarkdown(selectedSkills ?? [], customRules, value, {
      title,
      summary,
    });
    setMarkdown(merged.markdown);
  };

  const handleResetPrompt = () => {
    setPromptTemplate(DEFAULT_MERGE_PROMPT);
    const merged = buildMergedMarkdown(selectedSkills ?? [], customRules, DEFAULT_MERGE_PROMPT, {
      title,
      summary,
    });
    setMarkdown(merged.markdown);
  };

  const skillCount = (selectedSkills ?? []).filter(Boolean).length;
  const firstCategory = (selectedSkills ?? []).find(Boolean)?.category ?? "general";
  const boundRuleCount = useMemo(() => {
    const titles = new Set((selectedSkills ?? []).map((s) => s?.title?.toLowerCase()));
    return (customRules ?? []).filter((r) => titles.has(r?.title?.toLowerCase())).length;
  }, [selectedSkills, customRules]);

  const handleCopy = (text: string, key: string) => {
    if (typeof navigator !== "undefined" && navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  const handleDownload = () => {
    if (typeof window === "undefined") return;
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slugify(title)}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleApply = async () => {
    if (!title.trim()) return;
    setIsApplying(true);
    setApplyError(null);
    try {
      const payload = {
        agent_skill: {
          title: title.trim(),
          category,
          summary: summary.trim() || title.trim(),
          markdown: markdown.trim() || `# Skill: ${title}\n\n${summary}`,
        },
      };
      const res = await fetch(
        `http://127.0.0.1:8000/api/projects/${encodeURIComponent(targetProjectId)}/rules/apply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (res?.ok) {
        setAppliedOk(true);
        onApplied?.();
      } else {
        const errText = (await res?.text().catch(() => "")) ?? "";
        setApplyError(errText ? `接口返回错误：${errText.slice(0, 200)}` : "Apply 失败，请检查后端服务是否可用");
      }
    } catch (err) {
      console.error("Failed to apply merged skill:", err);
      setApplyError("网络请求异常，请确认后端服务 (127.0.0.1:8000) 已启动");
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      placement="right"
      size="2xl"
      scrollBehavior="inside"
      backdrop="blur"
      classNames={{
        base: "border-l border-slate-200 dark:border-slate-800",
        header: "h-14 px-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70",
        body: "p-5 space-y-4 bg-white dark:bg-slate-950",
        footer: "px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80",
      }}
    >
      <DrawerHeader className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-amber-500 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0 text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">
              批量生成合并 Skill
            </h2>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
              已选 {skillCount} 条资产 · 模板可见可改 · 目标项目 {targetProjectId}
            </p>
          </div>
        </div>
        <Button
          isIconOnly
          size="sm"
          variant="light"
          radius="lg"
          onPress={() => onOpenChange(false)}
          aria-label="关闭抽屉"
        >
          <X className="h-4 w-4 text-slate-500" />
        </Button>
      </DrawerHeader>

      <DrawerBody>
        {/* 选中资产清单 */}
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
            <Layers className="h-3.5 w-3.5 text-indigo-500" />
            <span>本次合并的 Skill 资产（{skillCount} 项）</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(selectedSkills ?? []).filter(Boolean).map((s, idx) => {
              const cat = s?.category ?? "general";
              const color =
                CATEGORY_COLORS?.[cat] ?? CATEGORY_COLORS.general ?? "bg-slate-100 text-slate-700";
              return (
                <Chip key={`${s?.title ?? idx}`} size="sm" variant="flat" className={cn("text-[10px]", color)}>
                  {s?.title ?? "未命名"}
                </Chip>
              );
            })}
          </div>
          {boundRuleCount > 0 && (
            <p className="text-[10px] text-rose-500 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              <span>其中 {boundRuleCount} 项已绑定 Pre-Commit 卡点正则（合并后仅保留规范内容，不生成正则）</span>
            </p>
          )}
        </div>

        {/* 生成模板（Prompt）：可见可改 */}
        <div className="rounded-xl border border-indigo-200/70 dark:border-indigo-800/60 bg-indigo-50/30 dark:bg-indigo-950/20 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
              <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
              <span>生成模板（Prompt）—— 修改 {"{{占位符}}"} 改变生成效果</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="flat"
                color="secondary"
                className="min-w-0 h-6 px-2 text-[10px]"
                onPress={handleResetPrompt}
                startContent={<RefreshCw className="h-3 w-3" />}
              >
                恢复默认
              </Button>
            </div>
          </div>
          <textarea
            rows={skillCount > 1 ? 10 : 3}
            value={promptTemplate}
            onChange={(e) => handlePromptChange(e.target.value)}
            spellCheck={false}
            disabled={skillCount <= 1}
            className="w-full px-3 py-2 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-mono text-[11px] leading-relaxed focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <p className="text-[10px] text-indigo-500/80 dark:text-indigo-400/70 leading-relaxed">
            {skillCount > 1
              ? `可用占位符：${"{{name}}"} · ${"{{description}}"} · ${"{{title}}"} · ${"{{count}}"} · ${"{{gate_note}}"} · ${"{{concern_text}}"} · ${"{{titles}}"} · ${"{{gate_requirements}}"} · ${"{{synthesized_rules}}"}`
              : `该模板仅在选中多条（≥2）资产时生效；当前为单条，将直接沿用原文。`}
          </p>
        </div>

        <Divider />

        {/* 生成表单 */}
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              合并技能标题 (Title) *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="组合规范名称"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              规范分类 (Category)
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-400 mt-1">
              默认沿用首个选中资产分类：{firstCategory}
            </p>
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              核心摘要 (Summary)
            </label>
            <textarea
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="组合规范的设计原则摘要..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FileCode className="h-3.5 w-3.5 text-cyan-500" />
                <span>合并后 Markdown 内容（可编辑）</span>
              </span>
              <span className="text-[10px] text-slate-400 font-normal">
                {skillCount > 1 ? `提示：上方"生成模板"改动后，这里会自动重新生成` : "单条资产直接沿用原文"}
              </span>
            </label>
            <textarea
              rows={16}
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              spellCheck={false}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-950 dark:bg-slate-950 text-slate-200 dark:text-slate-200 font-mono text-[11px] leading-relaxed focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Apply 结果提示 */}
        {applyError && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{applyError}</span>
          </div>
        )}
        {appliedOk && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-400 flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              合并 Skill 已成功写入项目 <code className="font-mono">{targetProjectId}</code>，页面数据已刷新。
            </span>
          </div>
        )}
      </DrawerBody>

      <DrawerFooter className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="bordered"
            startContent={copiedKey === "merged_md" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            onPress={() => handleCopy(markdown, "merged_md")}
            className="text-xs text-slate-700 dark:text-slate-200"
          >
            {copiedKey === "merged_md" ? "已复制" : "复制"}
          </Button>
          <Button
            size="sm"
            variant="bordered"
            startContent={<Download className="h-3.5 w-3.5" />}
            onPress={handleDownload}
            className="text-xs text-slate-700 dark:text-slate-200"
          >
            下载
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="light" onPress={() => onOpenChange(false)} className="text-xs text-slate-600 dark:text-slate-300">
            取消
          </Button>
          <Button
            size="sm"
            color="primary"
            isDisabled={!title.trim() || isApplying}
            onPress={handleApply}
            className="text-xs font-semibold bg-gradient-to-r from-amber-500 via-indigo-600 to-blue-600"
            startContent={
              isApplying ? <Spinner size="sm" color="white" className="h-3.5 w-3.5" /> : <Rocket className="h-3.5 w-3.5" />
            }
          >
            {isApplying ? (
              <span className="flex items-center gap-1">
                <RefreshCw className="h-3 w-3 animate-spin" />
                正在落库...
              </span>
            ) : appliedOk ? (
              "已应用"
            ) : (
              "Apply 落库"
            )}
          </Button>
        </div>
      </DrawerFooter>
    </Drawer>
  );
}
