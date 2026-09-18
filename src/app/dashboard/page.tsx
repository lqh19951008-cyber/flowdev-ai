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
    const rawProject = searchParams?.get("project")?.trim() ?? "";
    const isProjectValid = /^[a-zA-Z0-9_-]{1,64}$/.test(rawProject);
    if (isProjectValid) {
      setSelectedProjectId?.(rawProject);
    } else {
      setSelectedProjectId?.("all");
    }
    const rawEvent =
      searchParams?.get("eventId") ||
      searchParams?.get("event_id") ||
      searchParams?.get("event");
    const eventParam = rawEvent?.trim() ?? "";
    if (eventParam && /^[a-zA-Z0-9_.-]{1,64}$/.test(eventParam)) {
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
