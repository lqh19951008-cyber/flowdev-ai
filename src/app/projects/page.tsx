"use client";

import React, { Suspense } from "react";
import { ProjectsGovernanceView } from "@/components/projects/ProjectsGovernanceView";

export default function ProjectsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">正在加载项目治理中心...</div>}>
      <ProjectsGovernanceView />
    </Suspense>
  );
}
