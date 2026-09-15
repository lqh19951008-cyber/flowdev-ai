import { Edge } from "@xyflow/react";
import { CustomNode, WorkflowTopology } from "@/types/flow";

/**
 * Computes topological sorting of DAG nodes using Kahn's algorithm
 */
export function computeTopologicalOrder(
  nodes: CustomNode[],
  edges: Edge[]
): { order: string[]; hasCycle: boolean } {
  const nodeIds = new Set(nodes.map((n) => n.id));
  const inDegree: Record<string, number> = {};
  const adjList: Record<string, string[]> = {};

  // Initialize
  for (const node of nodes) {
    inDegree[node.id] = 0;
    adjList[node.id] = [];
  }

  // Build adjacency list and in-degrees (filtering edges that belong to existing nodes)
  for (const edge of edges) {
    if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
      adjList[edge.source].push(edge.target);
      inDegree[edge.target] = (inDegree[edge.target] || 0) + 1;
    }
  }

  // Find all sources (in-degree 0)
  const queue: string[] = [];
  for (const node of nodes) {
    if (inDegree[node.id] === 0) {
      queue.push(node.id);
    }
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    order.push(curr);

    for (const neighbor of adjList[curr] || []) {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) {
        queue.push(neighbor);
      }
    }
  }

  const hasCycle = order.length !== nodes.length;

  return {
    order,
    hasCycle,
  };
}

/**
 * Transforms visual canvas state into structured LangGraph-ready topology JSON
 */
export function generateWorkflowTopology(
  nodes: CustomNode[],
  edges: Edge[],
  workflowName: string = "多 Agent 代码审查与自动化单测流"
): WorkflowTopology {
  const { order } = computeTopologicalOrder(nodes, edges);

  const langGraphNodes: Record<
    string,
    { type: CustomNode["type"] & string; label: string; config: CustomNode["data"]["config"] }
  > = {};
  const langGraphEdges: Record<string, string[]> = {};
  const inDegree: Record<string, number> = {};

  for (const node of nodes) {
    const data = node.data || (node as any);
    langGraphNodes[node.id] = {
      type: node.type || "code_input",
      label: data?.label || (node as any)?.label || "未命名门禁节点",
      config: data?.config || (node as any)?.config || {},
    };
    langGraphEdges[node.id] = [];
    inDegree[node.id] = 0;
  }

  for (const edge of edges) {
    if (langGraphEdges[edge.source]) {
      langGraphEdges[edge.source].push(edge.target);
      inDegree[edge.target] = (inDegree[edge.target] || 0) + 1;
    }
  }

  const entryPoints = nodes
    .filter((node) => (inDegree[node.id] || 0) === 0)
    .map((node) => node.id);

  return {
    workflowId: "flowdev-wf-v1",
    name: workflowName,
    version: "1.0.0",
    createdAt: new Date().toISOString(),
    nodeCount: nodes.length,
    edgeCount: edges.length,
    executionOrder: order,
    nodes: nodes.map((n) => {
      const data = n.data || (n as any);
      return {
        id: n.id,
        type: n.type || "code_input",
        label: data?.label || (n as any)?.label || "未命名门禁节点",
        config: data?.config || (n as any)?.config || {},
      };
    }),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
    })),
    langGraphSchema: {
      entryPoints,
      nodes: langGraphNodes,
      edges: langGraphEdges,
    },
  };
}
