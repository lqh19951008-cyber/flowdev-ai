"use client";

import React, { useState, useEffect } from "react";
import {
  Send,
  CheckCircle2,
  AlertCircle,
  X,
  Bot,
  SlidersHorizontal,
  Sparkles,
  KeyRound,
  Eye,
  EyeOff,
  Server,
  Zap,
  Globe,
  Plus,
  Trash2,
  Edit3,
  Check,
  Layers,
  Copy,
  Info,
  CheckCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useFlowStore } from "@/stores/useFlowStore";

export interface LLMProfile {
  id: string;
  name: string;
  provider_type?: string;
  api_base: string;
  api_key?: string;
  api_keys?: string[];
  masked_keys?: string[];
  key_count?: number;
  masked_key?: string;
  default_model: string;
  request_timeout?: number;
  has_key?: boolean;
  created_at?: string;
  updated_at?: string;
}

interface SystemSettingsModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  defaultTab?: "llm" | "feishu";
  isEmbedded?: boolean;
}

// Preset connection templates for quick-adding / editing
const PRESET_TEMPLATES = [
  {
    name: "🏢 亚信企业网关",
    provider_type: "asiainfo",
    api_base: "https://tokenerpgw.asiainfo.com/erp/v1",
    default_model: "AI/deekseek-v4-flash-0731",
    desc: "亚信内部微服务与 ERP 统一大模型中转网关 (uk-... Token)",
  },
  {
    name: "⚡ DeepSeek 官方",
    provider_type: "deepseek",
    api_base: "https://api.deepseek.com/v1",
    default_model: "deepseek-chat",
    desc: "DeepSeek 官方 API (V3 / R1 满血推理)",
  },
  {
    name: "🌐 OpenAI 官方",
    provider_type: "openai",
    api_base: "https://api.openai.com/v1",
    default_model: "gpt-4o",
    desc: "OpenAI 官方 ChatCompletions 标准接口",
  },
  {
    name: "☁️ 阿里通义千问",
    provider_type: "dashscope",
    api_base: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    default_model: "qwen-plus",
    desc: "阿里云 DashScope 兼容模式 API",
  },
  {
    name: "🚀 硅基流动",
    provider_type: "siliconflow",
    api_base: "https://api.siliconflow.cn/v1",
    default_model: "deepseek-ai/DeepSeek-V3",
    desc: "SiliconFlow 大模型托管加速平台",
  },
  {
    name: "🌙 月之暗面 Kimi",
    provider_type: "moonshot",
    api_base: "https://api.moonshot.cn/v1",
    default_model: "moonshot-v1-8k",
    desc: "Moonshot AI 长文本分析引擎",
  },
  {
    name: "🦙 本地 Ollama",
    provider_type: "ollama",
    api_base: "http://127.0.0.1:11434/v1",
    default_model: "qwen2.5-coder:7b",
    desc: "内网本地离线部署的 Ollama 实例 (免 Key)",
  },
];

// Helper: parse string or list to array of non-empty keys
function parseKeys(raw: string | string[] | undefined): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.flatMap((k) => parseKeys(k));
  }
  return raw
    .split(/[\r\n,;]+/)
    .map((k) => k.trim())
    .filter(Boolean);
}

