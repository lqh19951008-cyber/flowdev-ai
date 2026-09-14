import {
  CustomNode,
  Edge,
  SSENodeLogEvent,
  SSENodeStatusEvent,
  SSEWorkflowFinishedEvent,
  SSEWorkflowStartedEvent,
} from "@/types/flow";

export interface StreamWorkflowOptions {
  nodes: CustomNode[];
  edges: Edge[];
  onWorkflowStarted?: (data: SSEWorkflowStartedEvent) => void;
  onNodeStatus?: (data: SSENodeStatusEvent) => void;
  onNodeLog?: (data: SSENodeLogEvent) => void;
  onWorkflowFinished?: (data: SSEWorkflowFinishedEvent) => void;
  onWorkflowError?: (error: string) => void;
  apiBaseUrl?: string;
}

/**
 * Executes workflow by streaming SSE events from FastAPI backend.
 */
export async function executeWorkflowStream({
  nodes,
  edges,
  onWorkflowStarted,
  onNodeStatus,
  onNodeLog,
  onWorkflowFinished,
  onWorkflowError,
  apiBaseUrl = "http://127.0.0.1:8000",
}: StreamWorkflowOptions): Promise<void> {
  const payload = {
    nodes: nodes.map((node) => ({
      id: node.id,
      type: node.type || "code_input",
      label: node.data.label,
      config: node.data.config || {},
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
    })),
  };

  try {
    const response = await fetch(`${apiBaseUrl}/api/workflow/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`后端请求失败 [HTTP ${response.status}]: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error("响应正文为空，无法建立流式传输");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Split SSE packets separated by double newline
      const packets = buffer.split("\n\n");
      // Keep incomplete trailing packet in buffer
      buffer = packets.pop() || "";

      for (const packet of packets) {
        if (!packet.trim()) continue;

        let eventType = "message";
        let dataContent = "";

        const lines = packet.split("\n");
        for (const line of lines) {
          if (line.startsWith("event:")) {
            eventType = line.replace("event:", "").trim();
          } else if (line.startsWith("data:")) {
            dataContent += line.replace("data:", "").trim();
          }
        }

        if (!dataContent) continue;

        try {
          const parsed = JSON.parse(dataContent);

          switch (eventType) {
            case "workflow_started":
              onWorkflowStarted?.(parsed);
              break;
            case "node_status":
              onNodeStatus?.(parsed);
              break;
            case "node_log":
              onNodeLog?.(parsed);
              break;
            case "workflow_finished":
              onWorkflowFinished?.(parsed);
              break;
            case "workflow_error":
              onWorkflowError?.(parsed.error || "工作流执行未知错误");
              break;
            default:
              break;
          }
        } catch (e) {
          console.warn("Failed to parse SSE payload:", dataContent, e);
        }
      }
    }
  } catch (err: any) {
    const message = err?.message || "连接后端服务失败，请确认 FastAPI 后端正在运行 (http://127.0.0.1:8000)";
    onWorkflowError?.(message);
    throw err;
  }
}
