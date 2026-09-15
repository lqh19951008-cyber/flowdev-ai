import { create } from "zustand";
import {
  Connection,
  Edge,
  EdgeChange,
  NodeChange,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
} from "@xyflow/react";
import {
  CustomNode,
  FlowNodeData,
  FlowNodeType,
  NodeExecutionStatus,
  ExecutionArtifacts,
  PresetId,
  ProjectItem,
  ScanEventItem,
  ActiveViewMode,
} from "@/types/flow";
import { executeWorkflowStream } from "@/lib/sse";
import { getPreset } from "@/lib/presets";

const STORAGE_KEY = "flowdev_workflow_v2";

let persistTimer: NodeJS.Timeout | null = null;
const debouncedPersist = (nodes: CustomNode[], edges: Edge[]) => {
  if (typeof window === "undefined") return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          nodes,
          edges,
          timestamp: Date.now(),
        })
      );
    } catch (e) {
      console.warn("Failed to persist workflow to localStorage", e);
    }
  }, 500);
};

interface FlowState {
  // Main Navigation View: "dashboard" (质量大盘) vs "pipeline" (策略编排)
  activeViewMode: ActiveViewMode;
  setActiveViewMode: (mode: ActiveViewMode) => void;

  nodes: CustomNode[];
  edges: Edge[];
  selectedNode: CustomNode | null;
  isDrawerOpen: boolean;
  isSidebarOpen: boolean;
  isTopologyModalOpen: boolean;

  // Execution State
  isExecuting: boolean;
  nodeLogs: Record<string, string[]>;
  workflowError: string | null;

  // Artifacts & Presets
  artifacts: ExecutionArtifacts;
  isDiffModalOpen: boolean;
  activePresetId: PresetId;

  // Multi-Tenant & Live Guard State
  projects: ProjectItem[];
  selectedProjectId: string;
  recentEvents: ScanEventItem[];
  unreadEventsCount: number;
  isProjectStatsModalOpen: boolean;
  isLiveFeedOpen: boolean;

  // Actions
  onNodesChange: (changes: NodeChange<CustomNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<Edge>[]) => void;
  onConnect: (connection: Connection) => void;
  setSelectedNode: (node: CustomNode | null) => void;
  updateNodeData: (id: string, data: Partial<FlowNodeData>) => void;
  addNode: (node: CustomNode) => void;
  toggleDrawer: (open?: boolean) => void;
  toggleSidebar: (open?: boolean) => void;
  setTopologyModalOpen: (open: boolean) => void;
  setDiffModalOpen: (open: boolean) => void;
  setArtifacts: (data: Partial<ExecutionArtifacts>) => void;
  loadPreset: (presetId: PresetId) => void;
  initFromStorage: () => void;
  setNodes: (nodes: CustomNode[]) => void;
  setEdges: (edges: Edge[]) => void;
  clearCanvas: () => void;

  // Multi-Tenant Actions
  setSelectedProjectId: (id: string) => void;
  setProjects: (projects: ProjectItem[]) => void;
  fetchProjects: () => Promise<void>;
  fetchRecentEvents: (projectId?: string) => Promise<void>;
  addLiveEvent: (event: ScanEventItem) => void;
  clearUnreadEventsCount: () => void;
  setProjectStatsModalOpen: (open: boolean) => void;
  setLiveFeedOpen: (open: boolean) => void;
  saveCurrentPolicyToProject: (projectId: string) => Promise<boolean>;

  // Streaming Actions
  setNodeStatus: (id: string, status: NodeExecutionStatus) => void;
  appendNodeLog: (id: string, log: string) => void;
  resetExecutionState: () => void;
  executeWorkflow: () => Promise<void>;
}

