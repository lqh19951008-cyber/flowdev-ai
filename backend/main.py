"""FastAPI Backend Server for FlowDev-AI.

Provides:
- Health check endpoint: GET /api/health
- Streaming workflow execution endpoint via SSE: POST /api/workflow/execute
- Integration with KahnScheduler, ReviewAgent, TestAgent, and TestSandbox
"""

import json
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

from typing import Optional, Literal, Dict, Any, List
from pydantic import BaseModel, Field
from fastapi import FastAPI, HTTPException, Body, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, PlainTextResponse, JSONResponse

class CreateProjectRequest(BaseModel):
    id: str = Field(..., min_length=1, max_length=64, pattern=r"^[a-zA-Z0-9_-]+$")
    name: Optional[str] = Field(None, max_length=128)
    description: Optional[str] = Field(None, max_length=256)
    failure_action: Optional[Literal["block_commit", "warn_only", "disabled"]] = "block_commit"
    preset_id: Optional[str] = Field(None, max_length=64)
    policy_dag: Optional[Dict[str, Any]] = None


from pathlib import Path
from config import settings
from scheduler import WorkflowPayload
from executor import WorkflowExecutor
from cli_scanner import CliScanRequest, CliScanResponse, CliApplySuggestionsRequest, CliApplySuggestionsResponse, CliScanner

from database import DatabaseService, get_utc_now_iso, get_connection
from event_bus import EventBus
from ai_service import LLMService
from agents import extract_code_block, extract_json_object

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

import os

ALLOWED_ORIGINS = [
    orig.strip()
    for orig in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001,http://localhost:5173,http://127.0.0.1:5173,http://localhost:8000,http://127.0.0.1:8000",
    ).split(",")
    if orig.strip()
]

# CORS configuration allowing frontend connection
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
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


@app.post("/api/rules/refine")
async def refine_rule_with_chat(request: Request):
    """Conversational refinement endpoint.

    The gatekeeper iterates on a previously synthesized rule by chatting
    with the LLM in natural language ("make it more specific", "add a
    Python example", "focus only on SQL injection"). Each call returns a
    new rule draft, building on the previous one.

    Request body:
        {
          "previous_rule": { title, summary, bad_snippet, good_snippet,
                              skill_markdown, gate_rule, ... },
          "messages": [
            {"role": "user", "content": "请增加 Python 的例子"},
            {"role": "assistant", "content": "好, 上轮结果..."},
            ...
          ],
          "context": {
            "project_ids": ["..."],
            "events": [...],     // optional, used to re-anchor the prompt
          }
        }
    """
    try:
        payload = await request.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {e!s}")
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Body must be JSON object")

    previous_rule = payload.get("previous_rule") or {}
    messages_in = payload.get("messages") or []
    context = payload.get("context") or {}

    if not isinstance(messages_in, list) or len(messages_in) == 0:
        raise HTTPException(status_code=400, detail="'messages' must be a non-empty list")
    if not previous_rule.get("title"):
        raise HTTPException(status_code=400, detail="'previous_rule.title' required")

    sys_prompt = (
        "你是一名世界顶尖的软件架构师与 DevSecOps 质量工程专家。\n"
        "守门员正与你就上一轮提炼出的规则进行对话迭代修改。\n"
        "你的任务: 严格保留上一轮规则的核心意图, 同时精准响应用户最新一轮的修改要求, 生成一个**新版完整 JSON 草稿**。\n"
        "要求:\n"
        "  1. 必须直接输出严格合法的 JSON 代码块 (```json ... ```)\n"
        "  2. 字段与上一轮完全一致, 不丢字段\n"
        "  3. 用户可能要求:\n"
        "     - 改换示例语言 (TypeScript → Python)\n"
        "     - 调整粒度 (更宽松/更严苛)\n"
        "     - 增加具体场景 (e.g. 仅限 SQL 注入)\n"
        "     - 改述门禁卡点正则\n"
        "     - 重写 skill_markdown 为别的格式\n"
        "  4. 始终保留 bad_snippet / good_snippet / skill_markdown / gate_rule 四个字段\n"
    )

    history = [previous_rule.get("title")]
    user_msg = messages_in[-1].get("content", "") if isinstance(messages_in[-1], dict) else ""
    history.append(f"用户最新修改要求: {user_msg}")

    user_prompt = (
        f"上一轮规则 JSON:\n```json\n{json.dumps(previous_rule, ensure_ascii=False, indent=2)}\n```\n\n"
        f"对话历史 (旧 → 新):\n"
        + "\n".join(
            f"  [{m.get('role', '?')}] {m.get('content', '')[:400]}"
            for m in messages_in if isinstance(m, dict)
        )
        + "\n\n"
        f"项目上下文 (可选): {json.dumps(context, ensure_ascii=False)[:800]}\n\n"
        "请生成新版 JSON 草稿, 只输出 ```json ... ``` 代码块。"
    )

    messages = [
        {"role": "system", "content": sys_prompt},
        {"role": "user", "content": user_prompt},
    ]

    if settings.has_api_key:
        try:
            chunks: List[str] = []
            async for token in LLMService.stream_chat(messages, temperature=0.3):
                chunks.append(token)
            full_response = "".join(chunks)
            data = extract_json_object(full_response)
            if isinstance(data, dict) and "title" in data and "good_snippet" in data:
                # Carry forward metadata that the model may strip
                data.setdefault("source_events", previous_rule.get("source_events", 0))
                data.setdefault("source_files", previous_rule.get("source_files", []))
                data.setdefault("common_root_cause", previous_rule.get("common_root_cause", ""))
                data["_refined"] = True
                return {
                    "rule": data,
                    "history": messages_in,
                    "previous_title": previous_rule.get("title"),
                }
        except Exception as err:
            logger.warning(f"Refine LLM failed, returning previous_rule unchanged: {err}")

    # Fallback: echo previous rule with light modification
    fallback = dict(previous_rule)
    fallback["_refined"] = False
    fallback["_fallback_note"] = "LLM 不可用, 返回上一轮结果不变, 请稍后重试"
    return {
        "rule": fallback,
        "history": messages_in,
        "previous_title": previous_rule.get("title"),
    }


@app.post("/api/rules/apply-batch")
async def apply_rule_to_batch(request: Request):
    """Apply a synthesized (or refined) rule to multiple selected projects.

    Powers the chat-driven workflow end: the gatekeeper talks with AI to
    get a rule draft, then clicks "Apply to N selected projects" to push
    it as a new policy version on each project at once.
    """
    try:
        payload = await request.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {e!s}")
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Body must be JSON object")

    project_ids = payload.get("project_ids") or []
    rule = payload.get("rule") or {}
    push_immediately = bool(payload.get("push_immediately", True))

    if not isinstance(project_ids, list) or len(project_ids) == 0:
        raise HTTPException(status_code=400, detail="'project_ids' must be a non-empty list")
    if not rule.get("title"):
        raise HTTPException(status_code=400, detail="'rule.title' required")

    results = []
    for pid in project_ids:
        if not isinstance(pid, str):
            results.append({"project_id": str(pid), "ok": False, "error": "invalid id"})
            continue
        try:
            existing = DatabaseService.get_project_policy(pid) or {}
            skills = existing.get("skills") or []
            gate_rules = existing.get("gate_rules") or []
            skill_entry = {
                "id": f"batch-{int(__import__('time').time()*1000)}",
                "title": rule.get("title"),
                "category": rule.get("category", "stability"),
                "summary": rule.get("summary", ""),
                "skill_markdown": rule.get("skill_markdown", ""),
                "source": "batch_aggregate",
                "source_events": rule.get("source_events"),
                "source_files": rule.get("source_files"),
            }
            new_skills = [s for s in skills if s.get("title") != skill_entry["title"]]
            new_skills.append(skill_entry)
            gate_entry = (rule.get("gate_rule") or {})
            new_gate_rules = [g for g in gate_rules if g.get("title") != gate_entry.get("title")]
            if gate_entry.get("title"):
                new_gate_rules.append(gate_entry)
            new_policy = dict(existing)
            new_policy["skills"] = new_skills
            new_policy["gate_rules"] = new_gate_rules
            DatabaseService.update_project_policy(pid, new_policy)
            push_state = {"pending": False, "version": None}
            if push_immediately:
                try:
                    push_state = await _broadcast_policy_change(pid, reason=f"batch apply from chat: {rule.get('title')[:60]}")
                except Exception as e:
                    push_state = {"pending": False, "version": None, "error": str(e)}
            results.append({
                "project_id": pid,
                "ok": True,
                "skill_id": skill_entry["id"],
                "pushed": push_state.get("pending", False) or bool(push_state.get("version")),
            })
        except Exception as e:
            results.append({
                "project_id": pid,
                "ok": False,
                "error": f"{e!s}",
            })
    return {"applied": sum(1 for r in results if r["ok"]), "results": results}


