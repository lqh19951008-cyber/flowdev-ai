"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  ShieldCheck,
  X,
  ExternalLink,
  GitBranch,
  User,
  Clock,
  Radio,
  FileCode,
  CheckCheck,
  Target,
} from "lucide-react";
import { useFlowStore } from "@/stores/useFlowStore";
import { ScanEventItem } from "@/types/flow";
import { cn, formatTime, formatRelativeTime } from "@/lib/utils";

export function LiveGuardFeed() {
  const {
    addLiveEvent,
    recentEvents,
    readEventIds,
    markEventAsRead,
    markAllEventsAsRead,
    unreadEventsCount,
    clearUnreadEventsCount,
    isLiveFeedOpen,
    setLiveFeedOpen,
    setSelectedProjectId,
    setActiveViewMode,
    locateEvent,
  } = useFlowStore();

  const [activeToast, setActiveToast] = useState<ScanEventItem | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // SSE Listener for real-time audit scan events
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let retryTimeout: NodeJS.Timeout | null = null;

    function connectSSE() {
      try {
        eventSource = new EventSource("http://127.0.0.1:8000/api/events/stream");

        eventSource.onopen = () => {
          setIsConnected(true);
        };

        eventSource.addEventListener("connected", () => {
          setIsConnected(true);
        });

        eventSource.addEventListener("scan_completed", (e: MessageEvent) => {
          try {
            const data: ScanEventItem = JSON.parse(e.data);
            addLiveEvent(data);

            // Trigger floating live toast
            setActiveToast(data);
            setToastVisible(true);
          } catch (err) {
            console.error("Failed to parse SSE scan event", err);
          }
        });

        eventSource.onerror = () => {
          setIsConnected(false);
          eventSource?.close();
          retryTimeout = setTimeout(connectSSE, 5000);
        };
      } catch (err) {
        setIsConnected(false);
        retryTimeout = setTimeout(connectSSE, 5000);
      }
    }

    connectSSE();

    return () => {
      eventSource?.close();
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [addLiveEvent]);

  // Auto-hide toast after 8 seconds
  useEffect(() => {
    if (toastVisible && activeToast) {
      const timer = setTimeout(() => {
        setToastVisible(false);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [toastVisible, activeToast]);

  return (
    <>
      {/* Real-time Floating Toast for Incoming Git Commit */}
      {toastVisible && activeToast && (
        <div className="fixed top-16 right-5 z-50 max-w-md w-full animate-in slide-in-from-top-4 fade-in duration-200">
          <div
            className={cn(
              "rounded-xl border p-4 shadow-2xl backdrop-blur-md transition-all",
              activeToast.passed
                ? "bg-white/95 dark:bg-slate-950/95 border-emerald-500/40 shadow-emerald-500/10"
                : "bg-white/95 dark:bg-slate-950/95 border-rose-500/50 shadow-rose-500/20"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    "p-2 rounded-lg",
                    activeToast.passed
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-rose-500/15 text-rose-600 dark:text-rose-400 animate-pulse"
                  )}
                >
                  {activeToast.passed ? (
                    <ShieldCheck className="h-5 w-5" />
                  ) : (
                    <ShieldAlert className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                      {activeToast.passed ? "门禁检查通过放行" : "代码门禁拦截提交！"}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-cyan-300 font-mono font-medium">
                      {activeToast.project_id}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                    {activeToast.summary}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setToastVisible(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Committer and branch details */}
            <div className="mt-3 flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 font-mono border-t border-slate-100 dark:border-slate-800/80 pt-2">
              <span className="flex items-center gap-1">
                <User className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                {activeToast.committer}
              </span>
              <span className="flex items-center gap-1">
                <GitBranch className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                {activeToast.branch}
              </span>
              <button
                onClick={() => {
                  setToastVisible(false);
                  if (activeToast?.id) {
                    locateEvent(activeToast.id);
                  }
                }}
                className="ml-auto text-blue-600 dark:text-cyan-400 hover:text-blue-700 dark:hover:text-cyan-300 flex items-center gap-1 font-sans font-medium"
                title="定位到该条提交审计消息"
              >
                <Target className="h-3.5 w-3.5 animate-pulse" />
                <span>定位消息</span>
                <ExternalLink className="h-3 w-3" />
              </button>
            </div>

            {/* Defects preview if failed */}
            {!activeToast.passed && activeToast.critical_issues.length > 0 && (
              <div className="mt-2.5 p-2 rounded bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-[11px] text-rose-700 dark:text-rose-300 space-y-1">
                <div className="font-semibold text-rose-800 dark:text-rose-200">
                  发现 {activeToast.critical_issues.length} 项致命阻断缺陷:
                </div>
                {activeToast.critical_issues.slice(0, 2).map((issue, idx) => (
                  <div key={idx} className="line-clamp-1 text-slate-700 dark:text-slate-300 font-mono">
                    • {issue}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Live Feed Popover Drawer (when user clicks Notification Bell in Header) */}
      {isLiveFeedOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs"
          onClick={() => {
            setLiveFeedOpen(false);
          }}
        >
          <div
            className="absolute top-14 right-4 w-96 max-h-[80vh] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 shadow-2xl p-4 flex flex-col z-50 backdrop-blur-md"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <Radio
                    className={cn(
                      "h-4 w-4",
                      isConnected ? "text-emerald-500 animate-pulse" : "text-amber-500"
                    )}
                  />
                  <span className="font-bold text-sm text-slate-900 dark:text-slate-100">实时门禁动态</span>
                </div>
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                    isConnected
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
                      : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                  )}
                >
                  {isConnected ? "SSE 监听中" : "连接重试中"}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {unreadEventsCount > 0 && (
                  <button
                    onClick={() => markAllEventsAsRead()}
                    className="text-[11px] text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium flex items-center gap-0.5 px-1.5 py-0.5 rounded hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                    title="全部标为已读"
                  >
                    <CheckCheck className="h-3 w-3" />
                    <span>全读</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setLiveFeedOpen(false);
                  }}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Event List */}
            <div className="flex-1 overflow-y-auto space-y-2 py-2 px-1">
              {recentEvents.length === 0 ? (
                <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-xs">
                  暂无拦截事件记录。在任何接入项目中运行 git commit 将在此实时播报。
                </div>
              ) : (
                recentEvents.map((event) => {
                  const isRead = readEventIds.includes(event.id);

                  return (
                    <div
                      key={event.id}
                      onClick={() => {
                        locateEvent(event.id);
                      }}
                      className={cn(
                        "p-2.5 rounded-xl border text-xs cursor-pointer transition-colors shadow-xs relative group",
                        event.passed
                          ? "bg-slate-50/80 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:bg-slate-100/90 dark:hover:bg-slate-800/80 hover:border-emerald-500/50"
                          : "bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:border-rose-500/60",
                        !isRead && "ring-1 ring-inset ring-blue-500/40 bg-blue-50/30 dark:bg-blue-950/20"
                      )}
                      title="点击定位到该条审计详情与消息"
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "px-1.5 py-0.5 rounded text-[10px] font-semibold",
                              event.passed
                                ? "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                                : "bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400"
                            )}
                          >
                            {event.passed ? "放行" : "拦截"}
                          </span>
                          <span className="font-mono text-blue-600 dark:text-cyan-400 font-medium">
                            {event.project_id}
                          </span>

                          {!isRead && (
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse ml-0.5" />
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1 font-mono">
                          <Clock className="h-2.5 w-2.5" />
                          {formatRelativeTime(event.created_at)}
                        </span>
                      </div>

                      <p className={cn(
                        "text-slate-700 dark:text-slate-300 line-clamp-1 text-[11px] mb-1.5",
                        !isRead ? "font-medium" : "font-normal"
                      )}>
                        {event.summary}
                      </p>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                        <span>{event.committer}</span>
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1">
                            <FileCode className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                            {event.files_count} 文件
                          </span>
                          <span className="text-blue-600 dark:text-cyan-400 font-sans font-medium text-[10px] opacity-70 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                            <Target className="h-3 w-3" />
                            定位
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                最近 {recentEvents?.length ?? 0} 次审查记录
              </span>
              <Link
                href="/dashboard"
                onClick={() => {
                  setLiveFeedOpen?.(false);
                  setActiveViewMode?.("dashboard");
                }}
                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium flex items-center gap-1"
              >
                打开质量大门查看全部
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
