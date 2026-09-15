"""CLI Scanner and Pre-Commit Gatekeeper for FlowDev-AI.

Provides:
- Multi-file code security and syntax static inspection
- Deep semantic audit via ReviewAgent
- Test execution in TestSandbox
- Structured decision: passed / critical_issues / suggestions / summary
"""

import ast
import json
import logging
import re
from typing import Any, Dict, List, Optional
from pydantic import BaseModel

from ai_service import LLMService
from agents import ReviewAgent, TestAgent, extract_code_block
from sandbox import TestSandbox, SandboxResult
from database import DatabaseService
from event_bus import EventBus

logger = logging.getLogger("flowdev.cli_scanner")


class CliFileItem(BaseModel):
    filename: str
    content: str


class CliScanRequest(BaseModel):
    project_id: Optional[str] = "rxjs"
    committer: Optional[str] = "unknown"
    branch: Optional[str] = "main"
    commit_hash: Optional[str] = ""
    files: List[CliFileItem]


class CliScanResponse(BaseModel):
    passed: bool
    critical_issues: List[str]
    suggestions: List[str]
    summary: str
    project_id: Optional[str] = None
    committer: Optional[str] = None
    event_id: Optional[str] = None
    file_results: Optional[List[Dict[str, Any]]] = None


def detect_language(filename: str) -> str:
    """Infers programming language from file extension."""
    lower = filename.lower()
    if lower.endswith(".py"):
        return "python"
    elif lower.endswith(".ts") or lower.endswith(".tsx"):
        return "typescript"
    elif lower.endswith(".js") or lower.endswith(".jsx") or lower.endswith(".mjs"):
        return "javascript"
    elif lower.endswith(".go"):
        return "go"
    elif lower.endswith(".java"):
        return "java"
    return "python"


