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
  HelpCircle,
} from "lucide-react";
import { Chip } from "@heroui/react";
import { cn } from "@/lib/utils";

interface SystemSettingsModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  defaultTab?: "llm" | "feishu";
}

import { useFlowStore } from "@/stores/useFlowStore";

export function SystemSettingsModal({
  isOpen,
  onClose,
  defaultTab,
}: SystemSettingsModalProps) {
  const storeIsOpen = useFlowStore((s) => s.isSettingsModalOpen);
  const storeTab = useFlowStore((s) => s.settingsModalTab);
  const setSettingsModalOpen = useFlowStore((s) => s.setSettingsModalOpen);

  const effectiveIsOpen = isOpen !== undefined ? isOpen : storeIsOpen;
  const handleClose = onClose || (() => setSettingsModalOpen(false));
  const effectiveDefaultTab = defaultTab || storeTab || "llm";

  const [activeTab, setActiveTab] = useState<"llm" | "feishu">(effectiveDefaultTab);

  // LLM state
  const [apiBase, setApiBase] = useState("https://api.openai.com/v1");
  const [apiKey, setApiKey] = useState("");
  const [defaultModel, setDefaultModel] = useState("deepseek-chat");
  const [showApiKey, setShowApiKey] = useState(false);
  const [isLlmConfigured, setIsLlmConfigured] = useState(false);
  const [maskedKey, setMaskedKey] = useState("");
  const [isLlmLoading, setIsLlmLoading] = useState(false);
  const [isLlmTesting, setIsLlmTesting] = useState(false);
  const [llmTestResult, setLlmTestResult] = useState<{
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
      fetchLlmStatus();
      fetchFeishuStatus();
      setLlmTestResult(null);
      setFeishuTestResult(null);
    }
  }, [effectiveIsOpen, effectiveDefaultTab]);


  const fetchLlmStatus = async () => {
    try {
      setIsLlmLoading(true);
      const res = await fetch("http://127.0.0.1:8000/api/llm/status");
      if (res.ok) {
        const data = await res.json();
        setApiBase(data.api_base || "https://api.openai.com/v1");
        setDefaultModel(data.default_model || "deepseek-chat");
        setIsLlmConfigured(data.configured ?? false);
        setMaskedKey(data.masked_key || "");
        setApiKey(data.masked_key || "");
      }
    } catch (e) {
      console.warn("Failed to fetch LLM status", e);
    } finally {
      setIsLlmLoading(false);
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

  const handleSaveLlm = async () => {
    try {
      setIsLlmLoading(true);
      setLlmTestResult(null);
      const res = await fetch("http://127.0.0.1:8000/api/llm/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_base: apiBase.trim(),
          api_key: apiKey.trim(),
          default_model: defaultModel.trim(),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setIsLlmConfigured(data.configured);
        setMaskedKey(data.masked_key);
        setApiKey(data.masked_key);
        setLlmTestResult({ success: true, message: "大模型 API 配置已成功保存生效！" });
      } else {
        setLlmTestResult({ success: false, message: "保存失败: 状态码异常" });
      }
    } catch (e) {
      setLlmTestResult({ success: false, message: "保存失败: 网络异常" });
    } finally {
      setIsLlmLoading(false);
    }
  };

  const handleTestLlm = async () => {
    try {
      setIsLlmTesting(true);
      setLlmTestResult(null);
      const res = await fetch("http://127.0.0.1:8000/api/llm/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_base: apiBase.trim(),
          api_key: apiKey.trim(),
          model: defaultModel.trim(),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setLlmTestResult(data);
      } else {
        setLlmTestResult({ success: false, message: `请求失败 (${res.status})` });
      }
    } catch (e) {
      setLlmTestResult({ success: false, message: "连通性测试失败: 无法连接至后端服务" });
    } finally {
      setIsLlmTesting(false);
    }
  };

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

  if (!effectiveIsOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150 select-none overflow-y-auto"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-6 flex flex-col space-y-5 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <SlidersHorizontal className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  系统与集成配置
                </h3>
                <span className="text-[11px] font-mono text-slate-400">
                  User Config
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                自定义配置 AI 大模型 API Key、基准 Base URL 与飞书告警 Webhook
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>


        {/* Tab Navigation */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-950/80 p-1 rounded-xl border border-slate-200/80 dark:border-slate-800">
          <button
            onClick={() => setActiveTab("llm")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all",
              activeTab === "llm"
                ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>AI 大模型配置 (LLM API)</span>
            {isLlmConfigured ? (
              <span className="h-2 w-2 rounded-full bg-emerald-500" title="已连接 API Key" />
            ) : (
              <span className="h-2 w-2 rounded-full bg-amber-500" title="自适应仿真模式" />
            )}
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

        {/* TAB 1: LLM Settings */}
        {activeTab === "llm" && (
          <div className="space-y-4 animate-in fade-in duration-100">
            <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 text-xs text-slate-700 dark:text-slate-300 space-y-1.5">
              <div className="font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5" />
                全面支持企业内网中转、第三方代理与各厂商公网 API
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                无论是 <strong>公司内部自建网关</strong>、<strong>第三方代理服务</strong>，还是 <strong>DeepSeek / OpenAI / 阿里通义 / 硅基流动</strong>，只要符合标准 OpenAI ChatCompletions 协议均可无缝接入。支持自定义 Base URL、企业 Token（如 <code>uk-...</code>、<code>Bearer ...</code>）及私有模型标识。
              </p>
            </div>

            {/* Quick Presets Bar */}
            <div className="space-y-1">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                快捷填充模版：
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setApiBase("https://tokenerpgw.asiainfo.com/erp/v1");
                    setDefaultModel("AI/deekseek-v4-flash-0731");
                  }}
                  className="px-2 py-1 text-[10px] rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-500/15 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200 dark:border-slate-700 transition-colors font-medium"
                >
                  🏢 亚信企业网关
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setApiBase("https://api.deepseek.com/v1");
                    setDefaultModel("deepseek-chat");
                  }}
                  className="px-2 py-1 text-[10px] rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-500/15 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200 dark:border-slate-700 transition-colors font-medium"
                >
                  ⚡ DeepSeek 官方
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setApiBase("https://api.openai.com/v1");
                    setDefaultModel("gpt-4o");
                  }}
                  className="px-2 py-1 text-[10px] rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-500/15 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200 dark:border-slate-700 transition-colors font-medium"
                >
                  🌐 OpenAI 官方
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setApiBase("https://dashscope.aliyuncs.com/compatible-mode/v1");
                    setDefaultModel("qwen-plus");
                  }}
                  className="px-2 py-1 text-[10px] rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-500/15 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200 dark:border-slate-700 transition-colors font-medium"
                >
                  ☁️ 阿里通义千问
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setApiBase("https://api.siliconflow.cn/v1");
                    setDefaultModel("deepseek-ai/DeepSeek-V3");
                  }}
                  className="px-2 py-1 text-[10px] rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-500/15 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200 dark:border-slate-700 transition-colors font-medium"
                >
                  🚀 硅基流动
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {/* API Base */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Globe className="h-3.5 w-3.5 text-slate-400" />
                    API Base URL (接口基准地址)
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    支持任意企业内网或第三方 URL
                  </span>
                </label>
                <input
                  type="text"
                  value={apiBase}
                  onChange={(e) => setApiBase(e.target.value)}
                  placeholder="https://your-company-gateway.com/v1"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              {/* API Key */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <KeyRound className="h-3.5 w-3.5 text-slate-400" />
                    API Key / Token (认证凭证)
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {isLlmConfigured ? "已加密存储在本地 .env" : "支持 uk-... / sk-... / 自定义Token"}
                  </span>
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="输入您的企业 API Token 或 sk-..."
                    className="w-full pl-3 pr-10 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showApiKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
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
                    可输入任意第三方/企业私有模型名称
                  </span>
                </label>
                <input
                  type="text"
                  value={defaultModel}
                  onChange={(e) => setDefaultModel(e.target.value)}
                  placeholder="例如: AI/deekseek-v4-flash-0731, deepseek-chat, gpt-4o 等"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </div>


            {/* Test result feedback */}
            {llmTestResult && (
              <div
                className={cn(
                  "p-3 rounded-xl border text-xs flex items-center gap-2",
                  llmTestResult.success
                    ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                    : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300"
                )}
              >
                {llmTestResult.success ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                )}
                <span className="leading-tight">{llmTestResult.message}</span>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
              <button
                type="button"
                onClick={handleTestLlm}
                disabled={isLlmTesting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors disabled:opacity-40"
              >
                <Send className={cn("h-3.5 w-3.5", isLlmTesting && "animate-spin")} />
                <span>{isLlmTesting ? "测试中..." : "测试模型连接"}</span>
              </button>

              <button
                type="button"
                onClick={handleSaveLlm}
                disabled={isLlmLoading}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white transition-colors shadow-sm disabled:opacity-40"
              >
                {isLlmLoading ? "保存中..." : "保存大模型配置"}
              </button>
            </div>
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
                <input
                  type="text"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/xxxxxxxx-xxxx..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                />
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
    </div>
  );
}

// Export alias for backward compatibility
export const FeishuConfigModal = (props: { isOpen: boolean; onClose: () => void }) => (
  <SystemSettingsModal {...props} defaultTab="feishu" />
);

