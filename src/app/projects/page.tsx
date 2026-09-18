"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { QualityDashboardView } from "@/components/dashboard/QualityDashboardView";
import { useFlowStore } from "@/stores/useFlowStore";

export default function ProjectsPage() {
  const router = useRouter();
  const setActiveViewMode = useFlowStore((s) => s?.setActiveViewMode);

  useEffect(() => {
    setActiveViewMode?.("dashboard");
    router?.replace?.("/dashboard");
  }, [router, setActiveViewMode]);

  return <QualityDashboardView />;
}