@app.post("/api/cli/apply-suggestions", response_model=CliApplySuggestionsResponse)
async def cli_apply_suggestions(request: Request):
    """AI-powered code refactoring endpoint. Hook calls this with the original
    file content + suggestions list; AI returns the FULLY rewritten file.
    Hook then writes it back to disk + git-adds. This is the engine behind
    the "AI 自动改代码" UX — user presses Y and the file is rewritten.
    """
    try:
        payload = await request.json()
    except Exception:
        return JSONResponse({"detail": "invalid JSON"}, status_code=400)

    project_id = payload.get("project_id") or "default"
    file_path = payload.get("file_path") or "unknown"
    original_content = payload.get("original_content") or ""
    suggestions = payload.get("suggestions") or []
    language = payload.get("language") or "auto"
    if not isinstance(suggestions, list):
        return JSONResponse({"detail": "suggestions must be a list"}, status_code=400)

    logger.info(
        f"Apply suggestions: project={project_id}, file={file_path}, "
        f"{len(suggestions)} suggestions, {len(original_content)} chars"
    )
    return await CliScanner.apply_suggestions(
        project_id=project_id,
        file_path=file_path,
        original_content=original_content,
        suggestions=suggestions,
        language=language,
    )


@app.get("/api/projects")
async def list_projects():
    """Lists all monitored projects accompanied by pass rate and total scans."""
    return DatabaseService.list_projects_with_stats()


@app.get("/api/projects/health-matrix")
async def projects_health_matrix(days: int = 7):
    """Aggregated health matrix for the gatekeeper dashboard.

    Returns one row per project with key health indicators over the last
    `days` days, so the gatekeeper can see at-a-glance which projects are
    healthy and which need attention. Designed for batch aggregation:
    the gatekeeper selects multiple rows in the UI and triggers a
    cross-project rule synthesis.
    """
    return DatabaseService.list_projects_health_matrix(days=days)


@app.post("/api/projects")
async def create_project(request: Request):
    """Creates or connects a new monitored project."""
    try:
        raw = await request.json()
    except Exception:
        # Empty body fallback: create with just the id from the URL or path
        raw = {}
    # The ID field on CreateProjectRequest is required; if missing, try
    # extracting from headers or return 400.
    if not raw.get("id"):
        raise HTTPException(status_code=400, detail="Project 'id' is required in request body")
    payload = CreateProjectRequest(**raw)
    project = DatabaseService.create_project(
        project_id=payload.id,
        name=payload.name,
        description=payload.description,
        failure_action=payload.failure_action or "block_commit",
        preset_id=payload.preset_id,
        policy_dag=payload.policy_dag,
    )
    return {"success": True, "project": project}


@app.delete("/api/projects/{project_id}")
async def delete_project(project_id: str):
    """Deletes a project and removes its audit history."""
    clean_id = project_id.strip()
    if not clean_id:
        raise HTTPException(status_code=400, detail="Invalid project_id")
    deleted = DatabaseService.delete_project(clean_id)
    return {"success": deleted, "project_id": clean_id}



@app.get("/api/projects/{project_id}/events")
async def list_project_events(project_id: str, limit: int = 30):
    """Lists recent audit scan events for a specific project."""
    return DatabaseService.list_recent_events(project_id=project_id, limit=limit)


@app.get("/api/events/recent")
async def list_all_recent_events(limit: int = 30):
    """Lists recent audit scan events across all projects."""
    return DatabaseService.list_recent_events(project_id=None, limit=limit)


@app.get("/api/projects/{project_id}/policy")
async def get_project_policy(project_id: str):
    """Retrieves the quality gate policy and synthesized rules/skills for a project."""
    policy = DatabaseService.get_project_policy(project_id)
    return {
        "project_id": project_id,
        "policy": policy,
        "custom_rules": policy.get("custom_rules", []),
        "agent_skills": policy.get("agent_skills", []),
        "push_state": DatabaseService.get_project_push_state(project_id),
    }


async def _broadcast_policy_change(project_id: str, reason: str = "") -> None:
    """Bumps the project's policy_version and (if enabled) marks a pending push.

    Called from every server-side endpoint that mutates a project's rules /
    skills / gate-mode. This is what enables Push Mode: as soon as something
    changes server-side, the next local git commit will see a fresh
    `pending_push_version` and ask the developer for a one-key confirmation
    before writing the new rule files into the working tree.
    """
    new_version = DatabaseService.bump_policy_version(project_id, reason=reason)
    push_state = DatabaseService.get_project_push_state(project_id)
    if push_state.get("push_enabled"):
        # Stage the new version as awaiting local confirmation. The actual
        # write to AGENTS.md / .cursorrules / SKILL.md happens on the
        # developer side inside the Git hook.
        DatabaseService.mark_pending_push(project_id, changelog=[
            {"reason": reason or "规则更新", "version": new_version, "at": get_utc_now_iso()},
        ])
        push_state = DatabaseService.get_project_push_state(project_id)
    await EventBus.broadcast("rule_pushed", {
        "project_id": project_id,
        "version": new_version,
        "reason": reason,
        "push_state": push_state,
    })
    return new_version


@app.put("/api/projects/{project_id}/policy")
async def update_project_policy(project_id: str, policy: dict):
    """Updates the custom DAG review policy for a project."""
    success = DatabaseService.update_project_policy(project_id, policy)
    new_version = None
    if success:
        new_version = await _broadcast_policy_change(project_id, reason="DAG 策略更新")
    return {
        "success": success,
        "project_id": project_id,
        "policy_version": new_version,
    }


@app.put("/api/projects/{project_id}/gate-mode")
async def set_project_gate_mode(project_id: str, payload: dict):
    """Convenient endpoint to switch gatekeeper mode for a project.
    
    Modes:
    - block_commit (or block): Strict gatekeeper, blocks commit on critical issues.
    - warn_only (or warn): Runs AI review & suggestions, but 100% allows commit (never blocks!).
    - disabled (or off): Completely bypasses review for lightning-fast commits.
    """
    mode = payload.get("mode", "block_commit")
    if mode in ("block", "block_commit"):
        failure_action = "block_commit"
        gate_enabled = True
    elif mode in ("warn", "warn_only"):
        failure_action = "warn_only"
        gate_enabled = True
    elif mode in ("disabled", "off", "bypass"):
        failure_action = "disabled"
        gate_enabled = False
    else:
        failure_action = "block_commit"
        gate_enabled = True

    policy = DatabaseService.get_project_policy(project_id) or {}
    policy["gate_enabled"] = gate_enabled
    policy["failure_action"] = failure_action
    policy["failureAction"] = failure_action

    # If policy has nodes, update diff_export node config as well
    if "nodes" in policy and isinstance(policy["nodes"], list):
        for node in policy["nodes"]:
            if node.get("type") == "diff_export":
                if "data" in node and isinstance(node["data"], dict) and "config" in node["data"]:
                    node["data"]["config"]["failureAction"] = failure_action
                elif "config" in node and isinstance(node["config"], dict):
                    node["config"]["failureAction"] = failure_action

    success = DatabaseService.update_project_policy(project_id, policy)
    return {
        "success": success,
        "project_id": project_id,
        "mode": failure_action,
        "gate_enabled": gate_enabled,
    }


