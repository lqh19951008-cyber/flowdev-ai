"use client";

import React, { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import {
  LucideIcon,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Clock,
  Terminal,
} from "lucide-react";
import { NodeExecutionStatus } from "@/types/flow";
import { cn } from "@/lib/utils";
import { useFlowStore } from "@/stores/useFlowStore";

interface BaseNodeCardProps {
  id?: string;
  selected?: boolean;
  title: string;
  typeBadge: string;
  status: NodeExecutionStatus;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  hasTargetHandle?: boolean;
  hasSourceHandle?: boolean;
  targetHandleId?: string;
  sourceHandleId?: string;
  children?: React.ReactNode;
}

const statusConfig: Record<
  NodeExecutionStatus,
  {
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bg: string;
    border: string;
    label: string;
    spin: boolean;
  }
> = {
  idle: {
    icon: Clock,
    color: "text-slate-500 dark:text-slate-400",
    bg: "bg-slate-100 dark:bg-slate-500/10",
    border: "border-slate-200 dark:border-slate-600/30",
    label: "就绪",
    spin: false,
  },
  running: {
    icon: Loader2,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-500/15",
    border: "border-blue-200 dark:border-blue-500/40",
    label: "运行中",
    spin: true,
  },
  completed: {
    icon: CheckCircle2,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-500/15",
    border: "border-emerald-200 dark:border-emerald-500/40",
    label: "已完成",
    spin: false,
  },
  error: {
    icon: AlertCircle,
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-500/15",
    border: "border-rose-200 dark:border-rose-500/40",
    label: "异常",
    spin: false,
  },
};

export const BaseNodeCard = memo(
  ({
    id,
    selected,
    title,
    typeBadge,
    status = "idle",
    icon: Icon,
    iconColor,
    iconBg,
    hasTargetHandle = true,
    hasSourceHandle = true,
    targetHandleId,
    sourceHandleId,
    children,
  }: BaseNodeCardProps) => {
    const statusInfo = statusConfig[status || "idle"] || statusConfig.idle;
    const StatusIcon = statusInfo.icon;
    const isRunning = status === "running";
    const isCompleted = status === "completed";

    // Read latest stream log for this node if available
    const nodeLogs = useFlowStore((state) => (id ? state.nodeLogs[id] : undefined));
    const latestLog = nodeLogs && nodeLogs.length > 0 ? nodeLogs[nodeLogs.length - 1] : null;

    return (
      <div
        className={cn(
          "group relative min-w-[275px] max-w-[325px] rounded-xl border p-3.5 shadow-md dark:shadow-xl backdrop-blur transition-all duration-200 select-none",
          "bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-100",
          // Running state: glowing pulsing blue border & shadow
          isRunning &&
            "border-blue-500 ring-2 ring-inset ring-blue-500/60 shadow-xl shadow-blue-500/25 animate-pulse",
          // Completed state: neat emerald border
          isCompleted &&
            "border-emerald-500/70 shadow-lg shadow-emerald-500/10",
          // Selected state
          selected && !isRunning &&
            "border-blue-500 ring-2 ring-inset ring-blue-500/40 shadow-blue-500/15",
          // Default idle state
          !selected && !isRunning && !isCompleted &&
            "border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-lg"
        )}
      >
        {/* Left Target Handle */}
        {hasTargetHandle && (
          <Handle
            type="target"
            position={Position.Left}
            id={targetHandleId}
            className="!h-3.5 !w-3.5 !-left-2 !rounded-full !border-2 !border-white dark:!border-slate-950 !bg-blue-500 transition-all hover:!scale-125 hover:!bg-blue-400 cursor-crosshair"
          />
        )}

        {/* Card Header */}
        <div className="flex items-center justify-between gap-2.5 mb-2.5">
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg border shrink-0",
                iconBg
              )}
            >
              <Icon className={cn("h-4 w-4", iconColor)} />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 tracking-tight leading-snug">
                {title}
              </h4>
              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                {typeBadge}
              </span>
            </div>
          </div>

          {/* Status Indicator Badge */}
          <div
            className={cn(
              "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border shrink-0 transition-colors",
              statusInfo.bg,
              statusInfo.border,
              statusInfo.color
            )}
          >
            <StatusIcon
              className={cn("h-3 w-3", statusInfo.spin && "animate-spin")}
            />
            <span>{statusInfo.label}</span>
          </div>
        </div>

        {/* Card Body / Summary */}
        <div className="space-y-2">{children}</div>

        {/* Live Streaming Log Ticker (visible when running or has logs) */}
        {latestLog && (
          <div className="mt-2.5 pt-2 border-t border-slate-200/80 dark:border-slate-800/80 flex items-start gap-1.5 text-[10px] font-mono text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/40 px-2 py-1 rounded">
            <Terminal
              className={cn(
                "h-3 w-3 mt-0.5 shrink-0",
                isRunning ? "text-blue-500 animate-spin" : "text-emerald-500 dark:text-emerald-400"
              )}
            />
            <span className="truncate leading-tight text-slate-700 dark:text-slate-300">
              {latestLog}
            </span>
          </div>
        )}

        {/* Right Source Handle */}
        {hasSourceHandle && (
          <Handle
            type="source"
            position={Position.Right}
            id={sourceHandleId}
            className="!h-3.5 !w-3.5 !-right-2 !rounded-full !border-2 !border-white dark:!border-slate-950 !bg-indigo-500 transition-all hover:!scale-125 hover:!bg-indigo-400 cursor-crosshair"
          />
        )}
      </div>
    );
  }
);

BaseNodeCard.displayName = "BaseNodeCard";
