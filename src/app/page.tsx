"use client";

import { useEffect } from "react";
import { QualityDashboardView } from "@/components/dashboard/QualityDashboardView";
import { useFlowStore } from "@/stores/useFlowStore";

export default function Home() {
  const setActiveViewMode = useFlowStore((s) => s.setActiveViewMode);

  useEffect(() => {
    setActiveViewMode?.("dashboard");
  }, [setActiveViewMode]);

  return <QualityDashboardView />;
}