export function createDefaultNodeData(type: FlowNodeType): FlowNodeData {
  switch (type) {
    case "code_input":
      return {
        label: "触发范围与文件过滤 (Scope)",
        type: "code_input",
        description: "定义 Git Hook 捕获范围，过滤白名单后缀与忽略目录",
        status: "idle",
        config: {
          sourceType: "git",
          language: "typescript",
          filePatterns: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx", "**/*.py"],
          ignoredDirs: ["node_modules", "dist", ".next", "build", "coverage"],
          triggerEvent: "pre-commit",
          maxFileSizeKb: 500,
          sampleCode:
            "// 模拟提交代码 (用于策略拦截力仿真验证)\n" +
            "export function payOrder(user: any, amount: number) {\n" +
            "  const balance = user.wallet.balance; // 潜在空指针崩溃隐患\n" +
            "  return balance >= amount;\n" +
            "}\n",
        },
      };
    case "llm_review":
      return {
        label: "代码质量与漏洞审查 (Security)",
        type: "llm_review",
        description: "基于 DeepSeek 深度推演，阻断空指针/SQL注入/密钥泄露",
        status: "idle",
        config: {
          model: "AI/deekseek-v4-flash-0731",
          temperature: 0.1,
          severityLevel: "strict",
          blockNullDeref: true,
          blockSqlInjection: true,
          blockHardcodedSecrets: true,
          blockDangerousEval: true,
          promptTemplate:
            "你是一名资深 DevOps 代码门禁与质量安全审查专家。请审查以下待提交代码，识别致命隐患并输出决策：\n\n```{{language}}\n{{code}}\n```",
          reviewAspects: ["空指针崩溃", "安全注入漏洞", "敏感秘钥泄露", "死循环隐患"],
        },
      };
    case "test_generator":
      return {
        label: "自动化单测覆盖率卡点 (Tests)",
        type: "test_generator",
        description: "强制要求关键逻辑编写测试，并在本地沙箱隔离验证",
        status: "idle",
        config: {
          framework: "unittest",
          enforceTests: true,
          targetCoverage: 80,
          mockMode: true,
          sandboxTimeoutSec: 5,
          selfCorrectionRetries: 2,
          promptTemplate:
            "请针对该功能编写覆盖正常输入与异常边界情况的完整单测代码：\n\n{{code}}",
        },
      };
    case "diff_export":
      return {
        label: "门禁决策与阻断动作 (Enforce)",
        type: "diff_export",
        description: "判定审查未通过时执行 Exit 1 掐断提交并记录审计流水",
        status: "idle",
        config: {
          exportFormat: "unified_diff",
          failureAction: "block_commit",
          notifyChannel: "feishu",
          exportReport: true,
          outputPath: "./output/review_patch.diff",
          autoApply: false,
        },
      };
  }
}

const defaultInitialNodes: CustomNode[] = [
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
];

const defaultInitialEdges: Edge[] = [
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
];

const initialArtifacts: ExecutionArtifacts = {
  originalCode:
    "def calculate_discount(price: float, member_type: str = 'REGULAR') -> float:\n" +
    "    if price < 0:\n" +
    "        raise ValueError('Invalid price')\n" +
    "    if member_type == 'VIP':\n" +
    "        return price * 0.8\n" +
    "    return price * 0.95\n",
  refactoredCode:
    "from enum import Enum\n\n" +
    "class MemberType(str, Enum):\n" +
    "    VIP = 'VIP'\n" +
    "    REGULAR = 'REGULAR'\n\n" +
    "DISCOUNT_RATES = {\n" +
    "    MemberType.VIP: 0.80,\n" +
    "    MemberType.REGULAR: 0.95,\n" +
    "}\n\n" +
    "def calculate_discount(price: float, member_type: MemberType = MemberType.REGULAR) -> float:\n" +
    "    if price < 0:\n" +
    "        raise ValueError('Price cannot be negative')\n" +
    "    rate = DISCOUNT_RATES.get(member_type, 0.95)\n" +
    "    return round(price * rate, 2)\n",
  testCode:
    "import unittest\n\n" +
    "class TestCalculateDiscount(unittest.TestCase):\n" +
    "    def test_vip_discount(self):\n" +
    "        self.assertEqual(calculate_discount(100.0, 'VIP'), 80.0)\n\n" +
    "    def test_regular_discount(self):\n" +
    "        self.assertEqual(calculate_discount(100.0, 'REGULAR'), 95.0)\n\n" +
    "    def test_negative_price(self):\n" +
    "        with self.assertRaises(ValueError):\n" +
    "            calculate_discount(-10.0, 'VIP')\n\n" +
    "    def test_zero_price(self):\n" +
    "        self.assertEqual(calculate_discount(0.0, 'REGULAR'), 0.0)\n\n" +
    "if __name__ == '__main__':\n" +
    "    unittest.main()\n",
  language: "python",
  diffPatch: "",
};

export const useFlowStore = create<FlowState>((set, get) => ({
  nodes: defaultInitialNodes,
  edges: defaultInitialEdges,
  selectedNode: null,
  isDrawerOpen: false,
  isSidebarOpen: true,
  isTopologyModalOpen: false,

  isExecuting: false,
  nodeLogs: {},
  workflowError: null,

  artifacts: initialArtifacts,
  isDiffModalOpen: false,
  activePresetId: "full_review_heal",

  // Main Navigation View: "dashboard" vs "pipeline"
  activeViewMode: "pipeline",
  setActiveViewMode: (mode: ActiveViewMode) => set({ activeViewMode: mode }),

  // Multi-Tenant & Live Guard State
  projects: [],
  selectedProjectId: "all",
  recentEvents: [],
  unreadEventsCount: 0,
  isProjectStatsModalOpen: false,
  isLiveFeedOpen: false,

  onNodesChange: (changes) => {
    const nextNodes = applyNodeChanges(changes, get().nodes);
    set({ nodes: nextNodes });
    debouncedPersist(nextNodes, get().edges);
  },

  onEdgesChange: (changes) => {
    const nextEdges = applyEdgeChanges(changes, get().edges);
    set({ edges: nextEdges });
    debouncedPersist(get().nodes, nextEdges);
  },

  onConnect: (connection) => {
    if (connection.source === connection.target) return;
    const exists = get().edges.some(
      (e) => e.source === connection.source && e.target === connection.target
    );
    if (exists) return;

    const nextEdges = addEdge(
      {
        ...connection,
        animated: true,
        style: { stroke: "#6366f1", strokeWidth: 2 },
      },
      get().edges
    );
    set({ edges: nextEdges });
    debouncedPersist(get().nodes, nextEdges);
  },

  setSelectedNode: (node) => {
    set({
      selectedNode: node,
    });
  },

  updateNodeData: (id, data) => {
    const nextNodes = get().nodes.map((node) => {
      if (node.id === id) {
        const updatedNode = {
          ...node,
          data: {
            ...node.data,
            ...data,
            config: {
              ...(node.data.config || {}),
              ...(data.config || {}),
            },
          },
        };
        if (get().selectedNode?.id === id) {
          set({ selectedNode: updatedNode });
        }
        return updatedNode;
      }
      return node;
    });

    set({ nodes: nextNodes });
    debouncedPersist(nextNodes, get().edges);
  },

  addNode: (node) => {
    const nextNodes = [...get().nodes, node];
    set({
      nodes: nextNodes,
      selectedNode: node,
      isDrawerOpen: true,
    });
    debouncedPersist(nextNodes, get().edges);
  },

  toggleDrawer: (open) => {
    set((state) => ({
      isDrawerOpen: open !== undefined ? open : !state.isDrawerOpen,
    }));
  },

  toggleSidebar: (open) => {
    set((state) => ({
      isSidebarOpen: open !== undefined ? open : !state.isSidebarOpen,
    }));
  },

  setTopologyModalOpen: (open) => {
    set({ isTopologyModalOpen: open });
  },

  setDiffModalOpen: (open) => {
    set({ isDiffModalOpen: open });
  },

  setArtifacts: (data) => {
    set({
      artifacts: {
        ...get().artifacts,
        ...data,
      },
    });
  },

  loadPreset: (presetId: PresetId) => {
    const preset = getPreset(presetId);
    set({
      nodes: preset.nodes,
      edges: preset.edges,
      selectedNode: null,
      activePresetId: presetId,
      nodeLogs: {},
      isExecuting: false,
    });
    debouncedPersist(preset.nodes, preset.edges);
  },

  initFromStorage: () => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.nodes) && Array.isArray(parsed.edges) && parsed.nodes.length > 0) {
          const defaultPositions = [
            { x: 50, y: 150 },
            { x: 380, y: 60 },
            { x: 380, y: 250 },
            { x: 710, y: 150 },
          ];
          const safeNodes: CustomNode[] = parsed.nodes.map((n: any, idx: number) => {
            const defaultData = createDefaultNodeData(n?.type || "code_input");
            return {
              id: n?.id || `node-${idx}`,
              type: n?.type || "code_input",
              position: n?.position || defaultPositions[idx] || { x: 50 + idx * 250, y: 150 },
              data: {
                ...defaultData,
                ...(n?.data || {}),
                label: n?.data?.label || n?.label || defaultData.label,
                config: {
                  ...(defaultData.config || {}),
                  ...(n?.data?.config || n?.config || {}),
                },
              },
            };
          });
          set({
            nodes: safeNodes,
            edges: parsed.edges,
          });
        }
      }
    } catch (e) {
      console.warn("Failed to restore workflow from localStorage", e);
    }
  },

  setNodes: (nodes) => {
    set({ nodes });
    debouncedPersist(nodes, get().edges);
  },

  setEdges: (edges) => {
    set({ edges });
    debouncedPersist(get().nodes, edges);
  },

  clearCanvas: () => {
    set({
      nodes: [],
      edges: [],
      selectedNode: null,
      nodeLogs: {},
      workflowError: null,
      isExecuting: false,
    });
    debouncedPersist([], []);
  },

  // Multi-Tenant Actions
  setSelectedProjectId: (id: string) => {
    set({ selectedProjectId: id });
    get().fetchRecentEvents(id === "all" ? undefined : id);

    if (id !== "all") {
      const proj = get().projects.find((p) => p.id === id);
      if (
        proj &&
        proj.policy &&
        Array.isArray((proj.policy as any).nodes) &&
        (proj.policy as any).nodes.length > 0
      ) {
        const defaultPositions = [
          { x: 50, y: 150 },
          { x: 380, y: 60 },
          { x: 380, y: 250 },
          { x: 710, y: 150 },
        ];
        const rawNodes = (proj.policy as any).nodes;
        const normalizedNodes: CustomNode[] = rawNodes.map((n: any, idx: number) => {
          const defaultData = createDefaultNodeData(n?.type || "code_input");
          return {
            id: n?.id || `node-${idx}`,
            type: n?.type || "code_input",
            position: n?.position || defaultPositions[idx] || { x: 50 + idx * 250, y: 150 },
            data: {
              ...defaultData,
              ...(n?.data || {}),
              label: n?.data?.label || n?.label || defaultData.label,
              config: {
                ...(defaultData.config || {}),
                ...(n?.data?.config || n?.config || {}),
              },
            },
          };
        });

        const rawEdges = (proj.policy as any).edges || [];
        const normalizedEdges: Edge[] = rawEdges.map((e: any, idx: number) => ({
          id: e.id || `edge-${idx}`,
          source: e.source,
          target: e.target,
          animated: true,
          style: e.style || { stroke: "#6366f1", strokeWidth: 2 },
        }));

        set({
          nodes: normalizedNodes,
          edges: normalizedEdges,
        });
      }
    }
  },

  setProjects: (projects: ProjectItem[]) => set({ projects }),

  fetchProjects: async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/projects");
      if (res.ok) {
        const data = await res.json();
        set({ projects: data });
      }
    } catch (e) {
      console.warn("Failed to fetch projects", e);
    }
  },

  fetchRecentEvents: async (projectId?: string) => {
    try {
      const url =
        projectId && projectId !== "all"
          ? `http://127.0.0.1:8000/api/projects/${encodeURIComponent(projectId)}/events`
          : `http://127.0.0.1:8000/api/events/recent`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        set({ recentEvents: data });
      }
    } catch (e) {
      console.warn("Failed to fetch recent events", e);
    }
  },

  addLiveEvent: (event: ScanEventItem) => {
    set((state) => ({
      recentEvents: [
        event,
        ...state.recentEvents.filter((e) => e.id !== event.id),
      ].slice(0, 50),
      unreadEventsCount: state.unreadEventsCount + 1,
    }));
    get().fetchProjects();
  },

  clearUnreadEventsCount: () => set({ unreadEventsCount: 0 }),

  setProjectStatsModalOpen: (open: boolean) =>
    set({ isProjectStatsModalOpen: open }),

  setLiveFeedOpen: (open: boolean) => set({ isLiveFeedOpen: open }),

  saveCurrentPolicyToProject: async (projectId: string) => {
    try {
      const policyPayload = {
        preset: get().activePresetId,
        updated_at: new Date().toISOString(),
        nodes_count: get().nodes.length,
        edges_count: get().edges.length,
        nodes: get().nodes.map((n) => ({
          id: n.id,
          type: n.type,
          position: n.position,
          data: n.data,
          label: n.data?.label,
          config: n.data?.config,
        })),
        edges: get().edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
        })),
      };

      const res = await fetch(
        `http://127.0.0.1:8000/api/projects/${encodeURIComponent(projectId)}/policy`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(policyPayload),
        }
      );

      if (res.ok) {
        await get().fetchProjects();
        return true;
      }
      return false;
    } catch (e) {
      console.error("Failed to save project policy", e);
      return false;
    }
  },

  // SSE Actions
  setNodeStatus: (id, status) => {
    set({
      nodes: get().nodes.map((node) => {
        if (node.id === id) {
          const updated = {
            ...node,
            data: {
              ...node.data,
              status,
            },
          };
          if (get().selectedNode?.id === id) {
            set({ selectedNode: updated });
          }
          return updated;
        }
        return node;
      }),
    });
  },

  appendNodeLog: (id, log) => {
    const currentLogs = get().nodeLogs[id] || [];
    set({
      nodeLogs: {
        ...get().nodeLogs,
        [id]: [...currentLogs, log],
      },
    });
  },

  resetExecutionState: () => {
    set({
      nodes: get().nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          status: "idle",
        },
      })),
      nodeLogs: {},
      workflowError: null,
      isExecuting: false,
    });
  },

  executeWorkflow: async () => {
    if (get().isExecuting) return;

    // Grab initial code from code_input node
    const inputNode = get().nodes.find((n) => n.type === "code_input");
    const initialCode =
      (inputNode?.data.config as any)?.sampleCode ||
      get().artifacts.originalCode;
    const initialLang =
      (inputNode?.data.config as any)?.language || get().artifacts.language;

    get().setArtifacts({
      originalCode: initialCode,
      language: initialLang,
    });

    // Reset nodes to idle and clean logs
    get().resetExecutionState();
    set({ isExecuting: true, workflowError: null });

    try {
      await executeWorkflowStream({
        nodes: get().nodes,
        edges: get().edges,
        onNodeStatus: (data) => {
          get().setNodeStatus(data.nodeId, data.status);
        },
        onNodeLog: (data) => {
          get().appendNodeLog(data.nodeId, data.log);
        },
        onWorkflowFinished: (data) => {
          if (data.artifacts) {
            get().setArtifacts(data.artifacts);
          }
          set({ isExecuting: false });
        },
        onWorkflowError: (err) => {
          set({ workflowError: err, isExecuting: false });
          alert(`工作流执行失败: ${err}`);
        },
      });
    } catch (err: any) {
      set({
        workflowError: err?.message || "连接后端失败",
        isExecuting: false,
      });
    }
  },
}));