@app.post("/api/rules/synthesize")
async def synthesize_rule_and_skill(request: Request):
    """Synthesizes an IDE Agent Skill and Gatekeeper Rule from intercepted code defects.

    Closed-loop evolution:
    Intercepted bugs -> Synthesized Rule -> .cursorrules / SKILL.md for IDE AI + Regex Gate for Pre-Commit.

    Two modes:
      (A) Single event (legacy): payload.critical_issues + payload.suggestions
      (B) Batch aggregation (new): payload.events = [{critical_issues, suggestions, filename, ...}, ...]
          — the gatekeeper selects N related events; AI synthesizes ONE unified rule
            covering the common root cause across all events. More efficient than
            N rules, easier for the team to internalize.
    """
    try:
        payload = await request.json()
    except Exception as e:
        logger.warning(f"synthesize_rule_and_skill: invalid JSON body: {e!r}")
        raise HTTPException(status_code=400, detail=f"Invalid JSON body: {e!s}")
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Body must be a JSON object")
    project_id = payload.get("project_id", "default")
    language = payload.get("language", "typescript")

    # === Batch mode: aggregate multiple scan events into one unified rule ===
    events = payload.get("events") or []
    if events and isinstance(events, list) and len(events) > 0:
        return await _synthesize_from_events(project_id, events, language)

    # === Single event mode (legacy backward-compatible) ===
    critical_issues = payload.get("critical_issues", [])
    suggestions = payload.get("suggestions", [])
    filename = payload.get("filename", "")
    code_snippet = payload.get("code_snippet", "")

    issues_text = "\n".join(f"- {issue}" for issue in critical_issues)
    if not issues_text:
        issues_text = "\n".join(f"- {s}" for s in suggestions) or "检测到代码健壮性与安全隐患"

    # 1. Attempt LLM synthesis if API key is configured
    if settings.has_api_key:
        sys_prompt = (
            "你是一名世界顶尖的软件架构师与 DevSecOps 质量工程专家。\n"
            "我们正在构建一套「缺陷拦截 -> 经验沉淀 -> 规则/Skill进化」的自闭环质量防护体系。\n"
            "用户在提交代码时被 FlowDev 门禁拦截，请从此次代码缺陷中汲取教训，提炼出可预防未来同类缺陷的规则与 IDE Agent Skill。\n"
            "必须直接输出严格合法的 JSON 代码块（```json ... ```）：\n"
            "{\n"
            '  "title": "规则标题 (如: 可选链防御与空指针安全访问规范)",\n'
            '  "category": "stability",\n'
            '  "severity": "critical",\n'
            '  "summary": "一句话核心指导原则与风险根因",\n'
            '  "bad_snippet": "// ❌ 危险反例代码（带详细注释说明为何导致崩溃或风险）",\n'
            '  "good_snippet": "// ✅ 规范正例代码（带详细防御性编程注释）",\n'
            '  "skill_markdown": "专为 IDE AI 编程助手（Cursor / Copilot / Claude Code / Antigravity）定制的 .cursorrules / SKILL.md 规则指令 Markdown，包含触发上下文、编码准则、正反示例",\n'
            '  "gate_rule": {\n'
            '    "title": "卡点规则名称",\n'
            '    "pattern": "用于在 pre-commit 正则检测中静态拦截同类高危代码的正则表达式",\n'
            '    "message": "门禁卡点拦截提示信息",\n'
            '    "level": "critical"\n'
            '  }\n'
            "}"
        )
        user_prompt = (
            f"目标仓库: {project_id}\n"
            f"目标文件: {filename}\n"
            f"代码语言: {language}\n"
            f"门禁拦截的严重缺陷:\n{issues_text}\n"
        )
        if suggestions:
            user_prompt += f"\n改进建议:\n" + "\n".join(f"- {s}" for s in suggestions)
        if code_snippet:
            user_prompt += f"\n\n相关代码上下文:\n```{language}\n{code_snippet[:1500]}\n```"

        messages = [
            {"role": "system", "content": sys_prompt},
            {"role": "user", "content": user_prompt},
        ]

        try:
            chunks = []
            async for token in LLMService.stream_chat(messages, temperature=0.2):
                chunks.append(token)
            full_response = "".join(chunks)
            data = extract_json_object(full_response)
            if isinstance(data, dict) and "title" in data and "good_snippet" in data:
                data["source_events"] = 1
                return data
        except Exception as err:
            logger.warning(f"LLM rule synthesis failed, falling back to heuristic engine: {err}")

    # 2. Deterministic Heuristic Synthesis Engine
    full_text = f"{filename} {issues_text} {code_snippet}".lower()

    if "null" in full_text or "undefined" in full_text or "空指针" in full_text or "typeerror" in full_text:
        return {
            "title": "防御性可选链与空指针安全防护规范",
            "category": "stability",
            "severity": "critical",
            "summary": "禁止对深层对象或外部输入进行未经校验的解构和直接链式访问，必须使用可选链（?.）与空值合并运算符（??）。",
            "bad_snippet": "// ❌ 危险反例：未校验对象可能为空，直接进行属性深层访问，易引发 TypeError: Cannot read properties of undefined\nconst userEmail = response.data.user.profile.email;\nconst amount = order.payment.details.amount;\nprocessPayment(amount.toFixed(2));",
            "good_snippet": "// ✅ 规范正例：使用可选链与空值合并运算符，安全降级，防御不可预期空值\nconst userEmail = response?.data?.user?.profile?.email ?? 'unregistered@example.com';\nconst amount = order?.payment?.details?.amount;\nif (typeof amount === 'number') {\n  processPayment(amount.toFixed(2));\n} else {\n  logger.warn('Missing payment amount, fallback to safe flow.');\n}",
            "skill_markdown": "# Skill: Defensive Optional Chaining & Null Safety\n\n## Context\nWhen writing JavaScript / TypeScript code that accesses external API payloads, nested state, or optional parameters, avoid direct chaining that causes runtime crashes.\n\n## Guidelines for AI Coding Assistants\n1. **Always use optional chaining (`?.`)** when traversing 2+ levels deep into objects that may be undefined.\n2. **Provide safe fallbacks with `??`** (nullish coalescing) instead of assuming values always exist.\n3. **Perform guard clauses** early in handler functions (`if (!payload) return;`).\n4. **Do not use dangerous type assertions** (`as any` or `!`) to bypass compiler type checks.\n\n## Example\n```typescript\n// Safe access pattern\nconst total = cart?.summary?.totalAmount ?? 0;\n```\n",
            "gate_rule": {
                "title": "未防御的深层属性访问与空对象引用",
                "pattern": r"\b(null|undefined)\.[a-zA-Z0-9_]+",
                "message": "检测到针对 null/undefined 的直接属性访问，请使用可选链 (?.) 或显式判空防御！",
                "level": "critical",
            },
        }
    elif "eval" in full_text or "exec" in full_text or "代码执行" in full_text or "injection" in full_text or "sql" in full_text:
        return {
            "title": "杜绝危险动态执行与代码注入防御规范",
            "category": "security",
            "severity": "critical",
            "summary": "严禁在业务逻辑中调用 eval()、exec() 或未参数化的 SQL 字符串拼接，消除远程代码执行（RCE）与注入风险。",
            "bad_snippet": "// ❌ 危险反例：动态解析不可信输入，或拼接 SQL 语句\neval('const result = ' + userInput);\nconst query = 'SELECT * FROM users WHERE id = ' + userId;",
            "good_snippet": "// ✅ 规范正例：使用安全解析库与参数化查询\nconst parsed = JSON.parse(userInput);\nconst query = 'SELECT * FROM users WHERE id = ?';\nawait db.query(query, [userId]);",
            "skill_markdown": "# Skill: Secure Execution & Injection Prevention\n\n## Context\nPrevent security vulnerabilities arising from untrusted input execution or unsanitized database queries.\n\n## Guidelines for AI Coding Assistants\n1. Never recommend or generate `eval()`, `exec()`, `Function()`, or `setTimeout` with string arguments.\n2. Always use parameterized queries or ORM query builders (e.g. Prisma, Drizzle, SQLAlchemy) for database interactions.\n3. Validate all incoming payload schemas with Zod, Joi, or Pydantic.\n",
            "gate_rule": {
                "title": "高危动态执行与注入函数检测",
                "pattern": r"\b(eval|exec)\s*\(",
                "message": "严禁使用 eval() 或 exec() 危险动态执行函数！",
                "level": "critical",
            },
        }
    elif "key" in full_text or "secret" in full_text or "token" in full_text or "凭证" in full_text or "密钥" in full_text:
        return {
            "title": "敏感凭据与 API Key 防泄露隔离规范",
            "category": "security",
            "severity": "critical",
            "summary": "严禁在源代码中硬编码 API Key、Access Token、私钥或密码，所有敏感凭证必须通过环境变量注入。",
            "bad_snippet": "// ❌ 危险反例：直接硬编码敏感密钥提交至版本库\nconst OPENAI_KEY = 'sk-proj-xxxxxxxxxxxxxxxxxxxxxx';\nconst DB_PASS = 'ProdSuperSecret123!';",
            "good_snippet": "// ✅ 规范正例：从安全环境变量中读取凭据\nconst OPENAI_KEY = process.env.OPENAI_API_KEY;\nif (!OPENAI_KEY) {\n  throw new Error('Missing OPENAI_API_KEY environment variable');\n}",
            "skill_markdown": "# Skill: Secret & Credential Zero-Leakage Policy\n\n## Context\nPrevent accidental commitment of tokens, private keys, and passwords.\n\n## Guidelines for AI Coding Assistants\n1. Never inline secrets or hardcoded test tokens in production code.\n2. Always reference environment variables via `process.env.*` or `os.environ.get()`.\n3. Add `.env*` to `.gitignore` automatically.\n",
            "gate_rule": {
                "title": "硬编码凭证与密钥拦截",
                "pattern": r"(sk-[a-zA-Z0-9_\-]{20,}|AKIA[0-9A-Z]{16})",
                "message": "检测到硬编码敏感密钥或凭据，严禁提交至版本控制库！",
                "level": "critical",
            },
        }
    else:
        return {
            "title": f"代码健壮性与边界防御规范 ({project_id})",
            "category": "stability",
            "severity": "critical",
            "summary": f"针对近期门禁拦截的质量隐患，建立前置校验与防御性编程准则。",
            "bad_snippet": f"// ❌ 历史拦截隐患:\n// {issues_text}\n// 未进行异常防护或边界条件处理",
            "good_snippet": "// ✅ 规范正例: 完善边界防御与类型保护\ntry {\n  // 稳健的核心业务执行逻辑\n} catch (error) {\n  logger.error('Safe recovery from error:', error);\n}",
            "skill_markdown": f"# Skill: Defensive Programming Standard for {project_id}\n\n## Context\nHistorical gatekeeper scan intercepted defects: {issues_text}.\n\n## Guidelines for AI Coding Assistants\n1. Always validate inputs at the public interface boundary.\n2. Handle error states gracefully without crashing the runtime.\n3. Provide unit test coverage for edge cases.\n",
            "gate_rule": {
                "title": "通用健壮性与边界防御规则",
                "pattern": r"\b(throw\s+new\s+Error|assert\s+False)",
                "message": "请确认异常抛出逻辑具备完整的错误捕获与日志记录",
                "level": "warning",
            },
        }


