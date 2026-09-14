"""DAG Topology Scheduler using Kahn's Algorithm for FlowDev-AI.

Responsible for:
1. Validating graph structure.
2. Computing execution order of nodes using Kahn's algorithm.
3. Detecting circular dependencies / cycles and raising descriptive errors.
"""

from typing import Dict, List, Any, Set
from pydantic import BaseModel, Field


class DAGCycleError(ValueError):
    """Raised when a cycle is detected in the workflow graph."""
    pass


class WorkflowNode(BaseModel):
    id: str
    type: str
    label: str = ""
    config: Dict[str, Any] = Field(default_factory=dict)


class WorkflowEdge(BaseModel):
    id: str = ""
    source: str
    target: str


class WorkflowPayload(BaseModel):
    nodes: List[WorkflowNode]
    edges: List[WorkflowEdge]


class KahnScheduler:
    """Kahn's Algorithm implementation for DAG topological sorting."""

    @classmethod
    def schedule(cls, payload: WorkflowPayload) -> List[WorkflowNode]:
        """Compute the topological execution order of nodes.

        Raises:
            DAGCycleError: If the graph contains cycles.
        """
        nodes = payload.nodes
        edges = payload.edges

        node_map: Dict[str, WorkflowNode] = {node.id: node for node in nodes}
        in_degree: Dict[str, int] = {node.id: 0 for node in nodes}
        adj_list: Dict[str, List[str]] = {node.id: [] for node in nodes}

        # Build graph representation (only between existing nodes)
        for edge in edges:
            if edge.source in node_map and edge.target in node_map:
                adj_list[edge.source].append(edge.target)
                in_degree[edge.target] += 1

        # Collect all nodes with in-degree == 0
        queue: List[str] = [node_id for node_id, deg in in_degree.items() if deg == 0]
        # Keep consistent order
        queue.sort()

        execution_order_ids: List[str] = []

        while queue:
            curr_id = queue.pop(0)
            execution_order_ids.append(curr_id)

            for neighbor_id in adj_list.get(curr_id, []):
                in_degree[neighbor_id] -= 1
                if in_degree[neighbor_id] == 0:
                    queue.append(neighbor_id)

        # Cycle check
        if len(execution_order_ids) < len(nodes):
            cyclic_node_ids = [
                node_id for node_id, deg in in_degree.items() if deg > 0
            ]
            cyclic_labels = [
                f"{node_map[nid].label} ({nid})" for nid in cyclic_node_ids if nid in node_map
            ]
            raise DAGCycleError(
                f"检测到工作流中存在环路依赖 (Cycle Detected)！受阻节点: {', '.join(cyclic_labels)}"
            )

        return [node_map[nid] for nid in execution_order_ids]
