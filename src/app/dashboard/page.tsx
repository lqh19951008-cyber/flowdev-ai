"use client";

import React, { useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { QualityDashboardView } from "@/components/dashboard/QualityDashboardView";
import { useFlowStore } from "@/stores/useFlowStore";

function DashboardContent() {
  const searchParams = useSearchParams();
  const setSelectedProjectId = useFlowStore((s) => s?.setSelectedProjectId);
  const setActiveViewMode = useFlowStore((s) => s?.setActiveViewMode);
  const locateEvent = useFlowStore((s) => s?.locateEvent);

  useEffect(() => {
    setActiveViewMode?.("dashboard");
    const projectParam = searchParams?.get("project");
    if (projectParam) {
      setSelectedProjectId?.(projectParam);
    }
    const eventParam =
      searchParams?.get("eventId") ||
      searchParams?.get("event_id") ||
      searchParams?.get("event");
    if (eventParam) {
      locateEvent?.(eventParam);
    }
  }, [searchParams, setSelectedProjectId, setActiveViewMode, locateEvent]);

  return <QualityDashboardView />;
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">正在加载质量大盘...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