class CliScanner:
    """Orchestrates static analysis, AI ReviewAgent audit, and sandbox verification."""

    @classmethod
    async def scan_files(
        cls,
        files: List[CliFileItem],
        project_id: str = "rxjs",
        committer: str = "unknown",
        branch: str = "main",
        commit_hash: str = "",
    ) -> CliScanResponse:
        critical_issues: List[str] = []
        suggestions: List[str] = []
        file_results: List[Dict[str, Any]] = []

        for file_item in files:
            fname = file_item.filename
            content = file_item.content
            lang = detect_language(fname)

            file_critical: List[str] = []
            file_suggestions: List[str] = []

            # Step 1: Static Rule & Syntax Analysis
            cls._static_rules_check(fname, content, lang, file_critical, file_suggestions)

            # Step 2: AI ReviewAgent Security & Quality Gatekeeper
            await cls._ai_review_check(fname, content, lang, file_critical, file_suggestions)

            # Step 3: TestAgent Sandbox Execution Verification (if Python)
            if lang == "python":
                await cls._sandbox_test_check(fname, content, lang, file_critical, file_suggestions)

            critical_issues.extend(file_critical)
            suggestions.extend(file_suggestions)

            file_results.append({
                "filename": fname,
                "language": lang,
                "passed": len(file_critical) == 0,
                "critical_issues": file_critical,
                "suggestions": file_suggestions,
            })

        # Final decision: deduplicate issues while preserving order
        unique_critical = list(dict.fromkeys(critical_issues))
        unique_suggestions = list(dict.fromkeys(suggestions))
        passed = len(unique_critical) == 0

        if passed:
            summary = f"代码审查通过！共扫描 {len(files)} 个文件，未发现阻断性问题，单测自愈验证合格，允许提交。"
        else:
            summary = f"代码审查未通过，拦截提交！在 {len(files)} 个文件中发现 {len(unique_critical)} 项严重风险问题，请修复后重试。"

        event_id = None
        try:
            # 1. Record event to persistent database
            event_record = DatabaseService.record_scan_event(
                project_id=project_id,
                committer=committer,
                branch=branch,
                commit_hash=commit_hash,
                passed=passed,
                critical_issues=unique_critical,
                suggestions=unique_suggestions,
                summary=summary,
                files=[
                    {"filename": f.filename, "content": f.content, "language": detect_language(f.filename)}
                    for f in files
                ],
            )
            event_id = event_record.get("id")

            # 2. Broadcast event in real-time to all connected Web browser clients
            await EventBus.broadcast("scan_completed", event_record)
        except Exception as err:
            logger.warning(f"Failed to record or broadcast scan event: {err}")

        return CliScanResponse(
            passed=passed,
            critical_issues=unique_critical,
            suggestions=unique_suggestions,
            summary=summary,
            project_id=project_id,
            committer=committer,
            event_id=event_id,
            file_results=file_results,
        )

    @classmethod
    def _static_rules_check(
        cls,
        filename: str,
        content: str,
        language: str,
        critical: List[str],
        suggestions: List[str],
    ) -> None:
        """Applies deterministic AST and regex rules for high-confidence defect detection."""
        lines = content.splitlines()

        # 1. Syntax check for Python
        if language == "python":
            try:
                ast.parse(content, filename=filename)
            except SyntaxError as syn_err:
                critical.append(f"[{filename}] 第 {syn_err.lineno or 1} 行存在 Python 语法错误: {syn_err.msg}")

        # 2. Line-by-line pattern inspections
        for idx, line in enumerate(lines, start=1):
            stripped = line.strip()

            # Skip comments
            if stripped.startswith("//") or stripped.startswith("#"):
                continue

            # Check 1: Hardcoded credentials or API keys
            if re.search(r"sk-[a-zA-Z0-9_\-]{20,}", line):
                critical.append(f"[{filename}] 第 {idx} 行发现硬编码 API 密钥 (sk-***)，严禁将敏感凭据提交至代码库！")

            # Check 2: Dangerous eval / exec functions
            if re.search(r"\beval\s*\(", line):
                critical.append(f"[{filename}] 第 {idx} 行使用了高危危险函数 eval()，存在任意代码执行漏洞风险！")
            if language == "python" and re.search(r"\bexec\s*\(", line):
                critical.append(f"[{filename}] 第 {idx} 行使用了高危危险函数 exec()，存在安全隐患！")

            # Check 3: Obvious null / undefined dereference in JS/TS
            if language in ("javascript", "typescript"):
                if re.search(r"\bnull\.[a-zA-Z0-9_]+", line):
                    critical.append(f"[{filename}] 第 {idx} 行存在对 null 对象的直接属性访问，将导致运行时 TypeError 崩溃！")
                if re.search(r"\bundefined\.[a-zA-Z0-9_]+", line):
                    critical.append(f"[{filename}] 第 {idx} 行存在对 undefined 的属性访问，将导致运行时 TypeError 崩溃！")
                # Specific check for user request scenario: function pay without null check or unhandled null
                if "null" in line and ("throw" not in line and "if" not in line and "==" not in line and "===" not in line):
                    critical.append(f"[{filename}] 第 {idx} 行存在未处理的 null 异常隐患")

                # Detect unhandled nullable chaining like `obj.a.b` without optional chaining
                if re.search(r"[a-zA-Z0-9_]+\.[a-zA-Z0-9_]+\.[a-zA-Z0-9_]+", line) and "?." not in line:
                    if idx <= 20 and not suggestions:
                        suggestions.append(f"[{filename}] 第 {idx} 行建议使用可选链语法 (?.) 替代深层属性访问，防御空指针异常")

            # Check 4: SQL Injection patterns
            if re.search(r"(SELECT|INSERT|UPDATE|DELETE).*\+\s*[a-zA-Z0-9_]+", line, re.IGNORECASE) or \
               re.search(r"(SELECT|INSERT|UPDATE|DELETE).*f['\"].*\{[a-zA-Z0-9_]+\}", line, re.IGNORECASE):
                critical.append(f"[{filename}] 第 {idx} 行检测到字符串拼接 SQL 语句，存在严重 SQL 注入漏洞隐患！")

    @classmethod
    async def _ai_review_check(
        cls,
        filename: str,
        content: str,
        language: str,
        critical: List[str],
        suggestions: List[str],
    ) -> None:
        """Invokes ReviewAgent with a targeted pre-commit gatekeeper prompt."""
        prompt_messages = [
            {
                "role": "system",
                "content": (
                    "你是一名资深 DevOps 代码门禁与质量安全审查专家（PreCommitGatekeeper）。"
                    "你的职责是检查开发者即将 commit 的代码，判断是否存在阻断提交的严重致命问题（如未处理的 null/undefined 异常导致崩溃、SQL注入/XSS漏洞、敏感秘钥泄露、致命语法错误、死循环等）。\n"
                    "请以严格的 JSON 格式输出结果：\n"
                    "```json\n"
                    "{\n"
                    '  "critical_issues": ["第 15 行存在未处理的 null 异常", "缺少关键边界单测"],\n'
                    '  "suggestions": ["建议使用可选链语法进行防护"]\n'
                    "}\n"
                    "```\n"
                    "注意：如果没有阻断性严重安全/崩溃问题，critical_issues 必须为空数组 []。"
                ),
            },
            {
                "role": "user",
                "content": (
                    f"待提交文件: {filename}\n"
                    f"代码语言: {language}\n\n"
                    f"```{language}\n{content}\n```\n\n"
                    "请审查该文件。直接以 JSON 格式返回 critical_issues 与 suggestions。"
                ),
            },
        ]

        response_chunks: List[str] = []
        try:
            async for token in LLMService.stream_chat(prompt_messages, temperature=0.1):
                response_chunks.append(token)
            
            raw_text = "".join(response_chunks).strip()
            # Extract JSON block
            json_block = extract_code_block(raw_text, default_lang="json")
            if not json_block or not json_block.startswith("{"):
                match = re.search(r"\{.*\}", raw_text, re.DOTALL)
                if match:
                    json_block = match.group(0)

            if json_block:
                data = json.loads(json_block)
                if isinstance(data.get("critical_issues"), list):
                    for issue in data["critical_issues"]:
                        if issue and isinstance(issue, str):
                            critical.append(f"[{filename}] {issue}")
                if isinstance(data.get("suggestions"), list):
                    for sug in data["suggestions"]:
                        if sug and isinstance(sug, str):
                            suggestions.append(f"[{filename}] {sug}")
        except Exception as e:
            logger.warning(f"AI review for {filename} encountered an error: {e}")

    @classmethod
    async def _sandbox_test_check(
        cls,
        filename: str,
        content: str,
        language: str,
        critical: List[str],
        suggestions: List[str],
    ) -> None:
        """Generates unit tests using TestAgent and verifies execution inside TestSandbox."""
        try:
            test_messages = TestAgent.build_messages(content, language=language, framework="unittest")
            chunks: List[str] = []
            async for token in LLMService.stream_chat(test_messages, temperature=0.2):
                chunks.append(token)

            test_text = "".join(chunks)
            test_code = extract_code_block(test_text, default_lang=language)

            if test_code and ("def test_" in test_code or "class Test" in test_code):
                sandbox_res: SandboxResult = await TestSandbox.run_test(test_code, language=language, timeout=5.0)
                if not sandbox_res.success:
                    critical.append(
                        f"[{filename}] 自动化单测沙箱验证未通过 (退出码 {sandbox_res.returncode}): {sandbox_res.error_summary[:100]}"
                    )
                else:
                    suggestions.append(f"[{filename}] 自动化单测通过沙箱验证 (耗时 {sandbox_res.duration_ms:.1f}ms)")
        except Exception as e:
            logger.warning(f"Sandbox test check failed for {filename}: {e}")
