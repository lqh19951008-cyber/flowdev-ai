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



@app.get("/api/feishu/status")
async def get_feishu_status():
    """Returns the current Feishu bot webhook configuration status."""
    return {
        "configured": settings.has_feishu,
        "webhook_url": settings.FEISHU_WEBHOOK_URL,
        "notify_only_blocked": settings.FEISHU_NOTIFY_ONLY_BLOCKED,
    }


@app.post("/api/feishu/test")
async def test_feishu_notification(payload: dict = None):
    """Sends a sample verification card to the Feishu webhook."""
    from feishu_notifier import FeishuNotifier
    url = payload.get("webhook_url") if payload else None
    return await FeishuNotifier.send_test_card(webhook_url=url)


@app.post("/api/feishu/config")
async def update_feishu_config(payload: dict):
    """Updates the Feishu webhook configuration."""
    from config import save_env_updates
    webhook_url = payload.get("webhook_url", "").strip()
    notify_only_blocked = payload.get("notify_only_blocked", True)

    settings.FEISHU_WEBHOOK_URL = webhook_url
    settings.FEISHU_NOTIFY_ONLY_BLOCKED = notify_only_blocked

    save_env_updates({
        "FEISHU_WEBHOOK_URL": webhook_url,
        "FEISHU_NOTIFY_ONLY_BLOCKED": "true" if notify_only_blocked else "false",
    })

    return {
        "success": True,
        "configured": settings.has_feishu,
        "webhook_url": settings.FEISHU_WEBHOOK_URL,
        "notify_only_blocked": settings.FEISHU_NOTIFY_ONLY_BLOCKED,
    }


@app.get("/api/llm/status")
async def get_llm_status():
    """Returns the current LLM API configuration status."""
    masked_key = ""
    if settings.OPENAI_API_KEY:
        if len(settings.OPENAI_API_KEY) > 8:
            masked_key = f"{settings.OPENAI_API_KEY[:4]}...{settings.OPENAI_API_KEY[-4:]}"
        else:
            masked_key = "********"
    return {
        "configured": settings.has_api_key,
        "api_base": settings.OPENAI_API_BASE,
        "default_model": settings.DEFAULT_MODEL,
        "masked_key": masked_key,
        "has_api_key": settings.has_api_key,
        "request_timeout": settings.REQUEST_TIMEOUT,
    }


@app.post("/api/llm/test")
async def test_llm_connection(payload: dict = None):
    """Tests the LLM connection with given or current settings."""
    import httpx
    payload = payload or {}
    api_key = payload.get("api_key", "").strip()
    # If not provided or masked placeholder, use current key
    if not api_key or "..." in api_key:
        api_key = settings.OPENAI_API_KEY
    api_base = (payload.get("api_base", "").strip() or settings.OPENAI_API_BASE).rstrip("/")
    model = payload.get("model", "").strip() or payload.get("default_model", "").strip() or settings.DEFAULT_MODEL

    if not api_key:
        return {
            "success": False,
            "message": "请先配置 API Key 再进行连通性测试！",
            "model": model,
        }

    auth_token = api_key.strip()
    auth_header = auth_token if auth_token.lower().startswith("bearer ") else f"Bearer {auth_token}"
    endpoint = f"{api_base}/chat/completions"
    headers = {
        "Authorization": auth_header,
        "Content-Type": "application/json",
    }
    test_body = {
        "model": model,
        "messages": [{"role": "user", "content": "Hi, reply with 'pong'"}],
        "max_tokens": 10,
        "temperature": 0.1,
    }


    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(endpoint, headers=headers, json=test_body)
            if resp.status_code == 200:
                data = resp.json()
                reply = ""
                choices = data.get("choices", [])
                if choices:
                    reply = choices[0].get("message", {}).get("content", "").strip()
                return {
                    "success": True,
                    "message": f"连接成功！模型响应: {reply or 'pong'}",
                    "model": model,
                    "status_code": resp.status_code,
                }
            else:
                err_text = resp.text[:200]
                return {
                    "success": False,
                    "message": f"连接失败 (HTTP {resp.status_code}): {err_text}",
                    "model": model,
                    "status_code": resp.status_code,
                }
    except Exception as e:
        return {
            "success": False,
            "message": f"请求异常: {str(e)}",
            "model": model,
        }


@app.post("/api/llm/config")
async def update_llm_config(payload: dict):
    """Updates the LLM configuration."""
    from config import save_env_updates
    updates = {}

    if "api_base" in payload and payload["api_base"]:
        settings.OPENAI_API_BASE = payload["api_base"].strip().rstrip("/")
        updates["OPENAI_API_BASE"] = settings.OPENAI_API_BASE

    if "api_key" in payload:
        new_key = payload["api_key"].strip()
        # Avoid saving masked preview string like sk-12...4567
        if new_key and not ("..." in new_key and len(new_key) < 15):
            settings.OPENAI_API_KEY = new_key
            updates["OPENAI_API_KEY"] = settings.OPENAI_API_KEY
        elif new_key == "":
            settings.OPENAI_API_KEY = ""
            updates["OPENAI_API_KEY"] = ""

    if "default_model" in payload and payload["default_model"]:
        settings.DEFAULT_MODEL = payload["default_model"].strip()
        updates["DEFAULT_MODEL"] = settings.DEFAULT_MODEL

    if "request_timeout" in payload:
        try:
            settings.REQUEST_TIMEOUT = float(payload["request_timeout"])
            updates["REQUEST_TIMEOUT"] = str(settings.REQUEST_TIMEOUT)
        except ValueError:
            pass

    if updates:
        save_env_updates(updates)

    masked_key = ""
    if settings.OPENAI_API_KEY:
        if len(settings.OPENAI_API_KEY) > 8:
            masked_key = f"{settings.OPENAI_API_KEY[:4]}...{settings.OPENAI_API_KEY[-4:]}"
        else:
            masked_key = "********"

    return {
        "success": True,
        "configured": settings.has_api_key,
        "api_base": settings.OPENAI_API_BASE,
        "default_model": settings.DEFAULT_MODEL,
        "masked_key": masked_key,
        "has_api_key": settings.has_api_key,
        "request_timeout": settings.REQUEST_TIMEOUT,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

