"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  X,
  FolderGit2,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Plus,
  Loader2,
  AlertCircle,
  Check,
  Copy,
  ArrowRight,
  Sparkles,
  Terminal,
  CheckCircle2,
  Layers,
  Wand2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useFlowStore } from "@/stores/useFlowStore";
import { cn } from "@/lib/utils";
import { PresetId } from "@/types/flow";

interface AddProjectModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  onCreated?: (projectId: string) => void;
}

interface PipelineTemplateOption {
  id: PresetId;
  title: string;
  badge: string;
  description: string;
  icon: typeof ShieldCheck;
  tagColor: string;
}

const PIPELINE_TEMPLATES: PipelineTemplateOption[] = [
  {
    id: "full_review_heal",
    title: "企业级双规防线",
    badge: "全栈推荐",
    description: "代码安全漏洞深度阻断 + 单测覆盖率红线 (≥80%) 双规并联卡点",
    icon: ShieldCheck,
    tagColor: "blue",
  },
  {
    id: "quick_test_gen",
    title: "自动化单测质量流",
    badge: "质量红线",
    description: "严格校验单元测试健全性，AI 沙箱自动化隔离并运行验证",
    icon: Layers,
    tagColor: "emerald",
  },
  {
    id: "security_audit",
    title: "致命缺陷与注入专项防御",
    badge: "安全特级",
    description: "专项拦截 SQL 注入 / 空指针解构 / 明文秘钥 / RCE 越权等高危隐患",
    icon: ShieldAlert,
    tagColor: "rose",
  },
];

const QUICK_SAMPLES = [
  {
    label: "电商订单微服务",
    id: "order-service",
    name: "统一订单履约中台",
    desc: "核心订单创建、支付流转与履约状态机微服务",
    preset: "full_review_heal" as PresetId,
  },
  {
    label: "企业管理中台前端",
    id: "admin-portal",
    name: "运营管理中心前端",
    desc: "React / TypeScript 核心前端中台系统与组件库",
    preset: "quick_test_gen" as PresetId,
  },
  {
    label: "统一分布式网关",
    id: "api-gateway",
    name: "核心 API 接入网关",
    desc: "高吞吐流量分发、鉴权认证与多租户限流路由",
    preset: "security_audit" as PresetId,
  },
];

function parseGitRepoInfo(input: string): { id: string; name: string } | null {
  const clean = input?.trim() ?? "";
  if (!clean) return null;

  // 1. Match Git URLs: https://github.com/org/repo(.git) or git@gitlab.com:org/repo.git
  const gitUrlMatch = clean.match(/(?:[:/])([^/:]+?)(?:\.git)?$/i);
  if (gitUrlMatch?.[1]) {
    const rawRepo = gitUrlMatch[1].replace(/\.git$/i, "").trim();
    if (rawRepo) {
      const sanitizedId = rawRepo.replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase();
      return {
        id: sanitizedId,
        name: rawRepo,
      };
    }
  }

  // 2. Match local path: C:\projects\my-service or /home/dev/my-service
  const localMatch = clean.match(/[^\\/]+$/);
  if (localMatch?.[0]) {
    const rawFolder = localMatch[0].trim();
    if (rawFolder) {
      const sanitizedId = rawFolder.replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase();
      return {
        id: sanitizedId,
        name: rawFolder,
      };
    }
  }

  return null;
}

