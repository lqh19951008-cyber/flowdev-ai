import { Node, Edge } from "@xyflow/react";
export type { Edge, Node };

export type ActiveViewMode = "dashboard" | "pipeline" | "skills";

export type FlowNodeType =
  | "code_input"
  | "llm_review"
  | "test_generator"
  | "diff_export";

export type NodeExecutionStatus = "idle" | "running" | "completed" | "error";

// --- Specialized Configurations for the 4 Policy Pipeline Nodes ---

export interface CodeInputConfig {
  sourceType: "snippet" | "git";
  language: "typescript" | "javascript" | "python" | "go" | "java";
  sampleCode?: string;
  gitUrl?: string;
  gitBranch?: string;
  // Enterprise Policy Fields
  filePatterns?: string[];
  ignoredDirs?: string[];
  triggerEvent?: "pre-commit" | "pre-push" | "pull-request";
  maxFileSizeKb?: number;
}

export interface LLMReviewConfig {
  model: "deepseek-v3" | "qwen-2.5-coder" | "deepseek-r1" | "AI/deekseek-v4-flash-0731" | string;
  temperature: number;
  promptTemplate: string;
  reviewAspects: string[];
  // Enterprise Policy Fields
  severityLevel?: "strict" | "standard" | "relaxed";
  blockNullDeref?: boolean;
  blockSqlInjection?: boolean;
  blockHardcodedSecrets?: boolean;
  blockDangerousEval?: boolean;
}

export interface TestGeneratorConfig {
  framework: "jest" | "vitest" | "pytest" | "unittest" | string;
  targetCoverage: number;
  mockMode: boolean;
  promptTemplate?: string;
  // Enterprise Policy Fields
  enforceTests?: boolean;
  sandboxTimeoutSec?: number;
  selfCorrectionRetries?: number;
}

export interface DiffExportConfig {
  exportFormat: "unified_diff" | "git_patch" | "json_report";
  outputPath: string;
  autoApply: boolean;
  // Enterprise Policy Fields
  failureAction?: "block_commit" | "warn_only" | "create_review_pr";
  notifyChannel?: "none" | "feishu" | "dingtalk" | "slack";
  exportReport?: boolean;
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

// --- Multi-Tenancy & Live Audit Types ---

export interface ProjectItem {
  id: string;
  name: string;
  description: string;
  policy: Record<string, unknown>;
  gate_enabled?: boolean;
  failure_action?: "block_commit" | "warn_only" | "disabled" | string;
  total_scans: number;
  passed_scans: number;
  pass_rate: number;
  last_scan_at: string | null;
}

export interface ScanEventItem {
  id: string;
  project_id: string;
  committer: string;
  branch: string;
  commit_hash?: string;
  passed: boolean;
  critical_issues: string[];
  suggestions: string[];
  summary: string;
  files_count: number;
  files?: Array<{
    filename: string;
    language: string;
    length: number;
    preview: string;
  }>;
  created_at: string;
  timestamp?: string;
  filename?: string;
  is_read?: boolean;
}

export interface CustomGateRule {
  title: string;
  pattern: string;
  message: string;
  level: "critical" | "warning";
}

export interface AgentSkillItem {
  id?: string;
  title: string;
  summary: string;
  markdown?: string;
  skill_markdown?: string;
  category?: string;
  scope?: "frontend" | "backend" | "security" | "general" | string;
  file_globs?: string[];
  check_type?: "ai_guideline" | "static_regex" | string;
  status?: "active" | "warning" | "deprecated" | string;
}

export interface SynthesizedRule {
  title: string;
  category: "stability" | "security" | "performance" | "architecture" | string;
  scope?: "frontend" | "backend" | "security" | "general" | string;
  file_globs?: string[];
  check_type?: "ai_guideline" | "static_regex" | string;
  severity: "critical" | "warning" | string;
  summary: string;
  bad_snippet: string;
  good_snippet: string;
  skill_markdown: string;
  gate_rule: CustomGateRule;
  // Batch aggregate metadata (optional, only present for /api/rules/synthesize with events[])
  source_events?: number;
  source_files?: string[];
  common_root_cause?: string;
  skill_markdown_antigravity?: string;
}

// --- Committer / All-Team Audit Leaderboard Types ---
// Feeds the "全员提交拦截与审计流水" dashboard panel.

export interface CommitterTopProject {
  project_id: string;
  count: number;
}

export interface CommitterTopFile {
  file: string;
  count: number;
}

export interface CommitterStat {
  committer: string;
  total_commits: number;
  blocked_commits: number;
  passed_commits: number;
  pass_rate: number;
  block_rate: number;
  first_seen: string | null;
  last_seen: string | null;
  last_blocked_at: string | null;
  risk_score: number;
  top_projects: CommitterTopProject[];
  top_files: CommitterTopFile[];
}

// --- AI Chat Skill Generator (audit -> skill -> push) ---

export interface AuditChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  at: number;
}

export interface AuditDispatchApplyResult {
  project_id: string;
  ok: boolean;
  error?: string;
  pushed?: boolean;
  skill_id?: string;
}

export interface AuditDispatchPushState {
  project_id: string;
  policy_version: string | null;
  pending_push_version: string | null;
  push_enabled: boolean;
  pending: boolean;
  last_pushed_at: string | null;
}

export interface AuditDispatchResponse {
  success: boolean;
  rule: SynthesizedRule;
  applied: number;
  results: AuditDispatchApplyResult[];
  push_states: AuditDispatchPushState[];
  audit_summary: {
    rule_title: string;
    category: string;
    source_events: number;
    committers_distinct: number;
    projects_targeted: number;
    all_pushed: boolean;
  };
}
