"""FastAPI Backend Server for FlowDev-AI.

Provides:
- Health check endpoint: GET /api/health
- Streaming workflow execution endpoint via SSE: POST /api/workflow/execute
- Integration with KahnScheduler, ReviewAgent, TestAgent, and TestSandbox
"""

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from pathlib import Path
from config import settings
from scheduler import WorkflowPayload
from executor import WorkflowExecutor
from cli_scanner import CliScanRequest, CliScanResponse, CliScanner

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
    version="1.1.0",
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
        "version": "1.1.0",
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
    logger.info(f"Received CLI scan request for {len(payload.files)} staged file(s)")
    return await CliScanner.scan_files(payload.files)



if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
