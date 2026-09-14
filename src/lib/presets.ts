import { PresetId, WorkflowPreset } from "@/types/flow";
import { createDefaultNodeData } from "@/stores/useFlowStore";

export const WORKFLOW_PRESETS: WorkflowPreset[] = [
  {
    id: "full_review_heal",
    name: "完整审查与自愈闭环",
    description: "代码输入 → LLM 审查 + 单测生成与沙箱验证 → 差异导出",
    nodes: [
      {
        id: "node-input",
        type: "code_input",
        position: { x: 80, y: 180 },
        data: createDefaultNodeData("code_input"),
      },
      {
        id: "node-review",
        type: "llm_review",
        position: { x: 440, y: 100 },
        data: createDefaultNodeData("llm_review"),
      },
      {
        id: "node-test",
        type: "test_generator",
        position: { x: 440, y: 280 },
        data: createDefaultNodeData("test_generator"),
      },
      {
        id: "node-export",
        type: "diff_export",
        position: { x: 820, y: 180 },
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
    name: "极速单测生成流",
    description: "代码输入 → 单测生成 Agent，快速生成全覆盖用例",
    nodes: [
      {
        id: "node-input",
        type: "code_input",
        position: { x: 120, y: 200 },
        data: createDefaultNodeData("code_input"),
      },
      {
        id: "node-test",
        type: "test_generator",
        position: { x: 520, y: 200 },
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
    name: "纯代码安全审计流",
    description: "代码输入 → 漏洞深度审查，专项排查高危隐患",
    nodes: [
      {
        id: "node-input",
        type: "code_input",
        position: { x: 120, y: 200 },
        data: createDefaultNodeData("code_input"),
      },
      {
        id: "node-review",
        type: "llm_review",
        position: { x: 520, y: 200 },
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
