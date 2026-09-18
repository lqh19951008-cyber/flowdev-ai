"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { QualityDashboardView } from "@/components/dashboard/QualityDashboardView";
import { useFlowStore } from "@/stores/useFlowStore";

export default function SettingsPage() {
  const router = useRouter();
  const setSettingsModalOpen = useFlowStore((s) => s?.setSettingsModalOpen);
  const setActiveViewMode = useFlowStore((s) => s?.setActiveViewMode);

  useEffect(() => {
    setActiveViewMode?.("dashboard");
    setSettingsModalOpen?.(true, "llm");
    router?.replace?.("/dashboard");
  }, [router, setSettingsModalOpen, setActiveViewMode]);

  return <QualityDashboardView />;
}