async def _synthesize_from_events(project_id: str, events: List[Dict[str, Any]], language: str) -> Dict[str, Any]:
    """Batch-mode synthesis: aggregate N scan events into ONE unified rule.

    Used when a gatekeeper selects multiple related scan events in the UI
    (e.g., "all the null-pointer issues from last week") and wants one rule
    that covers the common root cause, instead of N narrow rules.

    Strategy:
      - Concatenate every event's critical_issues + suggestions.
      - Build a per-event mini-summary (file + 1-line root cause) so the
        model sees the *breadth* of similar bugs, not just a flat blob.
      - LLM synthesizes one rule whose scope is "any future code that would
        trigger any of these patterns". Fall back to a heuristic engine
        when no API key is configured.
    """
    # --- Aggregate issues ---
    all_critical: List[str] = []
    all_suggestions: List[str] = []
    event_summaries: List[str] = []
    filenames: List[str] = []
    for idx, ev in enumerate(events, start=1):
        if not isinstance(ev, dict):
            continue
        ci = ev.get("critical_issues") or []
        sg = ev.get("suggestions") or []
        fname = ev.get("filename") or (ev.get("files") or [{}])[0].get("filename", "") or "(未知文件)"
        all_critical.extend([str(x) for x in ci])
        all_suggestions.extend([str(x) for x in sg])
        filenames.append(fname)
        ci_short = (ci[0] if ci else sg[0] if sg else "未提供") if (ci or sg) else "未提供"
        ci_short = str(ci_short)
        if len(ci_short) > 80:
            ci_short = ci_short[:77] + "..."
        event_summaries.append(f"  事件{idx}. {fname}: {ci_short}")

    if not all_critical and not all_suggestions:
        # Nothing to aggregate from — bail to heuristic with empty context.
        issues_text = "批量聚合请求, 但所有选中事件都为空"
    else:
        issues_text = "\n".join(f"- {x}" for x in all_critical) or "(无 critical, 只有 suggestions)"

    # --- LLM path (preferred) ---
    if settings.has_api_key:
        sys_prompt = (
            "你是一名世界顶尖的软件架构师与 DevSecOps 质量工程专家。\n"
            "我们正在构建一套「缺陷拦截 -> 经验沉淀 -> 规则/Skill进化」的自闭环质量防护体系。\n"
            f"守门员从 FlowDev 门禁拦截历史中勾选了 {len(event_summaries)} 条事件, 这些事件可能存在同一个根因或同类风险。\n"
            "请从这些事件的“共性”中提炼出 **一条** 能同时预防未来同类缺陷的统一规则与 IDE Agent Skill (不要给每条事件单独生成规则)。\n"
            "**关键要求**: 提炼出的规则的覆盖范围应能同时应对所有选中事件中出现的同质缺陷。\n"
            "必须直接输出严格合法的 JSON 代码块 (```json ... ```):\n"
            "{\n"
            '  "title": "规则标题",\n'
            '  "category": "stability|security|performance|maintainability",\n'
            '  "severity": "critical|warning|info",\n'
            '  "summary": "一句话核心指导原则与共同根因",\n'
            '  "bad_snippet": "// ❌ 危险反例代码 (带详细注释说明为何崩溃)",\n'
            '  "good_snippet": "// ✅ 规范正例代码 (覆盖所有选中事件的防御)",\n'
            '  "skill_markdown": "专为 IDE AI 编程助手 (Cursor / Copilot / Claude Code / Antigravity) 定制的 .cursorrules / SKILL.md 规则指令 Markdown, 包含触发上下文、编码准则、正反示例",\n'
            '  "gate_rule": {\n'
            '    "title": "卡点规则名称",\n'
            '    "pattern": "用于在 pre-commit 正则检测中静态拦截同类高危代码的正则表达式 (覆盖所有选中事件)",\n'
            '    "message": "门禁卡点拦截提示信息",\n'
            '    "level": "critical|warning|info"\n'
            '  },\n'
            '  "source_events_count": ' + str(len(event_summaries)) + ',\n'
            '  "common_root_cause": "对选中事件共同根因的一句话诊断"\n'
            "}"
        )
        user_prompt = (
            f"目标仓库: {project_id}\n"
            f"代码语言: {language}\n"
            f"选中事件 ({len(event_summaries)} 条):\n"
            + "\n".join(event_summaries) + "\n\n"
            f"所有 critical issues (合计 {len(all_critical)} 条):\n{issues_text}\n"
        )
        if all_suggestions:
            user_prompt += f"\n所有改进建议 (合计 {len(all_suggestions)} 条):\n" + "\n".join(f"- {s}" for s in all_suggestions[:20])

        messages = [
            {"role": "system", "content": sys_prompt},
            {"role": "user", "content": user_prompt},
        ]
        try:
            chunks = []
            async for token in LLMService.stream_chat(messages, temperature=0.2):
                chunks.append(token)
            full_response = "".join(chunks)
            data = extract_json_object(full_response)
            if isinstance(data, dict) and "title" in data and "good_snippet" in data:
                # Always overwrite aggregate metadata so the caller sees the true count
                data["source_events"] = len(event_summaries)
                data["source_files"] = list(set(filenames))
                data["_aggregated"] = True
                return data
            logger.warning(f"Batch LLM synthesis returned malformed JSON, falling back.")
        except Exception as err:
            logger.warning(f"Batch LLM synthesis failed, falling back to heuristic: {err}")

    # --- Heuristic fallback (single-rule, simple keyword detection) ---
    full_text = " ".join(all_critical + all_suggestions + event_summaries).lower()
    if any(k in full_text for k in ("null", "undefined", "空指针", "typeerror")):
        return {
            "title": "防御性可选链与空指针安全防护规范",
            "category": "stability",
            "severity": "critical",
            "summary": f"聚合自 {len(event_summaries)} 条事件的共同根因: 未对深层对象做空值校验直接属性访问, 运行时崩溃。",
            "bad_snippet": "// ❌ 未校验直接属性访问, 触发 TypeError\nconst userName = response.data.user.profile.name;",
            "good_snippet": "// ✅ 可选链 + 空值合并, 安全降级\nconst userName = response?.data?.user?.profile?.name ?? 'anonymous';",
            "skill_markdown": (
                "# Skill: Defensive Optional Chaining & Null Safety\n\n"
                "## Context\nAll scan events aggregated. When writing JavaScript / TypeScript code "
                "that accesses external API payloads or nested state, avoid direct chaining "
                "that causes runtime crashes.\n\n"
                "## Guidelines\n1. Always use optional chaining (`?.`)\n"
                "2. Provide safe fallbacks with `??`\n"
                "3. Perform guard clauses early\n\n"
                "## Example\n```typescript\nconst total = cart?.summary?.totalAmount ?? 0;\n```\n"
            ),
            "gate_rule": {
                "title": "未防御的深层属性访问与空对象引用",
                "pattern": r"\b(null|undefined)\.[a-zA-Z0-9_]+",
                "message": "检测到直接对 null/undefined 做属性访问, 请使用可选链 (?.) 或显式判空",
                "level": "critical",
            },
            "source_events": len(event_summaries),
            "source_files": list(set(filenames)),
            "common_root_cause": "未对深层对象做空值校验直接属性访问",
        }
    # Generic fallback
    return {
        "title": f"聚合规则: 来自 {len(event_summaries)} 条事件的共性防御",
        "category": "stability",
        "severity": "warning",
        "summary": f"对 {len(event_summaries)} 条事件的统一防御建议 (LLM 未配置, 使用启发式 fallback)。",
        "bad_snippet": "// ❌ 未提供 (heuristic fallback)",
        "good_snippet": "// ✅ 未提供 (heuristic fallback)",
        "skill_markdown": f"# 聚合防御规范\n\n该规则由 {len(event_summaries)} 条事件聚合生成, 建议手动完善。\n\n## 涉及的缺陷\n" + "\n".join(f"- {x}" for x in all_critical[:10]) + "\n",
        "gate_rule": {
            "title": "聚合启发式门禁",
            "pattern": r".*",
            "message": "聚合规则触发, 请人工 review",
            "level": "warning",
        },
        "source_events": len(event_summaries),
        "source_files": list(set(filenames)),
        "common_root_cause": "(启发式 fallback, 建议配置 LLM API 后重新生成)",
    }


