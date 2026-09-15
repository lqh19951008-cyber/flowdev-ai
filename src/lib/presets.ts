import { PresetId, WorkflowPreset } from "@/types/flow";
import { createDefaultNodeData } from "@/stores/useFlowStore";

export const WORKFLOW_PRESETS: WorkflowPreset[] = [
  {
    id: "full_review_heal",
    name: "企业级 pre-commit 门禁防线 (双规并联 · 推荐)",
    description: "Git 触发捕获 → 代码安全漏洞阻断 + 单测覆盖率卡点 (并联) → Exit 1 强行阻断决策",
    nodes: [
      {
        id: "node-input",
        type: "code_input",
        position: { x: 50, y: 150 },
        data: createDefaultNodeData("code_input"),
      },
      {
        id: "node-review",
        type: "llm_review",
        position: { x: 380, y: 60 },
        data: createDefaultNodeData("llm_review"),
      },
      {
        id: "node-test",
        type: "test_generator",
        position: { x: 380, y: 250 },
        data: createDefaultNodeData("test_generator"),
      },
      {
        id: "node-export",
        type: "diff_export",
        position: { x: 710, y: 150 },
        data: createDefaultNodeData("diff_export"),
      },
    ],
    edges: [
      {
        id: "e-input-review",
        source: "node-input",
        target: "node-review",
        animated: true,
        style: { stroke: "#6366f1", strokeWidth: 2 },
      },
      {
        id: "e-input-test",
        source: "node-input",
        target: "node-test",
        animated: true,
        style: { stroke: "#6366f1", strokeWidth: 2 },
      },
      {
        id: "e-review-export",
        source: "node-review",
        target: "node-export",
        style: { stroke: "#94a3b8", strokeWidth: 2 },
      },
      {
        id: "e-test-export",
        source: "node-test",
        target: "node-export",
        style: { stroke: "#94a3b8", strokeWidth: 2 },
      },
    ],
  },
  {
    id: "quick_test_gen",
    name: "自动化单测覆盖率红线流 (质量红线)",
    description: "Git 提交拦截 → 单测覆盖率校验 (≥80%) + 沙箱隔离验证 → 门禁裁决",
    nodes: [
      {
        id: "node-input",
        type: "code_input",
        position: { x: 100, y: 160 },
        data: createDefaultNodeData("code_input"),
      },
      {
        id: "node-test",
        type: "test_generator",
        position: { x: 480, y: 160 },
        data: createDefaultNodeData("test_generator"),
      },
    ],
    edges: [
      {
        id: "e-input-test",
        source: "node-input",
        target: "node-test",
        animated: true,
        style: { stroke: "#10b981", strokeWidth: 2 },
      },
    ],
  },
  {
    id: "security_audit",
    name: "致命缺陷与安全漏洞拦截流 (专项防御)",
    description: "Git 提交拦截 → DeepSeek 阻断空指针/SQL注入/明文秘钥 → 门禁拦截裁决",
    nodes: [
      {
        id: "node-input",
        type: "code_input",
        position: { x: 100, y: 160 },
        data: createDefaultNodeData("code_input"),
      },
      {
        id: "node-review",
        type: "llm_review",
        position: { x: 480, y: 160 },
        data: createDefaultNodeData("llm_review"),
      },
    ],
    edges: [
      {
        id: "e-input-review",
        source: "node-input",
        target: "node-review",
        animated: true,
        style: { stroke: "#a855f7", strokeWidth: 2 },
      },
    ],
  },
];

export function getPreset(id: PresetId): WorkflowPreset {
  const found = WORKFLOW_PRESETS.find((p) => p.id === id);
  return found || WORKFLOW_PRESETS[0];
}
