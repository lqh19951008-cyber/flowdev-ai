"use client";

import React, { useEffect, useState, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useFlowStore } from "@/stores/useFlowStore";
import { QualityDashboardView } from "@/components/dashboard/QualityDashboardView";
import { PipelineContentView } from "@/components/pipeline/PipelineContentView";
import { SkillsGovernanceView } from "@/components/skills/SkillsGovernanceView";
import { ActiveViewMode } from "@/types/flow";
import { cn } from "@/lib/utils";

interface WorkspaceContainerProps {
  showMiniMap?: boolean;
}

function WorkspaceRouteSync() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const setActiveViewMode = useFlowStore((s) => s?.setActiveViewMode);
  const setSelectedProjectId = useFlowStore((s) => s?.setSelectedProjectId);
  const locateEvent = useFlowStore((s) => s?.locateEvent);

  // Sync route URL with store active view
  useEffect(() => {
    const rawPath = pathname ?? "";
    if (rawPath.startsWith("/pipeline")) {
      setActiveViewMode?.("pipeline");
    } else if (rawPath.startsWith("/skills")) {
      setActiveViewMode?.("skills");
    } else if (rawPath === "/" || rawPath === "/dashboard" || rawPath.startsWith("/dashboard")) {
      setActiveViewMode?.("dashboard");
    }
  }, [pathname, setActiveViewMode]);

  // Sync URL project query param
  useEffect(() => {
    const rawProject = searchParams?.get("project")?.trim() ?? "";
    if (rawProject && /^[a-zA-Z0-9_-]{1,64}$/.test(rawProject)) {
      setSelectedProjectId?.(rawProject);
    }
    const rawEvent =
      searchParams?.get("eventId") ||
      searchParams?.get("event_id") ||
      searchParams?.get("event");
    const eventParam = rawEvent?.trim() ?? "";
    if (eventParam && /^[a-zA-Z0-9_.-]{1,64}$/.test(eventParam)) {
      locateEvent?.(eventParam);
    }
  }, [searchParams, setSelectedProjectId, locateEvent]);

  // Listen for browser Back/Forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const path = window?.location?.pathname ?? "/";
      if (path.startsWith("/pipeline")) {
        setActiveViewMode?.("pipeline");
      } else if (path.startsWith("/skills")) {
        setActiveViewMode?.("skills");
      } else {
        setActiveViewMode?.("dashboard");
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [setActiveViewMode]);

  return null;
}

export function WorkspaceContainer({ showMiniMap = true }: WorkspaceContainerProps) {
  const activeViewMode = useFlowStore((s) => s?.activeViewMode ?? "dashboard");

  // Keep-Alive tab state: lazily mount each tab on first access, then keep alive
  const [mountedTabs, setMountedTabs] = useState<Set<ActiveViewMode>>(() => new Set([activeViewMode]));

  // When activeViewMode changes, ensure it's registered in mountedTabs
  useEffect(() => {
    setMountedTabs((prev) => {
      if (prev.has(activeViewMode)) return prev;
      const next = new Set(prev);
      next.add(activeViewMode);
      return next;
    });
  }, [activeViewMode]);

  // Trigger resize event when switching to pipeline so ReactFlow measures canvas viewport correctly
  useEffect(() => {
    if (activeViewMode === "pipeline") {
      const raf = requestAnimationFrame(() => {
        window.dispatchEvent(new Event("resize"));
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [activeViewMode]);

  return (
    <div className="w-full h-full relative overflow-hidden">
      <Suspense fallback={null}>
        <WorkspaceRouteSync />
      </Suspense>

      {/* Tab 1: 质量大门 (Dashboard) */}
      {mountedTabs.has("dashboard") && (
        <div
          className={cn(
            "h-full w-full",
            activeViewMode === "dashboard" ? "block" : "hidden"
          )}
          aria-hidden={activeViewMode !== "dashboard"}
        >
          <QualityDashboardView />
        </div>
      )}

      {/* Tab 2: 门禁编排 (Pipeline DAG Editor) */}
      {mountedTabs.has("pipeline") && (
        <div
          className={cn(
            "h-full w-full",
            activeViewMode === "pipeline" ? "block" : "hidden"
          )}
          aria-hidden={activeViewMode !== "pipeline"}
        >
          <PipelineContentView showMiniMap={showMiniMap} />
        </div>
      )}

      {/* Tab 3: Skill 资产库 (Skills Governance) */}
      {mountedTabs.has("skills") && (
        <div
          className={cn(
            "h-full w-full",
            activeViewMode === "skills" ? "block" : "hidden"
          )}
          aria-hidden={activeViewMode !== "skills"}
        >
          <SkillsGovernanceView />
        </div>
      )}
    </div>
  );
}