@app.post("/api/projects/{project_id}/rules/apply")
async def apply_project_rule(project_id: str, request: Request):
    """Applies and persists a synthesized rule and agent skill to the project's gatekeeper policy.

    Side effect: when push mode is enabled for this project, applying a rule
    automatically stages it as a pending push so every local repo with the
    FlowDev Git hook will be prompted on their next commit. No additional
    "push" action is required from the gatekeeper.
    """
    payload = await _read_json_body(request)
    policy = DatabaseService.get_project_policy(project_id) or {}
    custom_rules = policy.get("custom_rules", [])
    agent_skills = policy.get("agent_skills", [])

    rule = payload.get("custom_rule")
    skill = payload.get("agent_skill")

    if rule and isinstance(rule, dict):
        existing_idx = next(
            (i for i, r in enumerate(custom_rules) if r.get("title") == rule.get("title") or (rule.get("pattern") and r.get("pattern") == rule.get("pattern"))),
            None,
        )
        if existing_idx is not None:
            custom_rules[existing_idx] = rule
        else:
            custom_rules.append(rule)
        policy["custom_rules"] = custom_rules

    if skill and isinstance(skill, dict):
        existing_idx = next(
            (i for i, s in enumerate(agent_skills) if s.get("title") == skill.get("title")),
            None,
        )
        if existing_idx is not None:
            agent_skills[existing_idx] = skill
        else:
            agent_skills.append(skill)
        policy["agent_skills"] = agent_skills

    success = DatabaseService.update_project_policy(project_id, policy)
    new_version = None
    auto_pushed = False
    if success:
        push_state_before = DatabaseService.get_project_push_state(project_id)
        push_enabled = push_state_before.get("push_enabled", True)
        new_version = await _broadcast_policy_change(project_id, reason="新增 / 更新防御规则与 Skill")
        push_state_after = DatabaseService.get_project_push_state(project_id)
        # _broadcast_policy_change automatically marks pending_push if push_enabled
        auto_pushed = (
            push_enabled
            and bool(push_state_after.get("pending_push_version"))
            and push_state_after.get("pending_push_version") == new_version
        )
    return {
        "success": success,
        "project_id": project_id,
        "custom_rules_count": len(custom_rules),
        "agent_skills_count": len(agent_skills),
        "policy": policy,
        "policy_version": new_version,
        "auto_pushed": auto_pushed,
        "pending_push_version": (
            DatabaseService.get_project_push_state(project_id).get("pending_push_version")
            if success else None
        ),
    }


@app.delete("/api/projects/{project_id}/rules")
async def delete_project_rule(project_id: str, request: Request):
    """Removes a custom rule or skill from a project's gatekeeper policy.

    Side effect: when push mode is enabled for this project, deleting a rule
    also bumps policy_version and re-stages a pending push so local repos
    pick up the updated rule set on their next commit.
    """
    payload = await _read_json_body(request)
    policy = DatabaseService.get_project_policy(project_id) or {}
    custom_rules = policy.get("custom_rules", [])
    agent_skills = policy.get("agent_skills", [])

    title = payload.get("title")
    rule_idx = payload.get("rule_index")
    skill_idx = payload.get("skill_index")

    if title:
        policy["custom_rules"] = [r for r in custom_rules if r.get("title") != title]
        policy["agent_skills"] = [s for s in agent_skills if s.get("title") != title]
    elif rule_idx is not None and 0 <= rule_idx < len(custom_rules):
        custom_rules.pop(rule_idx)
        policy["custom_rules"] = custom_rules
    elif skill_idx is not None and 0 <= skill_idx < len(agent_skills):
        agent_skills.pop(skill_idx)
        policy["agent_skills"] = agent_skills

    success = DatabaseService.update_project_policy(project_id, policy)
    new_version = None
    if success:
        new_version = await _broadcast_policy_change(project_id, reason="删除防御规则 / Skill")
    return {
        "success": success,
        "project_id": project_id,
        "custom_rules": policy.get("custom_rules", []),
        "agent_skills": policy.get("agent_skills", []),
        "policy_version": new_version,
    }


# ============================================================
# Push Mode: rules -> local repo, one-key confirmation
# ============================================================
class TriggerPushPayload(BaseModel):
    reason: Optional[str] = None
    force: bool = False

class AckPushPayload(BaseModel):
    applied_version: Optional[str] = None
    files_written: List[str] = []

class PushEnabledPayload(BaseModel):
    enabled: bool = True


async def _read_json_body(request: Request) -> Dict[str, Any]:
    """Robustly parses a JSON body, returning an empty dict on missing / empty body.

    FastAPI + Pydantic v2 has known quirks where declaring `dict` as a parameter
    type can fail with a generic "There was an error parsing the body" 400.
    Reading the raw body and decoding it ourselves gives us a deterministic
    fallback regardless of whether the caller sent `{}`, `{"reason": "..."}`,
    or no body at all.
    """
    try:
        body_bytes = await request.body()
    except Exception:
        return {}
    if not body_bytes:
        return {}
    text = body_bytes.decode("utf-8", errors="replace").strip()
    if not text:
        return {}
    try:
        data = json.loads(text)
    except Exception:
        # Allow empty/blank body to silently coerce to {}.
        return {}
    return data if isinstance(data, dict) else {}