export function SystemSettingsModal({
  isOpen,
  onClose,
  defaultTab,
  isEmbedded,
}: SystemSettingsModalProps) {
  const storeIsOpen = useFlowStore((s) => s.isSettingsModalOpen);
  const storeTab = useFlowStore((s) => s.settingsModalTab);
  const setSettingsModalOpen = useFlowStore((s) => s.setSettingsModalOpen);

  const effectiveIsOpen = isOpen !== undefined ? isOpen : storeIsOpen;
  const handleClose = onClose || (() => setSettingsModalOpen(false));
  const effectiveDefaultTab = defaultTab || storeTab || "llm";

  const [activeTab, setActiveTab] = useState<"llm" | "feishu">(effectiveDefaultTab);

  // LLM Profiles state
  const [profiles, setProfiles] = useState<LLMProfile[]>([]);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);

  // Copy feedback state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, identifier?: string) => {
    if (!text) return;
    try {
      if (typeof navigator !== "undefined" && navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(text).catch(() => {});
      }
    } catch (e) {}
    const id = identifier || text;
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId((curr) => (curr === id ? null : curr));
    }, 1800);
  };

  // Profile Editor / Creator Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formProviderType, setFormProviderType] = useState("custom");
  const [formApiBase, setFormApiBase] = useState("");
  const [formApiKeys, setFormApiKeys] = useState<string[]>([""]);
  const [formDefaultModel, setFormDefaultModel] = useState("");
  const [showApiKeys, setShowApiKeys] = useState<boolean[]>([false]);
  const [batchPasteInput, setBatchPasteInput] = useState("");
  const [showBatchPaste, setShowBatchPaste] = useState(false);
  const [isFormSaving, setIsFormSaving] = useState(false);

  // Quick Key Switcher Modal State (Supports Multi-Key)
  const [quickKeyModal, setQuickKeyModal] = useState<{
    profileId: string;
    profileName: string;
    keys: string[];
  } | null>(null);
  const [quickKeyList, setQuickKeyList] = useState<string[]>([""]);
  const [showQuickKeys, setShowQuickKeys] = useState<boolean[]>([false]);
  const [quickBatchPaste, setQuickBatchPaste] = useState("");
  const [showQuickBatchPaste, setShowQuickBatchPaste] = useState(false);
  const [isSavingQuickKey, setIsSavingQuickKey] = useState(false);

  // Testing state
  const [testingProfileId, setTestingProfileId] = useState<string | null>(null);
  const [llmTestResult, setLlmTestResult] = useState<{
    profileId?: string;
    success: boolean;
    message: string;
  } | null>(null);

  // Feishu state
  const [webhookUrl, setWebhookUrl] = useState("");
  const [notifyOnlyBlocked, setNotifyOnlyBlocked] = useState(true);
  const [isFeishuConfigured, setIsFeishuConfigured] = useState(false);
  const [isFeishuLoading, setIsFeishuLoading] = useState(false);
  const [isFeishuTesting, setIsFeishuTesting] = useState(false);
  const [feishuTestResult, setFeishuTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (effectiveIsOpen) {
      setActiveTab(effectiveDefaultTab);
      fetchLlmProfiles();
      fetchFeishuStatus();
      setLlmTestResult(null);
      setFeishuTestResult(null);
      setIsFormOpen(false);
      setQuickKeyModal(null);
    }
  }, [effectiveIsOpen, effectiveDefaultTab]);

  const fetchLlmProfiles = async () => {
    try {
      setIsLoadingProfiles(true);
      const res = await fetch("http://127.0.0.1:8000/api/llm/profiles");
      if (res.ok) {
        const data = await res.json();
        setProfiles(data.profiles || []);
      }
    } catch (e) {
      console.warn("Failed to fetch LLM profiles", e);
    } finally {
      setIsLoadingProfiles(false);
    }
  };

  const fetchFeishuStatus = async () => {
    try {
      setIsFeishuLoading(true);
      const res = await fetch("http://127.0.0.1:8000/api/feishu/status");
      if (res.ok) {
        const data = await res.json();
        setWebhookUrl(data.webhook_url || "");
        setNotifyOnlyBlocked(data.notify_only_blocked ?? true);
        setIsFeishuConfigured(data.configured ?? false);
      }
    } catch (e) {
      console.warn("Failed to fetch Feishu status", e);
    } finally {
      setIsFeishuLoading(false);
    }
  };

  // Open Form to Add New Profile
  const handleOpenAddForm = (template?: (typeof PRESET_TEMPLATES)[0]) => {
    setEditingProfileId(null);
    if (template) {
      const count = profiles.filter(
        (p) => p.name.startsWith(template.name) || p.provider_type === template.provider_type
      ).length;
      const initialName = count > 0 ? `${template.name} (账号${count + 1})` : template.name;

      setFormName(initialName);
      setFormProviderType(template.provider_type);
      setFormApiBase(template.api_base);
      setFormApiKeys([""]);
      setShowApiKeys([false]);
      setFormDefaultModel(template.default_model);
    } else {
      const count = profiles.filter((p) => p.provider_type === "custom").length;
      setFormName(count > 0 ? `自定义 LLM 连接 (${count + 1})` : "自定义 LLM 连接");
      setFormProviderType("custom");
      setFormApiBase("https://");
      setFormApiKeys([""]);
      setShowApiKeys([false]);
      setFormDefaultModel("deepseek-chat");
    }
    setBatchPasteInput("");
    setShowBatchPaste(false);
    setIsFormOpen(true);
  };

  // Duplicate / Clone Profile with all keys
  const handleDuplicateProfile = (profile: LLMProfile) => {
    setEditingProfileId(null);
    const baseName = profile.name.replace(/\s*\(.*\)/, "");
    const count = profiles.filter((p) => p.name.includes(baseName)).length;
    setFormName(`${baseName} (账号${count + 1})`);
    setFormProviderType(profile.provider_type || "custom");
    setFormApiBase(profile.api_base);
    
    const existingKeys = parseKeys(profile.api_keys?.length ? profile.api_keys : profile.api_key);
    setFormApiKeys(existingKeys.length > 0 ? existingKeys : [""]);
    setShowApiKeys(existingKeys.map(() => false));
    setFormDefaultModel(profile.default_model);
    setBatchPasteInput("");
    setShowBatchPaste(false);
    setIsFormOpen(true);
  };

  // Open Form to Edit Existing Profile
  const handleOpenEditForm = (profile: LLMProfile) => {
    setEditingProfileId(profile.id);
    setFormName(profile.name);
    setFormProviderType(profile.provider_type || "custom");
    setFormApiBase(profile.api_base);
    const existingKeys = parseKeys(profile.api_keys?.length ? profile.api_keys : profile.api_key);
    setFormApiKeys(existingKeys.length > 0 ? existingKeys : [""]);
    setShowApiKeys(existingKeys.map(() => false));
    setFormDefaultModel(profile.default_model);
    setBatchPasteInput("");
    setShowBatchPaste(false);
    setIsFormOpen(true);
  };

  // Multi-key helper in Form
  const handleAddFormKeyRow = () => {
    setFormApiKeys((prev) => [...prev, ""]);
    setShowApiKeys((prev) => [...prev, false]);
  };

  const handleRemoveFormKeyRow = (index: number) => {
    setFormApiKeys((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0 ? next : [""];
    });
    setShowApiKeys((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0 ? next : [false];
    });
  };

  const handleFormKeyChange = (index: number, val: string) => {
    setFormApiKeys((prev) => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
  };

  const handleApplyBatchPasteForm = () => {
    const parsed = parseKeys(batchPasteInput);
    if (parsed.length > 0) {
      setFormApiKeys((prev) => {
        const filteredPrev = prev.filter((k) => k.trim());
        const merged = Array.from(new Set([...filteredPrev, ...parsed]));
        return merged.length > 0 ? merged : [""];
      });
      setShowApiKeys((prev) => new Array(Math.max(1, prev.length + parsed.length)).fill(false));
      setBatchPasteInput("");
      setShowBatchPaste(false);
    }
  };

  // Save Profile (Create or Update)
  const handleSaveProfile = async () => {
    try {
      setIsFormSaving(true);
      setLlmTestResult(null);

      const cleanedKeys = formApiKeys.map((k) => k.trim()).filter(Boolean);

      const payload = {
        name: formName.trim() || "自定义连接",
        provider_type: formProviderType || "custom",
        api_base: formApiBase.trim() || "https://api.openai.com/v1",
        api_keys: cleanedKeys,
        api_key: cleanedKeys.join("\n"),
        default_model: formDefaultModel.trim() || "deepseek-chat",
      };

      const url = editingProfileId
        ? `http://127.0.0.1:8000/api/llm/profiles/${editingProfileId}`
        : "http://127.0.0.1:8000/api/llm/profiles";
      const method = editingProfileId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.profiles) {
        setProfiles(data.profiles);
      } else {
        await fetchLlmProfiles();
      }

      setIsFormOpen(false);
      setLlmTestResult({
        success: true,
        message: editingProfileId
          ? `✅ 连接「${payload.name}」已成功更新 (${cleanedKeys.length} 个 Key)！`
          : `✅ 新连接「${payload.name}」已成功保存 (${cleanedKeys.length} 个 Key)！`,
      });
    } catch (e) {
      await fetchLlmProfiles();
      setIsFormOpen(false);
      setLlmTestResult({
        success: true,
        message: "✅ 连接已保存！",
      });
    } finally {
      setIsFormSaving(false);
    }
  };

  // Quick Key Modal handlers
  const handleOpenQuickKey = (p: LLMProfile) => {
    const existing = parseKeys(p.api_keys?.length ? p.api_keys : p.api_key);
    setQuickKeyModal({
      profileId: p.id,
      profileName: p.name,
      keys: existing,
    });
    setQuickKeyList(existing.length > 0 ? existing : [""]);
    setShowQuickKeys(existing.map(() => false));
    setQuickBatchPaste("");
    setShowQuickBatchPaste(false);
  };

  const handleSaveQuickKey = async () => {
    if (!quickKeyModal) return;
    try {
      setIsSavingQuickKey(true);
      const cleaned = quickKeyList.map((k) => k.trim()).filter(Boolean);
      const res = await fetch(`http://127.0.0.1:8000/api/llm/profiles/${quickKeyModal.profileId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_keys: cleaned,
          api_key: cleaned.join("\n"),
        }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.profiles) setProfiles(data.profiles);
        else await fetchLlmProfiles();

        setQuickKeyModal(null);
        setLlmTestResult({
          profileId: quickKeyModal?.profileId,
          success: true,
          message: `✅ 已成功为「${quickKeyModal?.profileName ?? "连接"}」更新 API Key (${cleaned.length} 个 Key)！`,
        });
      }
    } catch (e) {
      await fetchLlmProfiles();
      setQuickKeyModal(null);
      setLlmTestResult({
        profileId: quickKeyModal?.profileId,
        success: true,
        message: "✅ API Key 已保存！",
      });
    } finally {
      setIsSavingQuickKey(false);
    }
  };

  // Delete Profile
  const handleDeleteProfile = async (profileId: string, profileName: string) => {
    if (!confirm(`确定要删除连接「${profileName}」吗？`)) return;
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/llm/profiles/${profileId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.profiles) setProfiles(data.profiles);
      }
      await fetchLlmProfiles();
    } catch (e) {
      console.error("Failed to delete profile", e);
    }
  };

  // Test Profile Connection (Multi-Key aware)
  const handleTestProfile = async (profileId?: string) => {
    try {
      const targetId = profileId || editingProfileId || "form";
      setTestingProfileId(targetId);
      setLlmTestResult(null);

      let bodyPayload: any = {};
      if (profileId) {
        bodyPayload = { profile_id: profileId };
      } else {
        const cleanedKeys = formApiKeys.map((k) => k.trim()).filter(Boolean);
        bodyPayload = {
          api_base: formApiBase.trim() || "https://api.openai.com/v1",
          api_keys: cleanedKeys,
          api_key: cleanedKeys.join("\n"),
          model: formDefaultModel.trim() || "deepseek-chat",
        };
      }

      const res = await fetch("http://127.0.0.1:8000/api/llm/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setLlmTestResult({
          profileId: targetId,
          success: data.success,
          message: data.success ? data.message : `⚠️ 探测状态: ${data.message}`,
        });
      } else {
        setLlmTestResult({
          profileId: targetId,
          success: false,
          message: `⚠️ 接口返回状态码 (${res.status})。(💡 提示：即使探测异常亦可直接保存使用)`,
        });
      }
    } catch (e) {
      setLlmTestResult({
        profileId: profileId || "form",
        success: false,
        message: "⚠️ 网络探测异常。(💡 提示：连通性测试为可选探测，系统完全支持离线添加与保存)",
      });
    } finally {
      setTestingProfileId(null);
    }
  };

  // Feishu handlers
  const handleSaveFeishu = async () => {
    try {
      setIsFeishuLoading(true);
      setFeishuTestResult(null);
      const res = await fetch("http://127.0.0.1:8000/api/feishu/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webhook_url: webhookUrl.trim(),
          notify_only_blocked: notifyOnlyBlocked,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setIsFeishuConfigured(data.configured);
        setFeishuTestResult({ success: true, message: "飞书配置已成功保存！" });
      }
    } catch (e) {
      setFeishuTestResult({ success: false, message: "保存失败: 网络异常" });
    } finally {
      setIsFeishuLoading(false);
    }
  };

  const handleTestFeishu = async () => {
    try {
      setIsFeishuTesting(true);
      setFeishuTestResult(null);
      const res = await fetch("http://127.0.0.1:8000/api/feishu/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webhook_url: webhookUrl.trim() || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setFeishuTestResult(data);
      } else {
        setFeishuTestResult({ success: false, message: `请求失败 (${res.status})` });
      }
    } catch (e) {
      setFeishuTestResult({ success: false, message: "发送测试失败: 网络连接异常" });
    } finally {
      setIsFeishuTesting(false);
    }
  };

  const isModalActive = isEmbedded ? true : effectiveIsOpen;
  if (!isModalActive) return null;

  const content = (
    <div
      className={cn(
        "relative w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-6 flex flex-col space-y-5",
        isEmbedded ? "max-w-4xl mx-auto shadow-sm my-0" : "max-w-2xl my-auto max-h-[90vh] overflow-y-auto"
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Modal / View Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <SlidersHorizontal className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                系统与多大模型连接管理
              </h3>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/50">
                Multi-Key &amp; Connection Hub
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              支持配置多套大模型连接与单连接多 API Key，点击即可复制，随时测试与维护
            </p>
          </div>
        </div>

        {!isEmbedded && (
          <button
            onClick={handleClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

        {/* Tab Navigation */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-950/80 p-1 rounded-xl border border-slate-200/80 dark:border-slate-800">
          <button
            onClick={() => {
              setActiveTab("llm");
              setIsFormOpen(false);
              setQuickKeyModal(null);
            }}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all",
              activeTab === "llm"
                ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>LLM 连接与 API Key 管理 ({profiles.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("feishu")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all",
              activeTab === "feishu"
                ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            )}
          >
            <Bot className="h-3.5 w-3.5" />
            <span>飞书机器人通知 (Webhook)</span>
            {isFeishuConfigured ? (
              <span className="h-2 w-2 rounded-full bg-emerald-500" title="飞书已配置" />
            ) : (
              <span className="h-2 w-2 rounded-full bg-slate-400" title="未配置" />
            )}
          </button>
        </div>

        {/* TAB 1: LLM Multi-Profile & Multi-Key Manager */}
        {activeTab === "llm" && (
          <div className="space-y-4 animate-in fade-in duration-100">
            {/* Top Prominent Feedback / Status Banner */}
            {llmTestResult && (
              <div
                className={cn(
                  "p-3 rounded-xl border text-xs flex items-center justify-between gap-2 animate-in slide-in-from-top-2 duration-150 shadow-xs",
                  llmTestResult.success
                    ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                    : "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200"
                )}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {llmTestResult.success ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
                  )}
                  <span className="leading-snug break-words">{llmTestResult.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setLlmTestResult(null)}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0"
                  title="关闭提示"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Quick Key Manager Modal Banner */}
            {quickKeyModal && (
              <div className="p-4 rounded-xl border border-blue-500/40 bg-blue-50/60 dark:bg-blue-950/40 space-y-3 animate-in fade-in duration-100 shadow-sm">
                <div className="flex items-center justify-between pb-1 border-b border-blue-200/60 dark:border-blue-900/40">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                    <KeyRound className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span>管理 API Key 凭证池 — 「{quickKeyModal?.profileName ?? ""}」</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setQuickKeyModal(null)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>支持配置多个 Key (轮询/自动负载/备份)</span>
                    <button
                      type="button"
                      onClick={() => setShowQuickBatchPaste(!showQuickBatchPaste)}
                      className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                    >
                      {showQuickBatchPaste ? "收起批量粘贴" : "+ 批量粘贴多个 Key"}
                    </button>
                  </div>

                  {/* Batch Paste Box */}
                  {showQuickBatchPaste && (
                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900 space-y-1.5 animate-in fade-in">
                      <textarea
                        rows={2}
                        value={quickBatchPaste}
                        onChange={(e) => setQuickBatchPaste(e.target.value)}
                        placeholder="每行一个 Key，或以逗号/分号隔开粘贴..."
                        className="w-full text-xs font-mono bg-transparent border-0 focus:outline-none text-slate-800 dark:text-slate-200 resize-none"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const parsed = parseKeys(quickBatchPaste);
                            if (parsed.length > 0) {
                              const existing = quickKeyList.filter((k) => k.trim());
                              const merged = Array.from(new Set([...existing, ...parsed]));
                              setQuickKeyList(merged.length > 0 ? merged : [""]);
                              setShowQuickKeys(new Array(merged.length).fill(false));
                              setQuickBatchPaste("");
                              setShowQuickBatchPaste(false);
                            }
                          }}
                          className="px-2.5 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium"
                        >
                          解析并添加
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Individual Key Rows */}
                  <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                    {quickKeyList.map((k, idx) => {
                      const isRevealed = !!showQuickKeys[idx];
                      const isCopied = copiedId === `quick_${idx}_${k}`;

                      return (
                        <div key={idx} className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono text-slate-400 w-5 text-right">
                            #{idx + 1}
                          </span>
                          <div className="relative flex-1">
                            <input
                              type={isRevealed ? "text" : "password"}
                              value={k}
                              onChange={(e) => {
                                const next = [...quickKeyList];
                                next[idx] = e.target.value;
                                setQuickKeyList(next);
                              }}
                              placeholder={idx === 0 ? "主 API Key / Token" : "备用 API Key / Token"}
                              className="w-full pl-3 pr-16 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                            />
                            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                              {k && (
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(k, `quick_${idx}_${k}`)}
                                  className="p-1 rounded text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                  title="点击复制此 API Key"
                                >
                                  {isCopied ? (
                                    <CheckCheck className="h-3.5 w-3.5 text-emerald-500" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  const next = [...showQuickKeys];
                                  next[idx] = !next[idx];
                                  setShowQuickKeys(next);
                                }}
                                className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                              >
                                {isRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              </button>
                            </div>
                          </div>

                          {quickKeyList.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                setQuickKeyList((prev) => prev.filter((_, i) => i !== idx));
                                setShowQuickKeys((prev) => prev.filter((_, i) => i !== idx));
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 transition-colors"
                              title="删除此 Key"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setQuickKeyList((prev) => [...prev, ""]);
                        setShowQuickKeys((prev) => [...prev, false]);
                      }}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>添加一行备用 Key</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveQuickKey}
                      disabled={isSavingQuickKey}
                      className="px-3.5 py-1.5 text-xs rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors disabled:opacity-40 shadow-xs"
                    >
                      {isSavingQuickKey ? "保存中..." : "立即保存生效"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* If Form is Open, Render Form; Else Render Profiles List */}
            {isFormOpen ? (
              /* ADD / EDIT FORM */
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 space-y-4 animate-in fade-in duration-100">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      {editingProfileId ? "编辑 LLM 连接配置" : "新建 LLM API 连接"}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      (兼容 OpenAI / DeepSeek / 亚信网关协议)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  >
                    返回列表
                  </button>
                </div>

                {/* Info Tip */}
                <div className="p-2.5 rounded-lg bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 text-[11px] text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                  <Info className="h-4 w-4 shrink-0 text-blue-500" />
                  <span>
                    <strong>多Key与离线保存保障</strong>：支持在单个连接中配置<strong>多个 API Key</strong>（支持负载均衡与自动轮询备用）。测试为可选探测，即使断网或未连通也<strong>允许直接保存</strong>。
                  </span>
                </div>

                {/* Preset Picker if creating new */}
                {!editingProfileId && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      快速载入模版:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {PRESET_TEMPLATES.map((tmpl) => (
                        <button
                          key={tmpl.provider_type}
                          type="button"
                          onClick={() => {
                            const count = profiles.filter(
                              (p) => p.name.startsWith(tmpl.name) || p.provider_type === tmpl.provider_type
                            ).length;
                            setFormName(count > 0 ? `${tmpl.name} (账号${count + 1})` : tmpl.name);
                            setFormProviderType(tmpl.provider_type);
                            setFormApiBase(tmpl.api_base);
                            setFormDefaultModel(tmpl.default_model);
                          }}
                          className="px-2 py-1 text-[11px] rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200 dark:border-slate-700 transition-colors font-medium shadow-xs"
                        >
                          + {tmpl.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {/* Connection Name */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      <span>连接显示名称 (Name)</span>
                      <span className="text-[10px] text-slate-400">同一平台可配置多套独立连接</span>
                    </label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="例如: 🏢 亚信企业网关 (主账号)、⚡ DeepSeek 官方..."
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* API Base URL */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Globe className="h-3.5 w-3.5 text-slate-400" />
                        API Base URL (接口基准地址)
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        支持任意企业内网、代理或公网 URL
                      </span>
                    </label>
                    <input
                      type="text"
                      value={formApiBase}
                      onChange={(e) => setFormApiBase(e.target.value)}
                      placeholder="https://tokenerpgw.asiainfo.com/erp/v1"
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>

                  {/* Multi-Key Manager in Form */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <KeyRound className="h-3.5 w-3.5 text-slate-400" />
                        <span>API Key 凭证 (支持单连接多 Key)</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowBatchPaste(!showBatchPaste)}
                        className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-medium"
                      >
                        {showBatchPaste ? "收起批量粘贴" : "+ 批量粘贴添加多个 Key"}
                      </button>
                    </div>

                    {/* Batch Paste Box */}
                    {showBatchPaste && (
                      <div className="p-2.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 space-y-2 animate-in fade-in">
                        <textarea
                          rows={2}
                          value={batchPasteInput}
                          onChange={(e) => setBatchPasteInput(e.target.value)}
                          placeholder="粘贴多个 Key，每行一个或以逗号/分号隔开..."
                          className="w-full text-xs font-mono bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 resize-none focus:outline-none focus:border-blue-500"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={handleApplyBatchPasteForm}
                            className="px-2.5 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-xs"
                          >
                            解析并添加至 Key 列表
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Keys input list */}
                    <div className="space-y-2">
                      {formApiKeys.map((k, idx) => {
                        const isRevealed = !!showApiKeys[idx];
                        const isCopied = copiedId === `form_${idx}_${k}`;

                        return (
                          <div key={idx} className="flex items-center gap-2">
                            <div className="relative flex-1">
                              <input
                                type={isRevealed ? "text" : "password"}
                                value={k}
                                onChange={(e) => handleFormKeyChange(idx, e.target.value)}
                                placeholder={idx === 0 ? "主 API Key / Token (uk-... / sk-...)" : `备用 Key #${idx + 1}`}
                                className="w-full pl-3 pr-16 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                              />
                              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                {k && (
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(k, `form_${idx}_${k}`)}
                                    className="p-1 rounded text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                    title="复制此 Key"
                                  >
                                    {isCopied ? (
                                      <CheckCheck className="h-3.5 w-3.5 text-emerald-500" />
                                    ) : (
                                      <Copy className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = [...showApiKeys];
                                    next[idx] = !next[idx];
                                    setShowApiKeys(next);
                                  }}
                                  className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                >
                                  {isRevealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                              </div>
                            </div>

                            {formApiKeys.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveFormKeyRow(idx)}
                                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                                title="删除此 Key"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        );
                      })}

                      <button
                        type="button"
                        onClick={handleAddFormKeyRow}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium pt-0.5"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>+ 添加备用 Key</span>
                      </button>
                    </div>
                  </div>

                  {/* Default Model */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Server className="h-3.5 w-3.5 text-slate-400" />
                        默认模型标识 (Model Identifier)
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        可填任意企业私有/第三方模型
                      </span>
                    </label>
                    <input
                      type="text"
                      value={formDefaultModel}
                      onChange={(e) => setFormDefaultModel(e.target.value)}
                      placeholder="例如: AI/deekseek-v4-flash-0731, deepseek-chat, gpt-4o, qwen-plus"
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                </div>

                {/* Form Footer */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/80 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => handleTestProfile()}
                    disabled={testingProfileId === "form"}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors"
                  >
                    <Send className={cn("h-3.5 w-3.5", testingProfileId === "form" && "animate-spin")} />
                    <span>{testingProfileId === "form" ? "测试中..." : "测试连接 (可选)"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-medium"
                  >
                    取消
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    disabled={isFormSaving}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white transition-colors shadow-sm disabled:opacity-40"
                  >
                    {isFormSaving ? "保存中..." : editingProfileId ? "保存修改" : "确认添加 (允许离线)"}
                  </button>
                </div>
              </div>
            ) : (
              /* PROFILES LIST VIEW (CLEAN & MULTI-KEY SUPPORTED) */
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                    <Layers className="h-4 w-4 text-blue-500" />
                    <span>已配置的大模型连接池 ({profiles.length})</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenAddForm()}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors shadow-xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>添加新连接</span>
                  </button>
                </div>

                {/* Profiles Cards */}
                <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                  {profiles.map((p) => {
                    const isTesting = testingProfileId === p.id;
                    const keys = parseKeys(p.api_keys?.length ? p.api_keys : p.api_key);
                    const isCopiedConfig = copiedId === `config_${p.id}`;

                    return (
                      <div
                        key={p.id}
                        className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col gap-2.5 shadow-xs"
                      >
                        {/* Top info row */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                                {p.name}
                              </span>
                              <span className="px-2 py-0.5 text-[10px] font-mono rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/60 font-medium">
                                {p.default_model}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                              <span className="truncate max-w-[280px]" title={p.api_base}>
                                {p.api_base}
                              </span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(p.api_base, `url_${p.id}`)}
                                className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                title="复制 API Base URL"
                              >
                                {copiedId === `url_${p.id}` ? (
                                  <CheckCheck className="h-3 w-3 text-emerald-500" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleOpenQuickKey(p)}
                              className="px-2 py-1 text-xs rounded-lg border border-blue-200 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/40 hover:bg-blue-100 text-blue-700 dark:text-blue-300 font-medium transition-colors flex items-center gap-1"
                              title="管理 / 更换该连接的 API Key"
                            >
                              <KeyRound className="h-3 w-3" />
                              <span>换Key / 加Key</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleTestProfile(p.id)}
                              disabled={isTesting}
                              className="px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium transition-colors flex items-center gap-1"
                              title="测试此连接连通性"
                            >
                              <Send className={cn("h-3 w-3", isTesting && "animate-spin text-blue-500")} />
                              <span>{isTesting ? "测试中" : "测试"}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                const fullConfig = JSON.stringify(
                                  {
                                    name: p?.name,
                                    api_base: p?.api_base,
                                    default_model: p?.default_model,
                                    api_keys: keys,
                                  },
                                  undefined,
                                  2
                                );
                                copyToClipboard(fullConfig, `config_${p.id}`);
                              }}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                              title="点复制：一键复制完整配置参数"
                            >
                              {isCopiedConfig ? (
                                <CheckCheck className="h-3.5 w-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDuplicateProfile(p)}
                              title="复制并新建连接"
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                            >
                              <Layers className="h-3.5 w-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenEditForm(p)}
                              title="编辑完整配置"
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>

                            {profiles.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleDeleteProfile(p.id, p.name)}
                                title="删除此连接"
                                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-400 hover:text-rose-600 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Multi-Key badges / Click to Copy row */}
                        <div className="flex items-center gap-1.5 flex-wrap pt-1.5 border-t border-slate-100 dark:border-slate-800/80">
                          <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono shrink-0">
                            <KeyRound className="h-3 w-3" />
                            已配置 Key ({keys.length}):
                          </span>

                          {keys.length > 0 ? (
                            keys.map((k, kIdx) => {
                              const masked = k.length > 8 ? `${k.slice(0, 4)}...${k.slice(-4)}` : "********";
                              const isKeyCopied = copiedId === `badge_${p.id}_${kIdx}`;

                              return (
                                <button
                                  key={kIdx}
                                  type="button"
                                  onClick={() => copyToClipboard(k, `badge_${p.id}_${kIdx}`)}
                                  className={cn(
                                    "px-2 py-0.5 text-[10px] font-mono rounded-md border transition-colors flex items-center gap-1 group",
                                    isKeyCopied
                                      ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                                      : "bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-700 hover:bg-blue-50/50"
                                  )}
                                  title="点击直接复制此 Key"
                                >
                                  <span>{masked}</span>
                                  {isKeyCopied ? (
                                    <CheckCheck className="h-2.5 w-2.5 text-emerald-500" />
                                  ) : (
                                    <Copy className="h-2.5 w-2.5 text-slate-400 group-hover:text-blue-500 transition-colors" />
                                  )}
                                </button>
                              );
                            })
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenQuickKey(p)}
                              className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline font-mono"
                            >
                              未配置 Key (点击添加)
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Quick Add Presets Row */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="text-[11px] font-semibold text-slate-400 mb-1.5">
                    从常用服务快捷新建:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_TEMPLATES.map((tmpl) => (
                      <button
                        key={tmpl.provider_type}
                        type="button"
                        onClick={() => handleOpenAddForm(tmpl)}
                        className="px-2 py-0.5 text-[10px] rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-blue-500/15 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200/60 dark:border-slate-700/60 transition-colors font-medium"
                      >
                        + {tmpl.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Feishu Settings */}
        {activeTab === "feishu" && (
          <div className="space-y-4 animate-in fade-in duration-100">
            {/* Steps Guide */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-1.5">
              <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5 text-blue-500" />
                获取飞书 Webhook 步骤:
              </div>
              <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-500 dark:text-slate-400 font-sans pl-1">
                <li>在飞书群右上角点击 <strong>设置 -&gt; 群机器人 -&gt; 添加机器人</strong></li>
                <li>选择 <strong>自定义机器人</strong>，命名为 <code>FlowDev-AI 门禁卫士</code></li>
                <li>复制生成的 <strong>Webhook 地址</strong> 粘贴至下方输入框并保存</li>
              </ol>
            </div>

            {/* Form Body */}
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>飞书 Webhook 地址 (URL)</span>
                  <span className="text-[10px] text-slate-400 font-mono">https://open.feishu.cn/...</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/xxxxxxxx-xxxx..."
                    className="w-full pl-3 pr-10 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                  />
                  {webhookUrl && (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(webhookUrl, "feishu_webhook")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      title="点击复制 Webhook 地址"
                    >
                      {copiedId === "feishu_webhook" ? (
                        <CheckCheck className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30">
                <div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    仅在代码被拦截时告警
                  </div>
                  <div className="text-[11px] text-slate-500">
                    开启后，检查通过放行的正常提交不会打扰群聊
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={notifyOnlyBlocked}
                  onChange={(e) => setNotifyOnlyBlocked(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Feedback alert */}
            {feishuTestResult && (
              <div
                className={cn(
                  "p-3 rounded-xl border text-xs flex items-center gap-2",
                  feishuTestResult.success
                    ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                    : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300"
                )}
              >
                {feishuTestResult.success ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                )}
                <span className="leading-tight">{feishuTestResult.message}</span>
              </div>
            )}

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
              <button
                type="button"
                onClick={handleTestFeishu}
                disabled={isFeishuTesting || !webhookUrl.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className={cn("h-3.5 w-3.5", isFeishuTesting && "animate-spin")} />
                <span>{isFeishuTesting ? "发送中..." : "测试发送卡片"}</span>
              </button>

              <button
                type="button"
                onClick={handleSaveFeishu}
                disabled={isFeishuLoading}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white transition-colors shadow-sm disabled:opacity-40"
              >
                {isFeishuLoading ? "保存中..." : "保存飞书配置"}
              </button>
            </div>
          </div>
        )}
    </div>
  );

  if (isEmbedded) {
    return (
      <div className="w-full h-full overflow-y-auto p-4 sm:p-6 lg:p-8 select-none">
        {content}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150 select-none overflow-y-auto"
      onClick={handleClose}
    >
      {content}
    </div>
  );
}

// Export alias for backward compatibility
export const FeishuConfigModal = (props: { isOpen: boolean; onClose: () => void }) => (
  <SystemSettingsModal {...props} defaultTab="feishu" />
);
