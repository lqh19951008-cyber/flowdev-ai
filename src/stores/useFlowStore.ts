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
} from "@/types/flow";
import { executeWorkflowStream } from "@/lib/sse";
import { getPreset } from "@/lib/presets";

const STORAGE_KEY = "flowdev_workflow_v1";

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
  nodes: CustomNode[];
  edges: Edge[];
  selectedNode: CustomNode | null;
  isDrawerOpen: boolean;
  isSidebarOpen: boolean;
  isTopologyModalOpen: boolean;

  // Milestone 3 Execution State
  isExecuting: boolean;
  nodeLogs: Record<string, string[]>;
  workflowError: string | null;

  // Milestone 5: Artifacts & Presets
  artifacts: ExecutionArtifacts;
  isDiffModalOpen: boolean;
  activePresetId: PresetId;

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
        label: "源码输入 (Input)",
        type: "code_input",
        description: "接收代码片段或 Git PR 变更 Diff 进行分析",
        status: "idle",
        config: {
          sourceType: "snippet",
          language: "python",
          sampleCode:
            "def calculate_discount(price: float, member_type: str = 'REGULAR') -> float:\n" +
            "    if price < 0:\n" +
            "        raise ValueError('Invalid price')\n" +
            "    if member_type == 'VIP':\n" +
            "        return price * 0.8\n" +
            "    return price * 0.95\n",
        },
      };
    case "llm_review":
      return {
        label: "代码规范与漏洞评审",
        type: "llm_review",
        description: "基于 DeepSeek-V3 对逻辑、安全及异味进行深度审查",
        status: "idle",
        config: {
          model: "AI/deekseek-v4-flash-0731",
          temperature: 0.2,
          promptTemplate:
            "你是一个资深全栈架构师与安全专家。请评审以下 {{language}} 代码，识别逻辑死角、安全隐患与设计异味，并输出具体修改建议：\n\n```{{language}}\n{{code}}\n```",
          reviewAspects: ["代码异味", "安全漏洞", "类型健壮性", "边界条件"],
        },
      };
    case "test_generator":
      return {
        label: "Jest/Unittest 单测生成",
        type: "test_generator",
        description: "针对核心逻辑生成覆盖率达标的高质量自动化单元测试套件",
        status: "idle",
        config: {
          framework: "unittest",
          targetCoverage: 85,
          mockMode: true,
          promptTemplate:
            "请针对该功能编写覆盖正常输入与异常边界情况的完整单测代码：\n\n{{code}}",
        },
      };
    case "diff_export":
      return {
        label: "代码差异与补丁导出",
        type: "diff_export",
        description: "整合审查建议与生成单测，导出标准 Git Patch 与分析报告",
        status: "idle",
        config: {
          exportFormat: "unified_diff",
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
      isDrawerOpen: node !== null ? true : get().isDrawerOpen,
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
          set({
            nodes: parsed.nodes,
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