@app.get("/api/projects/{project_id}/sync-status")
async def get_sync_status(project_id: str, local_version: Optional[str] = None):
    """Returns whether the server has a newer policy version awaiting local application.

    Called by the Git pre-commit hook at the start of every commit so it can
    decide whether to prompt the developer: "新规则 v0.0.5 待应用，是否同步？(Y/n)".
    """
    state = DatabaseService.get_project_push_state(project_id)
    return {
        "project_id": project_id,
        "latest_version": state["policy_version"],
        "local_version": local_version or state["last_applied_version"],
        "pending_push_version": state["pending_push_version"],
        "push_enabled": state["push_enabled"],
        "pending": state["pending"],
        "changelog": state["changelog"],
        "last_pushed_at": state["last_pushed_at"],
        "last_applied_at": state["last_applied_at"],
        "last_applied_version": state["last_applied_version"],
    }


@app.post("/api/projects/{project_id}/push")
async def trigger_push(project_id: str, request: Request):
    """Manually stages a push from the Web control panel.

    Bumps the policy version and marks it as `pending_push_version` so the
    next local commit will offer the developer a one-key confirmation to
    pull the new AGENTS.md / .cursorrules / SKILL.md into the working tree.
    """
    payload = await _read_json_body(request)
    reason = (payload.get("reason") or "Web 控制台手动推送").strip()[:200]
    force = bool(payload.get("force", False))

    state = DatabaseService.get_project_push_state(project_id)
    if not state["push_enabled"] and not force:
        raise HTTPException(status_code=409, detail="当前项目已关闭推送模式 (push_enabled=false)")

    new_version = DatabaseService.bump_policy_version(project_id, reason=reason)
    push_state = DatabaseService.mark_pending_push(
        project_id,
        changelog=[{"reason": reason, "version": new_version, "at": get_utc_now_iso()}],
        version=new_version,
    )

    await EventBus.broadcast("rule_pushed", {
        "project_id": project_id,
        "version": new_version,
        "reason": reason,
        "push_state": push_state,
    })

    return {
        "success": True,
        "project_id": project_id,
        "version": new_version,
        "push_state": push_state,
        "message": f"已标记 {new_version} 待推送到本地仓库。下次 git commit 时会在终端询问是否同步（默认 Y）。",
    }


