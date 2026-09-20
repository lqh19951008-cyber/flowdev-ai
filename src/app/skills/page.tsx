"use client";

import React, { useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SkillsGovernanceView } from "@/components/skills/SkillsGovernanceView";
import { useFlowStore } from "@/stores/useFlowStore";

function SkillsPageContent() {
  const searchParams = useSearchParams();
  const setSelectedProjectId = useFlowStore((s) => s?.setSelectedProjectId);
  const setActiveViewMode = useFlowStore((s) => s?.setActiveViewMode);

  useEffect(() => {
    setActiveViewMode?.("skills");
    const rawProject = searchParams?.get("project")?.trim() ?? "";
    const isProjectValid = /^[a-zA-Z0-9_-]{1,64}$/.test(rawProject);
    if (isProjectValid) {
      setSelectedProjectId?.(rawProject);
    }
  }, [searchParams, setSelectedProjectId, setActiveViewMode]);

  return <SkillsGovernanceView />;
}

export default function SkillsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs text-slate-400">
          正在加载 AI 智能体 Skill 资产治理中心...
        </div>
      }
    >
      <SkillsPageContent />
    </Suspense>
  );
}
