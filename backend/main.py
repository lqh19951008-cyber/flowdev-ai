"""FastAPI Backend Server for FlowDev-AI.

Provides:
- Health check endpoint: GET /api/health
- Streaming workflow execution endpoint via SSE: POST /api/workflow/execute
- Integration with KahnScheduler, ReviewAgent, TestAgent, and TestSandbox
"""

import logging
import sys

# Ensure UTF-8 output encoding across Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
if hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from pathlib import Path
from config import settings
from scheduler import WorkflowPayload
from executor import WorkflowExecutor
from cli_scanner import CliScanRequest, CliScanResponse, CliScanner

from database import DatabaseService
from event_bus import EventBus

# Configure dual logging: console + backend/flowdev.log
LOG_FILE = Path(__file__).parent / "flowdev.log"

log_format = logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s")

file_handler = logging.FileHandler(LOG_FILE, encoding="utf-8")
file_handler.setFormatter(log_format)

console_handler = logging.StreamHandler()
console_handler.setFormatter(log_format)

root_logger = logging.getLogger()
root_logger.setLevel(logging.INFO)
# Clear existing handlers to prevent duplicate output
root_logger.handlers.clear()
root_logger.addHandler(file_handler)
root_logger.addHandler(console_handler)

logger = logging.getLogger("flowdev.main")
logger.info(f"FlowDev-AI 日志系统已就绪，实时日志输出文件: {LOG_FILE}")

app = FastAPI(
    title="FlowDev-AI Core API",
    version="1.2.0",
    description="Multi-agent code review, unit test generation, and sandbox self-correction backend.",
)

# CORS configuration allowing frontend connection
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health_check():
    """Health check endpoint with LLM configuration status."""
    return {
        "status": "healthy",
        "service": "FlowDev-AI Core",
        "version": "1.2.0",
        "dag_engine": "KahnScheduler-v1",
        "llm_config": {
            "api_base": settings.OPENAI_API_BASE,
            "has_api_key": settings.has_api_key,
            "default_model": settings.DEFAULT_MODEL,
        },
    }


@app.post("/api/workflow/execute")
async def execute_workflow(payload: WorkflowPayload):
    """Executes the workflow graph in topological order.

    Streams ReviewAgent and TestAgent outputs, executes tests in sandbox,
    and runs self-correction loop when assertions fail.
    """
    return StreamingResponse(
        WorkflowExecutor.execute_stream(payload),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/cli/scan", response_model=CliScanResponse)
async def cli_scan(payload: CliScanRequest):
    """CLI Pre-Commit code review gatekeeper endpoint.

    Scans staged code files for syntax, runtime null errors, security vulnerabilities,
    and runs automated sandbox unit test validation.
    """
    logger.info(
        f"Received CLI scan request for project '{payload.project_id or 'rxjs'}' "
        f"from {payload.committer or 'unknown'} ({len(payload.files)} staged file(s))"
    )
    return await CliScanner.scan_files(
        files=payload.files,
        project_id=payload.project_id or "rxjs",
        committer=payload.committer or "unknown",
        branch=payload.branch or "main",
        commit_hash=payload.commit_hash or "",
    )


@app.get("/api/projects")
async def list_projects():
    """Lists all monitored projects accompanied by pass rate and total scans."""
    return DatabaseService.list_projects_with_stats()


@app.get("/api/projects/{project_id}/events")
async def list_project_events(project_id: str, limit: int = 30):
    """Lists recent audit scan events for a specific project."""
    return DatabaseService.list_recent_events(project_id=project_id, limit=limit)


@app.get("/api/events/recent")
async def list_all_recent_events(limit: int = 30):
    """Lists recent audit scan events across all projects."""
    return DatabaseService.list_recent_events(project_id=None, limit=limit)


@app.put("/api/projects/{project_id}/policy")
async def update_project_policy(project_id: str, policy: dict):
    """Updates the custom DAG review policy for a project."""
    success = DatabaseService.update_project_policy(project_id, policy)
    return {"success": success, "project_id": project_id}


@app.get("/api/events/stream")
async def stream_events():
    """SSE endpoint broadcasting real-time commit scan events to Web dashboards."""
    return StreamingResponse(
        EventBus.subscribe(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )



if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
