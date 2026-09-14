import { Node, Edge } from "@xyflow/react";
export type { Edge, Node };

export type FlowNodeType =
  | "code_input"
  | "llm_review"
  | "test_generator"
  | "diff_export";

export type NodeExecutionStatus = "idle" | "running" | "completed" | "error";

// --- Specialized Configurations for the 4 Nodes ---

export interface CodeInputConfig {
  sourceType: "snippet" | "git";
  language: "typescript" | "javascript" | "python" | "go" | "java";
  sampleCode?: string;
  gitUrl?: string;
  gitBranch?: string;
}

export interface LLMReviewConfig {
  model: "deepseek-v3" | "qwen-2.5-coder" | "deepseek-r1" | "AI/deekseek-v4-flash-0731" | string;
  temperature: number;
  promptTemplate: string;
  reviewAspects: string[];
}

export interface TestGeneratorConfig {
  framework: "jest" | "vitest" | "pytest" | "unittest" | string;
  targetCoverage: number;
  mockMode: boolean;
  promptTemplate?: string;
}

export interface DiffExportConfig {
  exportFormat: "unified_diff" | "git_patch" | "json_report";
  outputPath: string;
  autoApply: boolean;
}

export type AnyNodeConfig =
  | CodeInputConfig
  | LLMReviewConfig
  | TestGeneratorConfig
  | DiffExportConfig;

// --- Node Data Contract ---

export interface FlowNodeData extends Record<string, unknown> {
  label: string;
  type: FlowNodeType;
  description?: string;
  status: NodeExecutionStatus;
  config: AnyNodeConfig;
  output?: string;
}

export type CustomNode = Node<FlowNodeData, FlowNodeType>;

// --- Sidebar Palette Item ---

export interface NodePaletteItem {
  type: FlowNodeType;
  label: string;
  description: string;
  category: "input" | "agent" | "output";
  tag: string;
  iconName: string;
}

// --- Topology & LangGraph Schema ---

export interface WorkflowTopology {
  workflowId: string;
  name: string;
  version: string;
  createdAt: string;
  nodeCount: number;
  edgeCount: number;
  executionOrder: string[];
  nodes: {
    id: string;
    type: FlowNodeType;
    label: string;
    config: AnyNodeConfig;
  }[];
  edges: {
    id: string;
    source: string;
    target: string;
  }[];
  langGraphSchema: {
    entryPoints: string[];
    nodes: Record<string, { type: FlowNodeType; label: string; config: AnyNodeConfig }>;
    edges: Record<string, string[]>;
  };
}

// --- SSE Streaming Protocol ---

export type SSEEventType =
  | "workflow_started"
  | "node_status"
  | "node_log"
  | "workflow_finished"
  | "workflow_error";

export interface SSENodeStatusEvent {
  nodeId: string;
  status: NodeExecutionStatus;
  message?: string;
  step?: number;
  total?: number;
}

export interface SSENodeLogEvent {
  nodeId: string;
  log: string;
}

export interface SSEWorkflowStartedEvent {
  totalNodes: number;
  executionOrder: string[];
  message?: string;
}

export interface SSEWorkflowFinishedEvent {
  status: string;
  message: string;
  completedNodes: number;
  artifacts?: Partial<ExecutionArtifacts>;
}

// --- Milestone 5: Artifacts & Presets ---

export interface ExecutionArtifacts {
  originalCode: string;
  refactoredCode: string;
  testCode: string;
  language: string;
  diffPatch: string;
}

export type PresetId =
  | "full_review_heal"
  | "quick_test_gen"
  | "security_audit";

export interface WorkflowPreset {
  id: PresetId;
  name: string;
  description: string;
  nodes: CustomNode[];
  edges: Edge[];
}
