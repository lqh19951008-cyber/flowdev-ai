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


class ProjectGatePolicy:
    """Parsed and normalized quality gate policy for a specific project."""

    def __init__(self, raw_policy: Any):
        self.file_patterns: List[str] = ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx", "**/*.py", "**/*.go", "**/*.java"]
        self.ignored_dirs: List[str] = [
            "node_modules",
            "dist",
            ".next",
            "build",
            "out",
            "coverage",
            ".git",
            "__pycache__",
            ".pytest_cache",
            ".venv",
            "venv",
            "env",
            "vendor",
            "third_party",
            ".agents",
            ".agent",
            ".idea",
            ".vscode",
            ".turbo",
            ".cache",
            "temp",
            "tmp",
            "output",
        ]
        self.max_file_size_kb: int = 1000

        # Rule switches
        self.block_null_deref: bool = True
        self.block_dangerous_eval: bool = True
        self.block_sql_injection: bool = True
        self.block_hardcoded_secrets: bool = True
        self.severity_level: str = "standard"  # "strict", "standard", "relaxed"
        self.review_aspects: List[str] = ["代码安全", "空指针与运行时崩溃", "高危漏洞"]
        self.custom_prompt: str = ""
        self.ai_review_enabled: bool = True

        # Test Runner
        self.test_generator_enabled: bool = False
        self.enforce_tests: bool = False
        self.test_framework: str = "pytest"
        self.sandbox_timeout_sec: float = 5.0

        # Gatekeeper master switch & action & notifier
        self.gate_enabled: bool = True
        self.failure_action: str = "block_commit"  # "block_commit", "warn_only", "disabled", "create_review_pr"
        self.notify_channel: str = "feishu"  # "feishu", "none"

        # Custom learned rules & Agent skills
        self.custom_rules: List[Dict[str, Any]] = []
        self.agent_skills: List[Dict[str, Any]] = []

        self._parse(raw_policy)

    def _parse(self, raw_policy: Any) -> None:
        if not raw_policy:
            return
        if isinstance(raw_policy, str):
            try:
                raw_policy = json.loads(raw_policy)
            except Exception:
                return
        if not isinstance(raw_policy, dict):
            return

        # Master switch and failure action root overrides
        if "gate_enabled" in raw_policy:
            self.gate_enabled = bool(raw_policy["gate_enabled"])
        if "enabled" in raw_policy:
            self.gate_enabled = bool(raw_policy["enabled"])
        if "failure_action" in raw_policy:
            self.failure_action = str(raw_policy["failure_action"])
        elif "failureAction" in raw_policy:
            self.failure_action = str(raw_policy["failureAction"])
        if self.failure_action == "disabled":
            self.gate_enabled = False

        # 0. Custom learned rules & Agent skills
        if isinstance(raw_policy.get("custom_rules"), list):
            self.custom_rules = raw_policy["custom_rules"]
        if isinstance(raw_policy.get("agent_skills"), list):
            self.agent_skills = raw_policy["agent_skills"]

        # 1. Preset handling
        preset = raw_policy.get("preset")
        if preset == "fast_lint":
            self.ai_review_enabled = False
            self.enforce_tests = False
            self.block_null_deref = True
            self.block_dangerous_eval = True
        elif preset == "security_audit":
            self.ai_review_enabled = True
            self.severity_level = "strict"
            self.block_sql_injection = True
            self.block_hardcoded_secrets = True
            self.block_dangerous_eval = True
            self.enforce_tests = False
        elif preset == "full_review_heal":
            self.ai_review_enabled = True
            self.enforce_tests = True
            self.test_generator_enabled = True

        # 2. DAG Nodes handling (takes precedence if custom nodes configured)
        nodes = raw_policy.get("nodes")
        if isinstance(nodes, list) and len(nodes) > 0:
            has_llm = False
            has_test = False

            for node in nodes:
                if not isinstance(node, dict):
                    continue
                node_type = node.get("type")
                cfg = node.get("data", {}).get("config", {}) if isinstance(node.get("data"), dict) else node.get("config", {})
                if not isinstance(cfg, dict):
                    cfg = {}

                if node_type == "code_input":
                    if cfg.get("filePatterns") and isinstance(cfg["filePatterns"], list):
                        self.file_patterns = cfg["filePatterns"]
                    if cfg.get("ignoredDirs") and isinstance(cfg["ignoredDirs"], list):
                        self.ignored_dirs = cfg["ignoredDirs"]
                    if cfg.get("maxFileSizeKb"):
                        try:
                            self.max_file_size_kb = int(cfg["maxFileSizeKb"])
                        except Exception:
                            pass

                elif node_type == "llm_review":
                    has_llm = True
                    self.severity_level = cfg.get("severityLevel", self.severity_level)
                    self.block_null_deref = bool(cfg.get("blockNullDeref", True))
                    self.block_dangerous_eval = bool(cfg.get("blockDangerousEval", True))
                    self.block_sql_injection = bool(cfg.get("blockSqlInjection", True))
                    self.block_hardcoded_secrets = bool(cfg.get("blockHardcodedSecrets", True))
                    if cfg.get("reviewAspects") and isinstance(cfg["reviewAspects"], list):
                        self.review_aspects = cfg["reviewAspects"]
                    if cfg.get("promptTemplate"):
                        self.custom_prompt = str(cfg["promptTemplate"])

                elif node_type == "test_generator":
                    has_test = True
                    self.enforce_tests = bool(cfg.get("enforceTests", True))
                    self.test_framework = cfg.get("framework", "pytest")
                    if cfg.get("sandboxTimeoutSec"):
                        try:
                            self.sandbox_timeout_sec = float(cfg["sandboxTimeoutSec"])
                        except Exception:
                            pass

                elif node_type == "diff_export":
                    self.failure_action = cfg.get("failureAction", "block_commit")
                    self.notify_channel = cfg.get("notifyChannel", "feishu")

            self.ai_review_enabled = has_llm
            self.test_generator_enabled = has_test


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
        # 0. Load project-specific gate policy from database
        raw_policy = DatabaseService.get_project_policy(project_id)
        policy = ProjectGatePolicy(raw_policy)
        logger.info(
            f"Enforcing gate policy for project '{project_id}': "
            f"ai_review={policy.ai_review_enabled}, "
            f"null_check={policy.block_null_deref}, "
            f"eval_check={policy.block_dangerous_eval}, "
            f"sql_check={policy.block_sql_injection}, "
            f"secrets_check={policy.block_hardcoded_secrets}, "
            f"enforce_tests={policy.enforce_tests}, "
            f"failure_action={policy.failure_action}, "
            f"notify_channel={policy.notify_channel}"
        )

        # Check if gatekeeper is disabled for this project
        if not policy.gate_enabled or policy.failure_action == "disabled":
            logger.info(f"Gatekeeper is disabled for project '{project_id}', bypassing review immediately.")
            return CliScanResponse(
                passed=True,
                critical_issues=[],
                suggestions=[],
                summary="门禁已处于关闭状态（项目配置为放行模式），快速放行本次提交。",
                project_id=project_id,
                committer=committer,
                file_results=[],
            )

        critical_issues: List[str] = []
        suggestions: List[str] = []
        file_results: List[Dict[str, Any]] = []

        for file_item in files:
            fname = file_item.filename
            content = file_item.content
            lang = detect_language(fname)

            # Check if file should be ignored based on project policy
            is_ignored = False
            for ignored in policy.ignored_dirs:
                if f"/{ignored}/" in f"/{fname}/" or f"\\{ignored}\\" in f"\\{fname}\\":
                    is_ignored = True
                    break
            if is_ignored:
                continue

            # Check if file matches ignored extensions or generated patterns
            lower_fname = fname.lower().replace("\\", "/")
            if (
                lower_fname.endswith(".d.ts")
                or lower_fname.endswith(".d.ts.map")
                or ".min." in lower_fname
                or lower_fname.endswith(".bundle.js")
                or lower_fname.endswith(".chunk.js")
                or ".generated." in lower_fname
                or ".pb." in lower_fname
                or lower_fname.endswith(".snap")
                or lower_fname.endswith("next-env.d.ts")
            ):
                continue

            file_critical: List[str] = []
            file_suggestions: List[str] = []

            # Step 1: Static Rule & Syntax Analysis (filtered by project policy switches)
            cls._static_rules_check(fname, content, lang, file_critical, file_suggestions, policy)

            # Step 2: AI ReviewAgent Security & Quality Gatekeeper (if enabled for this project)
            if policy.ai_review_enabled:
                await cls._ai_review_check(fname, content, lang, file_critical, file_suggestions, policy)

            # Step 3: TestAgent Sandbox Execution Verification (if enabled for this project & python)
            if policy.test_generator_enabled and policy.enforce_tests and lang == "python":
                await cls._sandbox_test_check(fname, content, lang, file_critical, file_suggestions, policy)

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

        # Gate decision based on project's failure_action configuration
        if policy.failure_action == "warn_only":
            passed = True
            if unique_critical:
                summary = f"代码审查完成 (项目配置为警告模式，不阻断提交)！在 {len(files)} 个文件中发现 {len(unique_critical)} 项优化建议与警告。"
            else:
                summary = f"代码审查通过！共扫描 {len(files)} 个文件，未发现阻断性问题。"
        elif policy.failure_action == "create_review_pr":
            passed = (len(unique_critical) == 0)
            if not passed:
                summary = f"代码提交已拦截 (强制人工 PR 评审模式)！在 {len(files)} 个文件中发现 {len(unique_critical)} 项阻断缺陷。"
            else:
                summary = f"代码审查通过！共扫描 {len(files)} 个文件，未发现阻断性问题。"
        else:  # "block_commit"
            passed = (len(unique_critical) == 0)
            if passed:
                summary = f"代码审查通过！共扫描 {len(files)} 个文件，未发现阻断性问题，允许提交。"
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

            # 3. Dispatch interactive card notification to Feishu developer group (if channel not none)
            if policy.notify_channel != "none":
                try:
                    from feishu_notifier import FeishuNotifier
                except ImportError:
                    from backend.feishu_notifier import FeishuNotifier
                await FeishuNotifier.send_audit_card(
                    project_id=project_id,
                    committer=committer,
                    branch=branch,
                    passed=passed,
                    critical_issues=unique_critical,
                    suggestions=unique_suggestions,
                    summary=summary,
                    files_count=len(files),
                )
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
        policy: ProjectGatePolicy,
    ) -> None:
        """Applies deterministic AST and regex rules according to the project's gate policy."""
        lines = content.splitlines()

        # 1. Syntax check for Python
        if language == "python":
            try:
                ast.parse(content, filename=filename)
            except SyntaxError as syn_err:
                critical.append(f"[{filename}] 第 {syn_err.lineno or 1} 行存在 Python 语法错误: {syn_err.msg}")

        # 2. Line-by-line pattern inspections controlled by project policy
        for idx, line in enumerate(lines, start=1):
            stripped = line.strip()

            # Skip comments
            if stripped.startswith("//") or stripped.startswith("#"):
                continue

            # Check 1: Hardcoded credentials or API keys (if enabled)
            if policy.block_hardcoded_secrets:
                if re.search(r"sk-[a-zA-Z0-9_\-]{20,}", line) or re.search(r"AKIA[0-9A-Z]{16}", line):
                    critical.append(f"[{filename}] 第 {idx} 行发现硬编码 API 密钥/凭证，严禁将敏感密钥提交至代码库！")

            # Check 2: Dangerous eval / exec functions (if enabled)
            if policy.block_dangerous_eval:
                if re.search(r"\beval\s*\(", line):
                    critical.append(f"[{filename}] 第 {idx} 行使用了高危危险函数 eval()，存在任意代码执行漏洞风险！")
                if language == "python" and re.search(r"\bexec\s*\(", line):
                    critical.append(f"[{filename}] 第 {idx} 行使用了高危危险函数 exec()，存在安全隐患！")

            # Check 3: Null / undefined dereference in JS/TS (if enabled)
            if policy.block_null_deref and language in ("javascript", "typescript"):
                if re.search(r"\bnull\.[a-zA-Z0-9_]+", line):
                    critical.append(f"[{filename}] 第 {idx} 行存在对 null 对象的直接属性访问，将导致运行时 TypeError 崩溃！")
                if re.search(r"\bundefined\.[a-zA-Z0-9_]+", line):
                    critical.append(f"[{filename}] 第 {idx} 行存在对 undefined 的属性访问，将导致运行时 TypeError 崩溃！")
                # Specific check for unhandled null in payments/handlers
                if "null" in line and ("throw" not in line and "if" not in line and "==" not in line and "===" not in line):
                    critical.append(f"[{filename}] 第 {idx} 行存在未处理的 null 异常隐患")

                # Detect unhandled nullable chaining like `obj.a.b` without optional chaining
                if re.search(r"[a-zA-Z0-9_]+\.[a-zA-Z0-9_]+\.[a-zA-Z0-9_]+", line) and "?." not in line:
                    if idx <= 20 and not suggestions:
                        suggestions.append(f"[{filename}] 第 {idx} 行建议使用可选链语法 (?.) 替代深层属性访问，防御空指针异常")

            # Check 4: SQL Injection patterns (if enabled)
            if policy.block_sql_injection:
                if re.search(r"(SELECT|INSERT|UPDATE|DELETE).*\+\s*[a-zA-Z0-9_]+", line, re.IGNORECASE) or \
                   re.search(r"(SELECT|INSERT|UPDATE|DELETE).*f['\"].*\{[a-zA-Z0-9_]+\}", line, re.IGNORECASE):
                    critical.append(f"[{filename}] 第 {idx} 行检测到字符串拼接 SQL 语句，存在严重 SQL 注入漏洞隐患！")

            # Check 5: Project Learned & Custom Rules (AI-synthesized from historical defects)
            for rule in policy.custom_rules:
                pat = rule.get("pattern")
                if pat and isinstance(pat, str):
                    try:
                        if re.search(pat, line):
                            msg = rule.get("message") or f"违反仓库沉淀规则: {rule.get('title', '质量卡点规范')}"
                            if rule.get("level", "critical") == "critical":
                                critical.append(f"[{filename}] 第 {idx} 行 {msg}")
                            else:
                                suggestions.append(f"[{filename}] 第 {idx} 行 {msg}")
                    except Exception:
                        pass

    @classmethod
    async def _ai_review_check(
        cls,
        filename: str,
        content: str,
        language: str,
        critical: List[str],
        suggestions: List[str],
        policy: ProjectGatePolicy,
    ) -> None:
        """Invokes ReviewAgent configured with the project's customized prompt and severity."""
        aspects_str = "、".join(policy.review_aspects) if policy.review_aspects else "安全漏洞、崩溃风险与核心质量"
        custom_instructions = f"\n额外审查指令: {policy.custom_prompt}" if policy.custom_prompt else ""
        if policy.agent_skills:
            skills_summary = "\n【仓库沉淀的历史 Agent Skills 约束】:\n" + "\n".join(
                f"- {s.get('title')}: {s.get('summary')}" for s in policy.agent_skills if s.get("title")
            )
            custom_instructions += skills_summary
        
        strictness_note = "严格模式：发现任何明确代码缺陷均放入 critical_issues" if policy.severity_level == "strict" else (
            "宽松模式：仅针对导致系统崩溃的致命缺陷放入 critical_issues，常规问题放入 suggestions" if policy.severity_level == "relaxed" else
            "标准模式：仅针对严重缺陷（空指针未处理、高危注入、敏感秘钥泄露）放入 critical_issues"
        )

        prompt_messages = [
            {
                "role": "system",
                "content": (
                    f"你是一名资深 DevOps 代码门禁审查专家（PreCommitGatekeeper）。\n"
                    f"重点审查维度：{aspects_str}。\n"
                    f"审查卡点标准：{strictness_note}。{custom_instructions}\n"
                    "请以严格的 JSON 格式输出结果：\n"
                    "```json\n"
                    "{\n"
                    '  "critical_issues": ["第 15 行存在未处理的 null 异常导致运行时崩溃"],\n'
                    '  "suggestions": ["建议使用可选链语法进行防护"]\n'
                    "}\n"
                    "```\n"
                    "注意：若无阻断提交的严重缺陷，critical_issues 必须为空数组 []。"
                ),
            },
            {
                "role": "user",
                "content": (
                    f"待提交文件: {filename}\n"
                    f"代码语言: {language}\n\n"
                    f"```{language}\n{content}\n```\n\n"
                    "请根据项目门禁策略审查该文件，直接以 JSON 格式返回 critical_issues 与 suggestions。"
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
                try:
                    data = json.loads(json_block)
                except Exception:
                    data = {}
                data_dict = data if isinstance(data, dict) else {}
                critical_list = data_dict.get("critical_issues") or []
                if isinstance(critical_list, list):
                    for issue in critical_list:
                        if issue and isinstance(issue, str):
                            critical.append(f"[{filename}] {issue}")
                suggestions_list = data_dict.get("suggestions") or []
                if isinstance(suggestions_list, list):
                    for sug in suggestions_list:
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
        policy: ProjectGatePolicy,
    ) -> None:
        """Generates unit tests and verifies execution inside TestSandbox per project policy."""
        try:
            test_messages = TestAgent.build_messages(content, language=language, framework=policy.test_framework)
            chunks: List[str] = []
            async for token in LLMService.stream_chat(test_messages, temperature=0.2):
                chunks.append(token)

            test_text = "".join(chunks)
            test_code = extract_code_block(test_text, default_lang=language)

            if test_code and ("def test_" in test_code or "class Test" in test_code):
                sandbox_res: SandboxResult = await TestSandbox.run_test(
                    test_code,
                    language=language,
                    timeout=policy.sandbox_timeout_sec,
                )
                if not sandbox_res.success:
                    critical.append(
                        f"[{filename}] 自动化单测沙箱验证未通过 (退出码 {sandbox_res.returncode}): {sandbox_res.error_summary[:100]}"
                    )
                else:
                    suggestions.append(f"[{filename}] 自动化单测通过沙箱验证 (耗时 {sandbox_res.duration_ms:.1f}ms)")
        except Exception as e:
            logger.warning(f"Sandbox test check failed for {filename}: {e}")