@app.post("/api/projects/{project_id}/ack-push")
async def ack_push(project_id: str, request: Request):
    """Called by the Git hook AFTER it has written new files into the working tree.

    Clears the pending flag, stamps `last_applied_*`, and broadcasts
    `rule_applied` over the event bus so the Web control panel can flip the
    card to a green "✅ 已应用" state in real time.
    """
    payload = await _read_json_body(request)
    applied_version = (payload.get("applied_version") or "").strip() or None
    files_written = payload.get("files_written") or []
    if not isinstance(files_written, list):
        files_written = []

    push_state = DatabaseService.get_project_push_state(project_id)
    target = applied_version or push_state.get("pending_push_version") or push_state.get("policy_version")

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            UPDATE projects
            SET pending_push_version = NULL,
                last_applied_at = ?,
                last_applied_version = ?
            WHERE id = ?
            """,
            (get_utc_now_iso(), target, project_id),
        )
        conn.commit()

    new_state = DatabaseService.get_project_push_state(project_id)

    await EventBus.broadcast("rule_applied", {
        "project_id": project_id,
        "applied_version": target,
        "files_written": files_written,
        "push_state": new_state,
    })

    return {
        "success": True,
        "project_id": project_id,
        "applied_version": target,
        "push_state": new_state,
    }


@app.post("/api/projects/{project_id}/cancel-push")
async def cancel_push(project_id: str, request: Request):
    """Clears the pending push flag without recording an application.

    Called when the local developer answers 'n' to the prompt (or the prompt
    times out). The policy version still lives on the server, but it is no
    longer advertised as pending so it won't keep nagging at every commit.
    """
    _ = await _read_json_body(request)  # body is optional, accepted for forward-compat
    state = DatabaseService.cancel_pending_push(project_id)
    await EventBus.broadcast("rule_push_cancelled", {
        "project_id": project_id,
        "push_state": state,
    })
    return {"success": True, "project_id": project_id, "push_state": state}


@app.put("/api/projects/{project_id}/push-enabled")
async def set_push_enabled(project_id: str, request: Request):
    """Toggles whether this project allows push notifications to local repos."""
    payload = await _read_json_body(request)
    enabled = bool(payload.get("enabled", True))
    state = DatabaseService.set_push_enabled(project_id, enabled)
    return {"success": True, "project_id": project_id, "push_state": state}


@app.get("/api/projects/{project_id}/skills/export")
async def export_project_skills(
    project_id: str,
    format: str = "antigravity_skill",
    incremental: bool = False,
):
    """Exports synthesized skills and quality rules for IDE AI agents (Antigravity, Cursor, Claude, Copilot, Windsurf).
    
    Supported formats:
    - antigravity_skill / agy_skill: .agent/skills/flowdev-quality/SKILL.md format with YAML frontmatter
    - gemini_md / agents_md: GEMINI.md / AGENTS.md format for Antigravity & AI coding assistants
    - cursorrules: .cursorrules Markdown format
    - cursor_mdc: .cursor/rules/flowdev-guards.mdc modular format
    - claude_md: CLAUDE.md guidelines format
    - copilot: .github/copilot-instructions.md format
    - windsurf: .windsurfrules format
    - json: Full JSON payload containing all rules and metadata
    """
    policy = DatabaseService.get_project_policy(project_id) or {}
    custom_rules = policy.get("custom_rules", [])
    agent_skills = policy.get("agent_skills", [])

    if format == "json":
        return {
            "project_id": project_id,
            "custom_rules": custom_rules,
            "agent_skills": agent_skills,
            "count": len(agent_skills),
        }

    lines = []

    # Format 1: Antigravity SKILL.md (Google AGY Skill Specification)
    if format in ("antigravity_skill", "agy_skill", "skill_md"):
        lines.extend([
            "---",
            "name: flowdev-quality",
            f"description: FlowDev-AI Code Quality & Pre-Commit Gatekeeper Defensive Guidelines for {project_id}.",
            "---",
            "",
            f"# FlowDev-AI Defensive Coding Skill ({project_id})",
            "",
            f"This skill contains active quality guidelines, architectural constraints, and learned anti-patterns for `{project_id}`.",
            "",
            "## 🛡️ Critical Quality Gate Requirements",
            "When generating or refactoring code in this repository, you MUST adhere to the following rules:",
            "",
        ])
        if custom_rules:
            lines.append("### Active Pre-Commit Gatekeeper Regex Checks")
            for r in custom_rules:
                lines.append(f"- **{r.get('title', 'Rule')}**: `{r.get('pattern', '')}` (Level: {r.get('level', 'critical')})")
                if r.get("message"):
                    lines.append(f"  *Enforcement:* {r.get('message')}")
            lines.append("")

        if agent_skills:
            lines.append("## 📚 Synthesized Engineering Best Practices")
            for idx, skill in enumerate(agent_skills, 1):
                lines.append(f"### Rule {idx}: {skill.get('title', 'Defensive Rule')}")
                lines.append(f"**Principle:** {skill.get('summary', '')}")
                lines.append("")
                if skill.get("markdown"):
                    lines.append(skill.get("markdown"))
                    lines.append("")
        else:
            lines.append("## 📚 Standard Defensive Rules")
            lines.append("- Always perform defensive null checks (`?.`, `??`).")
            lines.append("- Never use dangerous dynamic execution functions like `eval()`.")
            lines.append("- Keep all credentials and tokens in environment variables.")
            lines.append("- Write unit tests for core edge cases.")

        content = "\n".join(lines)
        return PlainTextResponse(content=content, media_type="text/markdown; charset=utf-8")

    # Format 2: Antigravity GEMINI.md / AGENTS.md Rules File
    if format in ("gemini_md", "agents_md", "antigravity_rule"):
        lines.extend([
            f"# Antigravity Project Instructions for {project_id}",
            "",
            "> Automatically generated and synced by FlowDev-AI Quality Gatekeeper.",
            "> Enforced at both IDE AI level and Git Pre-Commit level.",
            "",
            "## Code Quality Standards & Guidelines",
            "",
        ])
        if custom_rules:
            lines.append("### Pre-Commit Gatekeeper Constraints")
            for r in custom_rules:
                lines.append(f"- **{r.get('title', 'Rule')}**: `{r.get('pattern', '')}`")
                if r.get("message"):
                    lines.append(f"  *Action:* {r.get('message')}")
            lines.append("")

        if agent_skills:
            lines.append("### Project-Specific Agent Skills & Defensive Rules")
            for idx, skill in enumerate(agent_skills, 1):
                lines.append(f"#### {idx}. {skill.get('title', 'Defensive Standard')}")
                lines.append(f"**Summary:** {skill.get('summary', '')}")
                lines.append("")
                if skill.get("markdown"):
                    lines.append(skill.get("markdown"))
                    lines.append("")
        else:
            lines.append("### General Rules")
            lines.append("- Guard against null/undefined property dereferences.")
            lines.append("- Never hardcode API keys or credentials.")
            lines.append("- Prevent SQL/Command injections with parameterized queries.")

        content = "\n".join(lines)
        return PlainTextResponse(content=content, media_type="text/markdown; charset=utf-8")

    # Cursor 0.40+ Modular Rule format (.cursor/rules/*.mdc)
    if format == "cursor_mdc":
        lines.extend([
            "---",
            f"description: FlowDev-AI Code Quality & Gatekeeper Standards for {project_id}",
            "globs: **/*",
            "alwaysApply: true",
            "---",
            "",
            f"# FlowDev-AI Quality Standards & Agent Skills ({project_id})",
            "> Automatically synthesized and maintained by FlowDev-AI Gatekeeper.",
            "> Independent modular rule: does not conflict with existing .cursorrules.",
            "",
        ])
    else:
        tool_title = (
            "Cursor AI Rules (.cursorrules)" if format == "cursorrules" else
            "Claude Code Guidelines (CLAUDE.md)" if format == "claude_md" else
            "GitHub Copilot Instructions (.github/copilot-instructions.md)" if format == "copilot" else
            "Windsurf Rules (.windsurfrules)"
        )

        if incremental:
            lines.extend([
                "<!-- FLOWDEV_AI_RULES_START -->",
                f"## FlowDev-AI Defensive Quality Standards ({project_id})",
                "> Automatically managed by FlowDev-AI. You may append this block to your existing configuration.",
                "",
            ])
        else:
            lines.extend([
                f"# {project_id} - Code Quality Standards & Agent Skills",
                f"> Automatically synthesized and maintained by FlowDev-AI Pre-Commit Gatekeeper.",
                f"> Target Spec: {tool_title}",
                "",
                "## General Instructions",
                f"You are the AI coding companion working on repository '{project_id}'.",
                "You must strictly adhere to the following quality standards and learned architectural constraints.",
                "Under no circumstances should you generate code that violates these rules.",
                "",
            ])

    if custom_rules:
        lines.append("### Pre-Commit Quality Gate Regex Constraints")
        lines.append("The repository gatekeeper actively blocks commits violating these regex patterns:")
        for r in custom_rules:
            lines.append(f"- **{r.get('title', 'Rule')}**: `{r.get('pattern', '')}`")
            if r.get("message"):
                lines.append(f"  *Reason:* {r.get('message')}")
        lines.append("")

    if agent_skills:
        lines.append("### Synthesized Agent Skills & Defensive Standards")
        for idx, skill in enumerate(agent_skills, 1):
            lines.append(f"#### Skill {idx}: {skill.get('title', 'Defensive Standard')}")
            lines.append(f"**Summary:** {skill.get('summary', '')}")
            lines.append("")
            if skill.get("markdown"):
                lines.append(skill.get("markdown"))
                lines.append("")
    else:
        lines.append("#### Default Stability Guard")
        lines.append("- Always perform defensive null checks (`?.`, `??`).")
        lines.append("- Never use dangerous dynamic execution functions like `eval()`.")
        lines.append("- Keep all credentials and tokens in environment variables.")

    if incremental and format != "cursor_mdc":
        lines.append("<!-- FLOWDEV_AI_RULES_END -->")

    content = "\n".join(lines)
    return PlainTextResponse(content=content, media_type="text/markdown; charset=utf-8")


@app.get("/scripts/flowdev-hook.js")
async def get_hook_script():
    """Returns the standalone Node.js pre-commit hook script for any external project."""
    hook_file = Path(__file__).parent.parent / "scripts" / "flowdev-hook.js"
    if not hook_file.exists():
        hook_file = Path("scripts/flowdev-hook.js")
    if hook_file.exists():
        content = hook_file.read_text(encoding="utf-8")
        return PlainTextResponse(content=content, media_type="application/javascript; charset=utf-8")
    return PlainTextResponse(content="// flowdev hook not found", status_code=404)


@app.get("/api/hook/version")
async def get_hook_version():
    """
    Hook self-upgrade endpoint. Returns the current hook's version + sha so
    installed copies can detect out-of-date state and self-replace. The hook
    reads HOOK_VERSION constant directly from the source file, so bumping the
    constant automatically becomes the new 'latest' — no manual registry.
    """
    # == HANDBOOK: hook-version-api ==
    # **Hook 自升级协议的源头端点。**
    #
    # Hook 启动时调这里, 服务器返回当前 hook 版本号 + sha + size + 下载地址。
    # Hook 端比对 local_version vs server.version, 如需升级:
    #   1. GET /scripts/flowdev-hook.js 下载新脚本
    #   2. 备份 .git/hooks/pre-commit.bak
    #   3. 写入新脚本 + 重新 spawn
    #
    # 零运维: 改完 hook 代码, 改顶部 const HOOK_VERSION = "X.Y.Z", 团队所有项目下次 commit 自动升级。
    # == /HANDBOOK ==
    import hashlib
    import re
    hook_file = Path(__file__).parent.parent / "scripts" / "flowdev-hook.js"
    if not hook_file.exists():
        hook_file = Path("scripts/flowdev-hook.js")
    if not hook_file.exists():
        return {"version": "0.0.0", "sha": "", "size": 0}

    text = hook_file.read_text(encoding="utf-8")
    # Extract HOOK_VERSION constant from source — single source of truth
    m = re.search(r'const\s+HOOK_VERSION\s*=\s*"([^"]+)"', text)
    version = m.group(1) if m else "0.0.0"
    sha = hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]
    return {
        "version": version,
        "sha": sha,
        "size": len(text),
        "download_url": "/scripts/flowdev-hook.js",
    }


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
    """Returns the current LLM API configuration status and active profile."""
    from database import DatabaseService
    active_profile = DatabaseService.get_active_llm_profile()
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
        "active_profile": active_profile,
    }


@app.get("/api/llm/profiles")
async def list_llm_profiles():
    """Returns all configured LLM profiles with active state."""
    from database import DatabaseService
    profiles = DatabaseService.list_llm_profiles()
    active_profile = DatabaseService.get_active_llm_profile()
    return {
        "profiles": profiles,
        "active_profile_id": active_profile["id"] if active_profile else None,
        "total": len(profiles),
    }


@app.post("/api/llm/profiles")
async def create_llm_profile(payload: dict):
    """Creates a new LLM connection profile (always succeeds, even if offline or unverified)."""
    from database import DatabaseService
    from config import save_env_updates

    name = str(payload.get("name") or "未命名连接").strip()
    api_base = str(payload.get("api_base") or "https://api.openai.com/v1").strip()
    api_key_val = payload.get("api_keys") if payload.get("api_keys") is not None else payload.get("api_key", "")
    default_model = str(payload.get("default_model") or "deepseek-chat").strip()
    
    try:
        request_timeout = float(payload.get("request_timeout", 60.0))
    except (ValueError, TypeError):
        request_timeout = 60.0

    provider_type = str(payload.get("provider_type") or "custom").strip()
    set_active = bool(payload.get("set_active", False))

    profile = DatabaseService.create_llm_profile(
        name=name,
        api_base=api_base,
        api_key=api_key_val,
        default_model=default_model,
        request_timeout=request_timeout,
        provider_type=provider_type,
        set_active=set_active,
    )

    if set_active and profile:
        settings.OPENAI_API_BASE = profile["api_base"]
        settings.OPENAI_API_KEY = profile.get("api_key", "")
        settings.DEFAULT_MODEL = profile["default_model"]
        settings.REQUEST_TIMEOUT = profile["request_timeout"]
        save_env_updates({
            "OPENAI_API_BASE": settings.OPENAI_API_BASE,
            "OPENAI_API_KEY": settings.OPENAI_API_KEY,
            "DEFAULT_MODEL": settings.DEFAULT_MODEL,
            "REQUEST_TIMEOUT": str(settings.REQUEST_TIMEOUT),
        })

    return {
        "success": True,
        "profile": profile,
        "profiles": DatabaseService.list_llm_profiles(),
        "active_profile_id": DatabaseService.get_active_llm_profile()["id"] if DatabaseService.get_active_llm_profile() else None,
        "message": f"成功保存连接「{name}」！",
    }


@app.put("/api/llm/profiles/{profile_id}")
async def update_llm_profile(profile_id: str, payload: dict):
    """Updates an existing LLM connection profile."""
    from database import DatabaseService
    from config import save_env_updates

    profile = DatabaseService.update_llm_profile(profile_id, payload)
    if not profile:
        # If profile doesn't exist, create it gracefully
        profile = DatabaseService.create_llm_profile(
            name=str(payload.get("name") or "自定义连接"),
            api_base=str(payload.get("api_base") or "https://api.openai.com/v1"),
            api_key=str(payload.get("api_key") or ""),
            default_model=str(payload.get("default_model") or "deepseek-chat"),
            provider_type=str(payload.get("provider_type") or "custom"),
        )

    # If this profile is active, sync to runtime settings and .env
    if profile and profile.get("is_active"):
        settings.OPENAI_API_BASE = profile["api_base"]
        if "api_key" in payload:
            key = str(payload["api_key"]).strip()
            if not ("..." in key and len(key) < 15):
                settings.OPENAI_API_KEY = key
        settings.DEFAULT_MODEL = profile["default_model"]
        settings.REQUEST_TIMEOUT = profile["request_timeout"]
        save_env_updates({
            "OPENAI_API_BASE": settings.OPENAI_API_BASE,
            "OPENAI_API_KEY": settings.OPENAI_API_KEY,
            "DEFAULT_MODEL": settings.DEFAULT_MODEL,
            "REQUEST_TIMEOUT": str(settings.REQUEST_TIMEOUT),
        })

    return {
        "success": True,
        "profile": profile,
        "profiles": DatabaseService.list_llm_profiles(),
        "active_profile_id": DatabaseService.get_active_llm_profile()["id"] if DatabaseService.get_active_llm_profile() else None,
        "message": f"成功更新连接配置！",
    }


@app.post("/api/llm/profiles/{profile_id}/activate")
async def activate_llm_profile(profile_id: str):
    """Activates a specific LLM profile and updates backend runtime immediately."""
    from database import DatabaseService
    from config import save_env_updates

    profile = DatabaseService.set_active_llm_profile(profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    # Sync to runtime settings and .env
    settings.OPENAI_API_BASE = profile["api_base"]
    settings.OPENAI_API_KEY = profile.get("api_key", "")
    settings.DEFAULT_MODEL = profile["default_model"]
    settings.REQUEST_TIMEOUT = float(profile.get("request_timeout", 60.0))

    save_env_updates({
        "OPENAI_API_BASE": settings.OPENAI_API_BASE,
        "OPENAI_API_KEY": settings.OPENAI_API_KEY,
        "DEFAULT_MODEL": settings.DEFAULT_MODEL,
        "REQUEST_TIMEOUT": str(settings.REQUEST_TIMEOUT),
    })

    return {
        "success": True,
        "active_profile": profile,
        "profiles": DatabaseService.list_llm_profiles(),
        "configured": settings.has_api_key,
        "message": f"已成功切换为「{profile['name']}」连接！",
    }


@app.delete("/api/llm/profiles/{profile_id}")
async def delete_llm_profile(profile_id: str):
    """Deletes an LLM profile."""
    from database import DatabaseService
    from config import save_env_updates

    DatabaseService.delete_llm_profile(profile_id)
    active_profile = DatabaseService.get_active_llm_profile()

    if active_profile:
        settings.OPENAI_API_BASE = active_profile["api_base"]
        settings.OPENAI_API_KEY = active_profile.get("api_key", "")
        settings.DEFAULT_MODEL = active_profile["default_model"]
        settings.REQUEST_TIMEOUT = float(active_profile.get("request_timeout", 60.0))
        save_env_updates({
            "OPENAI_API_BASE": settings.OPENAI_API_BASE,
            "OPENAI_API_KEY": settings.OPENAI_API_KEY,
            "DEFAULT_MODEL": settings.DEFAULT_MODEL,
            "REQUEST_TIMEOUT": str(settings.REQUEST_TIMEOUT),
        })

    return {
        "success": True,
        "profiles": DatabaseService.list_llm_profiles(),
        "active_profile": active_profile,
    }


@app.post("/api/llm/test")
async def test_llm_connection(payload: dict = None):
    """Tests the LLM connection with given settings or specified profile (supports multi-key verification)."""
    from database import DatabaseService, parse_api_keys, mask_key
    import httpx
    payload = payload or {}

    profile_id = payload.get("profile_id")
    if profile_id:
        profile = DatabaseService.get_llm_profile(profile_id)
        if profile:
            api_key = profile.get("api_key", "").strip()
            api_base = profile.get("api_base", "").strip().rstrip("/")
            model = profile.get("default_model", "").strip()
        else:
            return {"success": False, "message": "指定的连接配置不存在"}
    else:
        api_key = payload.get("api_key") or payload.get("api_keys") or ""
        # If not provided or masked placeholder, use current key
        if not api_key or (isinstance(api_key, str) and "..." in api_key):
            api_key = settings.OPENAI_API_KEY
        api_base = (payload.get("api_base", "").strip() or settings.OPENAI_API_BASE).rstrip("/")
        model = payload.get("model", "").strip() or payload.get("default_model", "").strip() or settings.DEFAULT_MODEL

    keys = parse_api_keys(api_key)
    if not keys:
        return {
            "success": False,
            "message": "请先添加至少一个 API Key / Token 再进行连通性测试！",
            "model": model,
        }

    endpoint = f"{api_base}/chat/completions"
    test_body = {
        "model": model,
        "messages": [{"role": "user", "content": "Hi, reply with 'pong'"}],
        "max_tokens": 10,
        "temperature": 0.1,
    }

    success_keys = []
    failed_keys = []

    async with httpx.AsyncClient(timeout=15.0) as client:
        for idx, key in enumerate(keys):
            auth_token = key.strip()
            auth_header = auth_token if auth_token.lower().startswith("bearer ") else f"Bearer {auth_token}"
            headers = {
                "Authorization": auth_header,
                "Content-Type": "application/json",
            }
            try:
                resp = await client.post(endpoint, headers=headers, json=test_body)
                if resp.status_code == 200:
                    data = resp.json()
                    reply = ""
                    choices = data.get("choices", [])
                    if choices:
                        reply = choices[0].get("message", {}).get("content", "").strip()
                    success_keys.append((key, reply or "pong"))
                else:
                    err_text = resp.text[:120]
                    failed_keys.append((key, f"HTTP {resp.status_code}: {err_text}"))
            except Exception as e:
                failed_keys.append((key, str(e)))

    if success_keys:
        sample_reply = success_keys[0][1]
        if len(keys) == 1:
            msg = f"连接成功！模型响应: {sample_reply}"
        else:
            msg = f"多Key测试完成：{len(success_keys)}/{len(keys)} 个 Key 连通有效！响应: {sample_reply}"
        return {
            "success": True,
            "message": msg,
            "model": model,
            "total_keys": len(keys),
            "valid_keys_count": len(success_keys),
        }
    else:
        err_detail = failed_keys[0][1] if failed_keys else "网络或认证异常"
        return {
            "success": False,
            "message": f"连接失败 (共测试 {len(keys)} 个 Key 均未连通): {err_detail}",
            "model": model,
            "total_keys": len(keys),
            "valid_keys_count": 0,
        }


@app.post("/api/llm/config")
async def update_llm_config(payload: dict):
    """Updates the LLM configuration (legacy compat)."""
    from config import save_env_updates
    from database import DatabaseService
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

    active_profile = DatabaseService.get_active_llm_profile()
    if active_profile:
        DatabaseService.update_llm_profile(active_profile["id"], {
            "api_base": settings.OPENAI_API_BASE,
            "api_key": settings.OPENAI_API_KEY,
            "default_model": settings.DEFAULT_MODEL,
            "request_timeout": settings.REQUEST_TIMEOUT,
        })

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