export function AddProjectModal(props?: AddProjectModalProps) {
  const router = useRouter();
  const storeIsOpen = useFlowStore((s) => s?.isAddProjectModalOpen ?? false);
  const setStoreIsOpen = useFlowStore((s) => s?.setAddProjectModalOpen);
  const { createProject, projects, setSelectedProjectId } = useFlowStore() ?? {};

  const isOpen = props?.isOpen !== undefined ? props.isOpen : storeIsOpen;

  // Step state: "config" -> "connected"
  const [step, setStep] = useState<"config" | "connected">("config");

  // Form states
  const [gitUrlInput, setGitUrlInput] = useState("");
  const [projectId, setProjectId] = useState("");
  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<PresetId>("full_review_heal");
  const [failureAction, setFailureAction] = useState<"block_commit" | "warn_only" | "disabled">("block_commit");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Connected step info
  const [createdProjectId, setCreatedProjectId] = useState<string>("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState("http://127.0.0.1:8000");

  const idInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const currentHost = window?.location?.hostname ?? "";
      const protocol = window?.location?.protocol ?? "http:";
      if (currentHost === "localhost" || currentHost === "127.0.0.1") {
        setServerUrl("http://127.0.0.1:8000");
      } else {
        const host = window?.location?.host ?? "127.0.0.1:8000";
        setServerUrl(`${protocol}//${host}`);
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && step === "config") {
      setTimeout(() => {
        idInputRef?.current?.focus();
      }, 80);
    }
  }, [isOpen, step]);

  // Real-time ID Validation
  const idValidation = useMemo(() => {
    const clean = projectId?.trim() ?? "";
    if (!clean) return { valid: false, message: "" };
    if (!/^[a-zA-Z0-9_-]+$/.test(clean)) {
      return { valid: false, message: "仅限英文字母、数字、下划线(_)与中划线(-)" };
    }
    if (clean.length > 64) {
      return { valid: false, message: "长度不能超过 64 字符" };
    }
    const exists = (projects ?? []).some(
      (p) => p?.id?.toLowerCase() === clean.toLowerCase()
    );
    if (exists) {
      return { valid: false, message: `标识 "${clean}" 已存在，不可重复` };
    }
    return { valid: true, message: "项目标识可用" };
  }, [projectId, projects]);

  if (!isOpen) return null;

  const resetForm = () => {
    setStep("config");
    setGitUrlInput("");
    setProjectId("");
    setProjectName("");
    setDescription("");
    setSelectedTemplate("full_review_heal");
    setFailureAction("block_commit");
    setErrorMsg(null);
    setCreatedProjectId("");
    setCopiedKey(null);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    resetForm();
    if (props?.onClose) {
      props.onClose();
    } else {
      setStoreIsOpen?.(false);
    }
  };

  // Quick auto-parse from Git URL or Path
  const handleGitUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e?.target?.value ?? "";
    setGitUrlInput(val);
    const parsed = parseGitRepoInfo(val);
    if (parsed) {
      setProjectId(parsed.id);
      if (!projectName) {
        setProjectName(parsed.name);
      }
      if (!description) {
        setDescription(`从代码仓库接入: ${val.trim()}`);
      }
    }
  };

  // Quick apply sample preset
  const handleApplySample = (sample: typeof QUICK_SAMPLES[0]) => {
    setProjectId(sample.id);
    setProjectName(sample.name);
    setDescription(sample.desc);
    setSelectedTemplate(sample.preset);
    setErrorMsg(null);
  };

  // Slugify project name suggestion
  const handleSuggestSlug = () => {
    const trimmed = projectName?.trim() ?? "";
    if (!trimmed) return;
    const slug = trimmed
      .toLowerCase()
      .replace(/[\s\-_]+/g, "-")
      .replace(/[^a-z0-9_-]/g, "");
    if (slug) {
      setProjectId(slug);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e?.preventDefault?.();
    setErrorMsg(null);

    const cleanId = projectId?.trim() ?? "";
    if (!cleanId) {
      setErrorMsg("请输入项目唯一标识 (ID)");
      return;
    }

    if (!idValidation?.valid) {
      setErrorMsg(idValidation?.message || "项目标识格式无效");
      return;
    }

    setIsSubmitting(true);
    try {
      const ok = await createProject?.({
        id: cleanId,
        name: projectName?.trim() || cleanId,
        description: description?.trim() || `接入的代码仓库: ${cleanId}`,
        failure_action: failureAction,
        presetId: selectedTemplate,
      });

      if (ok) {
        setCreatedProjectId(cleanId);
        props?.onCreated?.(cleanId);
        // Transition to Step 2 smoothly
        setStep("connected");
      } else {
        setErrorMsg("接入项目失败，请检查项目标识是否冲突或稍后重试");
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "接入项目发生异常");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator?.clipboard?.writeText?.(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const hookInstallCmd = `curl -s "${serverUrl}/scripts/flowdev-hook.js" -o .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit`;
  const nodeInstallCmd = `node scripts/install-hook.js`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden transition-all flex flex-col max-h-[92vh]"
        onClick={(e) => e?.stopPropagation?.()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <FolderGit2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {step === "config" ? "接入新代码仓库 / 项目" : "项目接入就绪"}
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  {step === "config" ? "Step 1/2 · 配置" : "Step 2/2 · 就绪"}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {step === "config"
                  ? "配置工程元数据与初始门禁防线，秒级纳入多智能体质量治理矩阵"
                  : `恭喜！项目 "${createdProjectId}" 已成功创建并初始化门禁流水线`}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        {step === "config" ? (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center gap-2 text-rose-600 dark:text-rose-300 animate-in fade-in duration-150">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Smart Auto-Parse from Git URL / Path */}
            <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Wand2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  <span>智能快速解析 (粘贴 Git 仓库地址 或 本地路径)</span>
                </label>
                <span className="text-[10px] text-slate-400 font-mono">支持 HTTPS / SSH / 绝对路径</span>
              </div>
              <input
                type="text"
                value={gitUrlInput}
                onChange={handleGitUrlChange}
                placeholder="例如: https://github.com/my-team/payment-service.git 或 D:\projects\payment-service"
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 font-mono text-[11px]"
              />
            </div>

            {/* Quick Sample Presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-slate-400 text-[11px] font-medium flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-amber-500" />
                <span>快速试用:</span>
              </span>
              {QUICK_SAMPLES.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => handleApplySample(sample)}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 hover:border-blue-500/40 hover:bg-blue-50/60 dark:hover:bg-blue-950/30 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer text-[11px]"
                >
                  {sample.label}
                </button>
              ))}
            </div>

            {/* Basic Project Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              {/* Project ID */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    项目唯一标识 (ID) <span className="text-rose-500">*</span>
                  </label>
                  {projectId && (
                    <span
                      className={cn(
                        "text-[10px] font-medium flex items-center gap-0.5",
                        idValidation?.valid
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-500"
                      )}
                    >
                      {idValidation?.valid ? (
                        <>
                          <Check className="h-3 w-3" />
                          <span>可用</span>
                        </>
                      ) : (
                        <span>{idValidation?.message}</span>
                      )}
                    </span>
                  )}
                </div>
                <input
                  ref={idInputRef}
                  type="text"
                  required
                  value={projectId}
                  onChange={(e) => setProjectId(e?.target?.value ?? "")}
                  placeholder="例如: customer-portal"
                  className={cn(
                    "w-full px-3 py-2 rounded-xl border bg-white dark:bg-slate-950 font-mono text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all",
                    idValidation?.valid && projectId
                      ? "border-emerald-500/50 focus:ring-emerald-500/20"
                      : projectId && !idValidation?.valid
                      ? "border-rose-400 focus:ring-rose-500/20"
                      : "border-slate-200 dark:border-slate-800 focus:ring-blue-500/30"
                  )}
                />
              </div>

              {/* Project Display Name */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    项目中文名称
                  </label>
                  {projectName && !projectId && (
                    <button
                      type="button"
                      onClick={handleSuggestSlug}
                      className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      自动推导 ID
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e?.target?.value ?? "")}
                  placeholder="例如: 统一客户门户系统"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                项目业务描述
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e?.target?.value ?? "")}
                placeholder="例如: 核心业务线微服务，接入 Git Hook 自动保障代码质量与空安全..."
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all resize-none text-[11px]"
              />
            </div>

            {/* Pipeline Template Preset Cards */}
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                门禁流水线初始预设模板
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {PIPELINE_TEMPLATES.map((tmpl) => {
                  const Icon = tmpl.icon;
                  const isSelected = selectedTemplate === tmpl.id;
                  return (
                    <div
                      key={tmpl.id}
                      onClick={() => setSelectedTemplate(tmpl.id)}
                      className={cn(
                        "p-2.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between select-none relative",
                        isSelected
                          ? "border-blue-500 bg-blue-50/60 dark:bg-blue-950/30 ring-2 ring-blue-500/20"
                          : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-950"
                      )}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <Icon className={cn("h-4 w-4", isSelected ? "text-blue-600 dark:text-blue-400" : "text-slate-400")} />
                            <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                              {tmpl.title}
                            </span>
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                          {tmpl.description}
                        </p>
                      </div>
                      <div className="mt-2 flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/80">
                        <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-medium bg-slate-100 dark:bg-slate-800 text-slate-500">
                          {tmpl.badge}
                        </span>
                        {isSelected && (
                          <Check className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Initial Gate Mode */}
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                初始门禁拦截模式
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setFailureAction("block_commit")}
                  className={cn(
                    "p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer",
                    failureAction === "block_commit"
                      ? "border-rose-500 bg-rose-50/60 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 ring-2 ring-rose-500/20"
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300"
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <ShieldAlert className="h-3.5 w-3.5 text-rose-500" />
                    <span className="font-bold text-xs">严格阻断</span>
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-tight">
                    Exit 1 拦截致命缺陷
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setFailureAction("warn_only")}
                  className={cn(
                    "p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer",
                    failureAction === "warn_only"
                      ? "border-amber-500 bg-amber-50/60 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 ring-2 ring-amber-500/20"
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300"
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-amber-500" />
                    <span className="font-bold text-xs">仅提示</span>
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-tight">
                    智能审查建议 100% 放行
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setFailureAction("disabled")}
                  className={cn(
                    "p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer",
                    failureAction === "disabled"
                      ? "border-slate-500 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 ring-2 ring-slate-500/20"
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300"
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <ShieldOff className="h-3.5 w-3.5 text-slate-400" />
                    <span className="font-bold text-xs">关闭门禁</span>
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-tight">
                    秒级直接提交
                  </span>
                </button>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !projectId || !idValidation?.valid}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-semibold transition-all shadow-sm shadow-blue-500/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>正在创建并初始化流水线...</span>
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" />
                    <span>确认接入并初始化</span>
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* Step 2: Connected Handoff & Quick Install */
          <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
            {/* Success Celebration Banner */}
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3 text-emerald-800 dark:text-emerald-300">
              <div className="h-8 w-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  🎉 项目「{createdProjectId}」已成功接入 FlowDev-AI！
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  门禁流水线预设已就绪，初始规则与 DAG 节点已自动写入策略中枢。
                </p>
              </div>
            </div>

            {/* Quick Install Terminal Commands */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Terminal className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                  <span>一键安装 Pre-Commit 门禁探针 (本地 Git 仓库终端运行)</span>
                </label>
                <span className="text-[10px] text-slate-400 font-mono">1 步即可生效</span>
              </div>

              {/* Command box */}
              <div className="relative rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950 p-3 font-mono text-[11px] text-slate-200 shadow-inner">
                <div className="overflow-x-auto whitespace-pre-wrap leading-5 pr-14 text-cyan-300">
                  {hookInstallCmd}
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(hookInstallCmd, "hook")}
                  className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-200 transition-colors cursor-pointer border border-slate-700"
                >
                  {copiedKey === "hook" ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-400" />
                      <span>已复制</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>复制</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 px-1">
                <span>Windows Node.js 快捷方式: <code className="font-mono text-slate-600 dark:text-slate-300">{nodeInstallCmd}</code></span>
                <button
                  type="button"
                  onClick={() => handleCopy(nodeInstallCmd, "node")}
                  className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  {copiedKey === "node" ? "已复制" : "复制此命令"}
                </button>
              </div>
            </div>

            {/* Next Steps CTA Actions */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300 block text-[11px]">
                🚀 接下来你可以：
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProjectId?.(createdProjectId);
                    handleClose();
                    router?.push?.(`/pipeline?project=${encodeURIComponent(createdProjectId)}`);
                  }}
                  className="p-3 rounded-xl border border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 flex items-center justify-between text-left transition-all cursor-pointer group"
                >
                  <div>
                    <div className="font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                      <span>查看门禁流水线画布</span>
                      <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                      调整已初始化的审查算子与覆盖率阈值
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedProjectId?.(createdProjectId);
                    handleClose();
                    router?.push?.(`/dashboard?project=${encodeURIComponent(createdProjectId)}`);
                  }}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-950 flex items-center justify-between text-left transition-all cursor-pointer group"
                >
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <span>前往项目质量大盘</span>
                      <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                      查看实时健康度雷达与审计流水矩阵
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-2 flex items-center justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="px-5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
              >
                完成
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
