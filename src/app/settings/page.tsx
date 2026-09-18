"use client";

import React, { Suspense } from "react";
import { SystemSettingsView } from "@/components/settings/SystemSettingsView";

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">正在加载系统设置...</div>}>
      <SystemSettingsView />
    </Suspense>
  );
}
