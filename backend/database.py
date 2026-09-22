"""SQLite Database Layer for Multi-Tenant Projects and Audit History."""

import json
import os
import re
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

DB_PATH = Path(__file__).parent / "flowdev.db"


def parse_api_keys(raw_key: Any) -> List[str]:
    """Parses single or multiple API keys from string, list, or newline/comma separated text."""
    if not raw_key:
        return []
    if isinstance(raw_key, list):
        keys = []
        for item in raw_key:
            keys.extend(parse_api_keys(item))
        return [k for k in keys if k]
    parts = [k.strip() for k in re.split(r'[\r\n,;]+', str(raw_key)) if k.strip()]
    return parts


def mask_key(k: str) -> str:
    """Returns safe masked key representation."""
    if not k:
        return ""
    if len(k) > 8:
        return f"{k[:4]}...{k[-4:]}"
    return "********"


def _bump_semver(current: str) -> str:
    """Increments a simple semver MAJOR.MINOR.PATCH string by 1 on the PATCH field.

    Examples:
        1.2.3  -> 1.2.4
        v0.0.0 -> 0.0.1
        empty  -> 0.0.1
    Falls back to "0.0.1" if parsing fails.
    """
    raw = (current or "").strip().lstrip("v")
    if not raw:
        return "0.0.1"
    parts = raw.split(".")
    while len(parts) < 3:
        parts.append("0")
    try:
        major = int(parts[0])
        minor = int(parts[1])
        patch = int(parts[2]) + 1
    except (ValueError, TypeError):
        return "0.0.1"
    return f"{major}.{minor}.{patch}"


def get_utc_now_iso() -> str:
    """Returns current UTC time in ISO-8601 format with Z timezone indicator."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def normalize_iso_timestamp(ts: Optional[str]) -> Optional[str]:
    """Ensures timestamp has standard UTC indicator if missing."""
    if not ts:
        return ts
    clean_ts = ts.strip()
    if clean_ts and not clean_ts.endswith("Z") and "+" not in clean_ts and "-" not in clean_ts[10:]:
        return f"{clean_ts}Z"
    return clean_ts


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Initializes tables if they do not exist."""
    with get_connection() as conn:
        cursor = conn.cursor()

        # Projects Table
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT DEFAULT '',
                policy_dag_json TEXT DEFAULT '{}',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )

        # ----- Schema migration: add push-related version columns if missing -----
        # SQLite does not support IF NOT EXISTS for ADD COLUMN, so we introspect
        # the table schema first and only alter when needed. This is idempotent
        # and safe to run on every boot.
        cursor.execute("PRAGMA table_info(projects)")
        existing_cols = {row["name"] for row in cursor.fetchall()}

        def _safe_add_column(col_name: str, col_ddl: str) -> None:
            if col_name not in existing_cols:
                try:
                    cursor.execute(f"ALTER TABLE projects ADD COLUMN {col_ddl}")
                except Exception:
                    # Best-effort migration; never break startup.
                    pass

        _safe_add_column("policy_version", "policy_version TEXT DEFAULT '0.0.0'")
        _safe_add_column("pending_push_version", "pending_push_version TEXT DEFAULT NULL")
        _safe_add_column("push_enabled", "push_enabled INTEGER DEFAULT 1")
        _safe_add_column("last_pushed_at", "last_pushed_at TEXT DEFAULT NULL")
        _safe_add_column("last_applied_at", "last_applied_at TEXT DEFAULT NULL")
        _safe_add_column("last_applied_version", "last_applied_version TEXT DEFAULT '0.0.0'")
        _safe_add_column("last_pushed_changelog", "last_pushed_changelog TEXT DEFAULT NULL")
        # Soft-delete / tombstone. Kept instead of a hard DELETE so that a
        # local Git hook that still references a removed project can be told
        # "this project was deliberately removed" instead of resurrecting it
        # (which used to happen on every commit with the strictest default
        # policy and kept blocking commits forever).
        _safe_add_column("deleted_at", "deleted_at TEXT DEFAULT NULL")

        # Scan Events Table
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS scan_events (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                committer TEXT DEFAULT 'unknown',
                branch TEXT DEFAULT 'main',
                commit_hash TEXT DEFAULT '',
                passed INTEGER NOT NULL,
                critical_issues_json TEXT NOT NULL,
                suggestions_json TEXT NOT NULL,
                summary TEXT NOT NULL,
                files_count INTEGER DEFAULT 1,
                files_detail_json TEXT DEFAULT '[]',
                created_at TEXT NOT NULL,
                FOREIGN KEY (project_id) REFERENCES projects (id)
            )
            """
        )

        # Seed default project if empty
        cursor.execute("SELECT COUNT(*) FROM projects")
        count = cursor.fetchone()[0]
        if count == 0:
            now = get_utc_now_iso()
            cursor.execute(
                """
                INSERT INTO projects (id, name, description, policy_dag_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    "rxjs",
                    "RxJS 表单联动模板项目",
                    "React + TypeScript + HeroUI + RxJS 企业级前端项目",
                    json.dumps({"preset": "full_review_heal"}),
                    now,
                    now,
                ),
            )
            cursor.execute(
                """
                INSERT INTO projects (id, name, description, policy_dag_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    "flowdev-ai",
                    "FlowDev-AI 核心平台",
                    "可视化多 Agent 代码审查与自动化单测生成平台",
                    json.dumps({"preset": "full_review_heal"}),
                    now,
                    now,
                ),
            )
        # LLM Profiles Table
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS llm_profiles (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                provider_type TEXT DEFAULT 'custom',
                api_base TEXT NOT NULL,
                api_key TEXT DEFAULT '',
                default_model TEXT NOT NULL,
                request_timeout REAL DEFAULT 60.0,
                is_active INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )

        # Seed default profiles if empty
        cursor.execute("SELECT COUNT(*) FROM llm_profiles")
        profile_count = cursor.fetchone()[0]
        if profile_count == 0:
            now = get_utc_now_iso()
            default_profiles = [
                (
                    "profile_asiainfo",
                    "🏢 亚信企业网关 (内网专线)",
                    "custom",
                    "https://tokenerpgw.asiainfo.com/erp/v1",
                    "",
                    "AI/deekseek-v4-flash-0731",
                    60.0,
                    1,
                    now,
                    now,
                ),
                (
                    "profile_deepseek",
                    "⚡ DeepSeek 官方直连",
                    "deepseek",
                    "https://api.deepseek.com/v1",
                    "",
                    "deepseek-chat",
                    60.0,
                    0,
                    now,
                    now,
                ),
                (
                    "profile_openai",
                    "🌐 OpenAI 官方 API",
                    "openai",
                    "https://api.openai.com/v1",
                    "",
                    "gpt-4o",
                    60.0,
                    0,
                    now,
                    now,
                ),
                (
                    "profile_aliyun",
                    "☁️ 阿里通义千问 (DashScope)",
                    "aliyun",
                    "https://dashscope.aliyuncs.com/compatible-mode/v1",
                    "",
                    "qwen-plus",
                    60.0,
                    0,
                    now,
                    now,
                ),
                (
                    "profile_siliconflow",
                    "🚀 硅基流动 SiliconFlow",
                    "siliconflow",
                    "https://api.siliconflow.cn/v1",
                    "",
                    "deepseek-ai/DeepSeek-V3",
                    60.0,
                    0,
                    now,
                    now,
                ),
            ]
            cursor.executemany(
                """
                INSERT INTO llm_profiles (id, name, provider_type, api_base, api_key, default_model, request_timeout, is_active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                default_profiles,
            )

        conn.commit()

# Initialize database schema on module load
init_db()



class DatabaseService:
    """High-level database access service."""

    @classmethod
    def get_project(cls, project_id: str, include_deleted: bool = False) -> Optional[Dict[str, Any]]:
        """Fetches a single project row. Returns None when absent (or soft-deleted).

        This is the *read* primitive; it never creates anything.
        """
        clean_id = (project_id or "").strip()
        if not clean_id:
            return None
        with get_connection() as conn:
            cursor = conn.cursor()
            if include_deleted:
                cursor.execute("SELECT * FROM projects WHERE id = ?", (clean_id,))
            else:
                cursor.execute(
                    "SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL",
                    (clean_id,),
                )
            row = cursor.fetchone()
            return dict(row) if row else None

    @classmethod
    def get_or_create_project(
        cls, project_id: str, name: Optional[str] = None, include_deleted: bool = False
    ) -> Optional[Dict[str, Any]]:
        """Ensures a project exists, auto-creating it if it is genuinely new.

        Soft-deleted projects are deliberately NOT resurrected here: they keep
        their tombstone until an explicit `create_project` call re-adds them.
        Returns None for a soft-deleted project instead of a fresh strict row.
        """
        clean_id = (project_id or "").strip() or "default-project"

        existing = cls.get_project(clean_id, include_deleted=include_deleted)
        if existing:
            return existing

        # Row exists but was soft-deleted -> do not silently recreate it.
        if cls.get_project(clean_id, include_deleted=True):
            return None

        now = get_utc_now_iso()
        display_name = name or clean_id
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO projects (id, name, description, policy_dag_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (clean_id, display_name, f"自动识别的代码仓库: {clean_id}", "{}", now, now),
            )
            conn.commit()
        return cls.get_project(clean_id)

    @classmethod
    def create_project(
        cls,
        project_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        failure_action: Optional[str] = "block_commit",
        preset_id: Optional[str] = None,
        policy_dag: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Creates a new project in the database with configured gate mode and initial DAG policy."""
        clean_id = project_id.strip()
        if not clean_id:
            raise ValueError("项目标识 (project_id) 不能为空")

        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM projects WHERE id = ?", (clean_id,))
            row = cursor.fetchone()
            if row and not row["deleted_at"]:
                return dict(row)

            now = get_utc_now_iso()
            display_name = (name or "").strip() or clean_id
            desc = (description or "").strip() or f"接入的代码仓库: {clean_id}"
            action = failure_action if failure_action in ("block_commit", "warn_only", "disabled") else "block_commit"
            initial_policy: Dict[str, Any] = {
                "gate_enabled": action != "disabled",
                "failure_action": action,
            }
            if preset_id:
                initial_policy["preset"] = preset_id
            if policy_dag and isinstance(policy_dag, dict):
                initial_policy.update(policy_dag)
                initial_policy["gate_enabled"] = action != "disabled"
                initial_policy["failure_action"] = action

            if row:
                # Re-adding a previously removed project: clear the tombstone
                # and reset it to the freshly requested policy.
                cursor.execute(
                    """
                    UPDATE projects
                    SET name = ?, description = ?, policy_dag_json = ?,
                        deleted_at = NULL, updated_at = ?,
                        policy_version = '0.0.0', pending_push_version = NULL,
                        last_applied_version = '0.0.0', last_applied_at = NULL
                    WHERE id = ?
                    """,
                    (display_name, desc, json.dumps(initial_policy, ensure_ascii=False), now, clean_id),
                )
                conn.commit()
                return {
                    "id": clean_id,
                    "name": display_name,
                    "description": desc,
                    "policy_dag_json": json.dumps(initial_policy, ensure_ascii=False),
                    "created_at": row["created_at"] or now,
                    "updated_at": now,
                }

            cursor.execute(
                """
                INSERT INTO projects (id, name, description, policy_dag_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (clean_id, display_name, desc, json.dumps(initial_policy, ensure_ascii=False), now, now),
            )
            conn.commit()
            return {
                "id": clean_id,
                "name": display_name,
                "description": desc,
                "policy_dag_json": json.dumps(initial_policy, ensure_ascii=False),
                "created_at": now,
                "updated_at": now,
            }

    @classmethod
    def delete_project(cls, project_id: str) -> bool:
        """Removes a project and all of its audit history.

        The project row itself is soft-deleted (tombstoned) so a local repo that
        still has the FlowDev pre-commit hook installed can detect the removal
        and self-detach instead of the server resurrecting it. But the project's
        scan events / audit records are HARD DELETED — deleting a project should
        not leave orphaned records behind in dashboards or leaderboards.

        Re-adding the same id via `create_project` restores it cleanly.
        """
        clean_id = project_id.strip()
        if not clean_id:
            return False

        now = get_utc_now_iso()
        with get_connection() as conn:
            cursor = conn.cursor()
            # Purge all audit records belonging to this project first.
            cursor.execute("DELETE FROM scan_events WHERE project_id = ?", (clean_id,))
            cursor.execute(
                """
                UPDATE projects
                SET deleted_at = ?, pending_push_version = NULL, updated_at = ?
                WHERE id = ? AND deleted_at IS NULL
                """,
                (now, now, clean_id),
            )
            conn.commit()
            return cursor.rowcount > 0

    @classmethod
    def list_projects_with_stats(cls) -> List[Dict[str, Any]]:
        """Returns all projects accompanied by their scan count, pass rate, and last scan."""
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT 
                    p.id, 
                    p.name, 
                    p.description, 
                    p.policy_dag_json,
                    p.updated_at,
                    COUNT(e.id) as total_scans,
                    SUM(CASE WHEN e.passed = 1 THEN 1 ELSE 0 END) as passed_scans,
                    MAX(e.created_at) as last_scan_at
                FROM projects p
                LEFT JOIN scan_events e ON p.id = e.project_id
                WHERE p.deleted_at IS NULL
                GROUP BY p.id
                ORDER BY p.updated_at DESC
                """
            )
            results = []
            for row in cursor.fetchall():
                total = row["total_scans"] or 0
                passed = row["passed_scans"] or 0
                pass_rate = round((passed / total * 100), 1) if total > 0 else 100.0
                policy = json.loads(row["policy_dag_json"] or "{}")
                gate_enabled = policy.get("gate_enabled", True) if policy.get("enabled") is None else policy.get("enabled", True)
                failure_action = policy.get("failure_action") or policy.get("failureAction") or "block_commit"
                if not gate_enabled:
                    failure_action = "disabled"
                results.append({
                    "id": row["id"],
                    "name": row["name"],
                    "description": row["description"],
                    "policy": policy,
                    "gate_enabled": gate_enabled and failure_action != "disabled",
                    "failure_action": failure_action,
                    "total_scans": total,
                    "passed_scans": passed,
                    "pass_rate": pass_rate,
                    "last_scan_at": normalize_iso_timestamp(row["last_scan_at"]),
                })
            return results

    @classmethod
    def get_project_policy(cls, project_id: str) -> Optional[Dict[str, Any]]:
        """Fetches the parsed policy DAG dictionary for a project.

        Returns None when the project does not exist or has been removed.
        This is a READ path and must never auto-create a project — doing so
        resurrected deleted projects with an empty policy (which falls back to
        the strictest defaults) and kept blocking commits indefinitely.
        """
        project = cls.get_project(project_id)
        if not project:
            return None
        raw_json = project.get("policy_dag_json") or "{}"
        try:
            return json.loads(raw_json)
        except Exception:
            return {}

    @classmethod
    def list_projects_health_matrix(cls, days: int = 7) -> List[Dict[str, Any]]:
        """Aggregated health snapshot per project over the last `days` days.

        Powers the gatekeeper's multi-project health matrix view. Each row
        is designed to be (a) glanceable for at-a-glance triage, and
        (b) directly selectable for cross-project rule synthesis.

        Fields:
          - id, name, description, failure_action, push_enabled
          - latest_version, last_applied_version, pending_push_version
          - total_events_7d, critical_events_7d, pass_rate_7d
          - last_scan_at, last_critical_at
          - top_files_7d: most-frequent critical files
          - top_issues_7d: most-frequent critical issue patterns
          - recent_event_ids: event ids the gatekeeper can drill into
        """
        from datetime import datetime, timezone, timedelta
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT p.id, p.name, p.description, p.policy_dag_json,
                       p.policy_version, p.last_applied_version,
                       p.pending_push_version, p.push_enabled,
                       p.last_pushed_at, p.last_applied_at, p.updated_at
                FROM projects p
                WHERE p.deleted_at IS NULL
                ORDER BY p.updated_at DESC
                """
            )
            projects = cursor.fetchall()

            results: List[Dict[str, Any]] = []
            for prow in projects:
                pid = prow["id"]
                # Aggregate scan_events in the window
                cursor.execute(
                    """
                    SELECT id, passed, critical_issues_json, summary, created_at
                    FROM scan_events
                    WHERE project_id = ? AND created_at >= ?
                    ORDER BY created_at DESC
                    """,
                    (pid, cutoff),
                )
                ev_rows = cursor.fetchall()
                total_7d = len(ev_rows)
                critical_7d = sum(1 for r in ev_rows if not r["passed"])
                passed_7d = total_7d - critical_7d
                pass_rate_7d = round((passed_7d / total_7d * 100), 1) if total_7d else 100.0
                last_scan_at = ev_rows[0]["created_at"] if ev_rows else None
                last_critical_at = next(
                    (r["created_at"] for r in ev_rows if not r["passed"]),
                    None,
                )

                # Aggregate critical issues to find patterns
                file_counter: Dict[str, int] = {}
                issue_counter: Dict[str, int] = {}
                recent_event_ids: List[str] = []
                for r in ev_rows:
                    recent_event_ids.append(r["id"])
                    if r["passed"]:
                        continue
                    try:
                        issues = json.loads(r["critical_issues_json"] or "[]")
                    except Exception:
                        issues = []
                    for iss in issues:
                        iss_str = str(iss)
                        # Extract file token if present
                        import re
                        m = re.match(r"^\s*\[([^\]]+)\]\s*(.*)", iss_str)
                        if m:
                            fname = m.group(1)
                            file_counter[fname] = file_counter.get(fname, 0) + 1
                            tail = m.group(2).strip()
                            # Use a 50-char issue signature
                            sig = (tail[:50] + "…") if len(tail) > 50 else tail
                            issue_counter[sig] = issue_counter.get(sig, 0) + 1
                        else:
                            sig = (iss_str[:50] + "…") if len(iss_str) > 50 else iss_str
                            issue_counter[sig] = issue_counter.get(sig, 0) + 1

                top_files_7d = sorted(
                    [{"file": k, "count": v} for k, v in file_counter.items()],
                    key=lambda x: -x["count"],
                )[:5]
                top_issues_7d = sorted(
                    [{"issue": k, "count": v} for k, v in issue_counter.items()],
                    key=lambda x: -x["count"],
                )[:8]

                policy = json.loads(prow["policy_dag_json"] or "{}")
                gate_enabled = policy.get("gate_enabled", True) if policy.get("enabled") is None else policy.get("enabled", True)
                failure_action = policy.get("failure_action") or policy.get("failureAction") or "block_commit"
                if not gate_enabled:
                    failure_action = "disabled"

                results.append({
                    "id": pid,
                    "name": prow["name"],
                    "description": prow["description"],
                    "policy_version": prow["policy_version"] or "0.0.0",
                    "last_applied_version": prow["last_applied_version"] or "0.0.0",
                    "pending_push_version": prow["pending_push_version"],
                    "push_enabled": bool(prow["push_enabled"]),
                    "failure_action": failure_action,
                    "total_events_7d": total_7d,
                    "critical_events_7d": critical_7d,
                    "passed_events_7d": passed_7d,
                    "pass_rate_7d": pass_rate_7d,
                    "last_scan_at": last_scan_at,
                    "last_critical_at": last_critical_at,
                    "last_pushed_at": prow["last_pushed_at"],
                    "last_applied_at": prow["last_applied_at"],
                    "top_files_7d": top_files_7d,
                    "top_issues_7d": top_issues_7d,
                    "recent_event_ids": recent_event_ids[:50],
                    "health_grade": (
                        "A" if pass_rate_7d >= 95 and critical_7d == 0
                        else "B" if pass_rate_7d >= 80 and critical_7d <= 5
                        else "C" if pass_rate_7d >= 60
                        else "D" if pass_rate_7d >= 40
                        else "F"
                    ),
                })
            return results

    @classmethod
    def update_project_policy(cls, project_id: str, policy_dag: Dict[str, Any]) -> bool:
        """Updates the custom DAG review policy for a project."""
        now = get_utc_now_iso()
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE projects
                SET policy_dag_json = ?, updated_at = ?
                WHERE id = ? AND deleted_at IS NULL
                """,
                (json.dumps(policy_dag, ensure_ascii=False), now, project_id),
            )
            conn.commit()
            return cursor.rowcount > 0

    @classmethod
    def sanitize_project_policies(cls) -> int:
        """Heals corrupted or invalid project policies in the database.
        
        Actions:
        1. Fixes mojibake/corrupted characters (e.g. \\ufffd, garbled UTF-8) in custom_rules and agent_skills.
        2. Drops overly broad / catastrophic regex patterns (such as `\\.\\w+\\.\\w+\\b` or `.*`) that cause false positives.
        3. Normalizes title, scope, and level for standard rules.
        4. Deduplicates rules with identical patterns or titles.
        """
        cleaned_count = 0
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, policy_dag_json FROM projects")
            rows = cursor.fetchall()

            for row in rows:
                pid = row["id"]
                raw_json = row["policy_dag_json"] or "{}"
                try:
                    policy = json.loads(raw_json)
                except Exception:
                    continue

                modified = False
                custom_rules = policy.get("custom_rules") or []
                agent_skills = policy.get("agent_skills") or []
                skills = policy.get("skills") or []

                # Clean custom_rules
                clean_rules = []
                seen_patterns = set()
                for r in custom_rules:
                    if not isinstance(r, dict):
                        continue
                    pattern = str(r.get("pattern", "")).strip()
                    title = str(r.get("title", "")).strip()
                    msg = str(r.get("message", "")).strip()

                    # Drop catastrophic patterns that match common code constructs
                    if pattern in (r"\.\w+\.\w+\b", r"\.\w+\.\w+", r".*", r".+", r"\w+"):
                        modified = True
                        continue

                    # Heal mojibake
                    if "\ufffd" in title or "δ" in title or "\ufffd" in msg or "" in title or "" in msg:
                        if "null" in pattern:
                            title = "未防御的深层属性访问与空对象引用"
                            msg = "检测到针对 null/undefined 的直接属性访问，请使用可选链 (?.) 或显式判空防御！"
                        else:
                            title = "代码规范与边界防御卡点"
                            msg = "检测到潜在代码缺陷，请遵循防御性编程规范！"
                        r["title"] = title
                        r["message"] = msg
                        modified = True

                    # Deduplicate by pattern
                    if pattern in seen_patterns:
                        modified = True
                        continue
                    seen_patterns.add(pattern)
                    clean_rules.append(r)

                # Clean agent_skills & skills
                clean_skills = []
                seen_titles = set()
                for s in (agent_skills or skills):
                    if not isinstance(s, dict):
                        continue
                    stitle = str(s.get("title", "")).strip()
                    ssummary = str(s.get("summary", "")).strip()

                    # Drop corrupted Rule 5 or mojibake skills
                    if "\ufffd" in stitle or "ֵȫ" in stitle or "Կ" in stitle or "" in stitle or "" in ssummary:
                        if "null" in str(s.get("skill_markdown", "")).lower() or "optional" in str(s.get("skill_markdown", "")).lower():
                            stitle = "防御性可选链与空指针安全防护规范"
                            ssummary = "禁止对深层对象或外部输入进行未经校验的解构和直接链式访问，必须使用可选链（?.）与空值合并运算符（??）。"
                            s["title"] = stitle
                            s["summary"] = ssummary
                            s["category"] = "stability"
                        else:
                            modified = True
                            continue

                    if stitle in seen_titles:
                        modified = True
                        continue
                    seen_titles.add(stitle)
                    clean_skills.append(s)

                if modified or len(clean_rules) != len(custom_rules) or len(clean_skills) != len(agent_skills):
                    policy["custom_rules"] = clean_rules
                    policy["agent_skills"] = clean_skills
                    policy["skills"] = clean_skills
                    policy["gate_rules"] = clean_rules
                    now = get_utc_now_iso()
                    cursor.execute(
                        "UPDATE projects SET policy_dag_json = ?, updated_at = ? WHERE id = ?",
                        (json.dumps(policy, ensure_ascii=False), now, pid),
                    )
                    cleaned_count += 1

            conn.commit()
        return cleaned_count

    # ---------------- Policy version & push state ----------------
    @classmethod
    def get_project_push_state(cls, project_id: str) -> Dict[str, Any]:
        """Returns the policy version, pending push version and related metadata.

        Used by both the Web control panel and the local Git hook to negotiate
        whether a new rule set has been staged server-side and is waiting for
        the developer to confirm application in the next commit.

        Read-only: a missing / removed project yields an empty state with
        `deleted=True` so the local hook can self-detach instead of the server
        silently recreating a strict default project.
        """
        if not cls.get_project(project_id):
            return cls._empty_push_state(deleted=True)
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT policy_version, pending_push_version, push_enabled,
                       last_pushed_at, last_applied_at, last_applied_version,
                       last_pushed_changelog
                FROM projects WHERE id = ?
                """,
                (project_id,),
            )
            row = cursor.fetchone()
            if not row:
                return cls._empty_push_state()
            keys = ("policy_version", "pending_push_version", "push_enabled",
                    "last_pushed_at", "last_applied_at", "last_applied_version",
                    "last_pushed_changelog")
            data = dict(zip(keys, row))
            changelog_raw = data.get("last_pushed_changelog") or "[]"
            try:
                changelog = json.loads(changelog_raw)
            except Exception:
                changelog = []
            return {
                "policy_version": data.get("policy_version") or "0.0.0",
                "pending_push_version": data.get("pending_push_version"),
                "push_enabled": bool(data.get("push_enabled", 1)),
                "last_pushed_at": normalize_iso_timestamp(data.get("last_pushed_at")),
                "last_applied_at": normalize_iso_timestamp(data.get("last_applied_at")),
                "last_applied_version": data.get("last_applied_version") or "0.0.0",
                "changelog": changelog,
                "pending": bool(data.get("pending_push_version")),
            }

    @staticmethod
    def _empty_push_state(deleted: bool = False) -> Dict[str, Any]:
        return {
            "policy_version": "0.0.0",
            "pending_push_version": None,
            "push_enabled": True,
            "last_pushed_at": None,
            "last_applied_at": None,
            "last_applied_version": "0.0.0",
            "changelog": [],
            "pending": False,
            "deleted": deleted,
        }

    @classmethod
    def bump_policy_version(cls, project_id: str, reason: str = "") -> str:
        """Atomically bumps policy_version (semver patch++) and returns the new version.

        Also stamps `updated_at`. Does NOT auto-mark pending push; callers that
        want a push to be triggered should call `mark_pending_push` separately.
        """
        cls.get_or_create_project(project_id)
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT policy_version FROM projects WHERE id = ? AND deleted_at IS NULL",
                (project_id,),
            )
            row = cursor.fetchone()
            current = (row[0] if row and row[0] else "0.0.0") or "0.0.0"
            new_version = _bump_semver(current)
            now = get_utc_now_iso()
            cursor.execute(
                """
                UPDATE projects
                SET policy_version = ?, updated_at = ?
                WHERE id = ? AND deleted_at IS NULL
                """,
                (new_version, now, project_id),
            )
            conn.commit()
            return new_version

    @classmethod
    def mark_pending_push(
        cls,
        project_id: str,
        changelog: Optional[List[Dict[str, Any]]] = None,
        version: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Marks the current policy_version as awaiting local application.

        Called when the Web control panel clicks "Push to local repos" or when
        a server-side rule change should proactively reach local developers.
        Stores a structured changelog so the hook can render a friendly prompt.
        """
        cls.get_or_create_project(project_id)
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT policy_version FROM projects WHERE id = ? AND deleted_at IS NULL",
                (project_id,),
            )
            row = cursor.fetchone()
            current_version = (row[0] if row and row[0] else "0.0.0") or "0.0.0"
            target_version = version or current_version
            now = get_utc_now_iso()
            cursor.execute(
                """
                UPDATE projects
                SET pending_push_version = ?,
                    last_pushed_at = ?,
                    last_pushed_changelog = ?
                WHERE id = ? AND deleted_at IS NULL
                """,
                (
                    target_version,
                    now,
                    json.dumps(changelog or [], ensure_ascii=False),
                    project_id,
                ),
            )
            conn.commit()
            return cls.get_project_push_state(project_id)

    @classmethod
    def consume_pending_push(cls, project_id: str) -> Dict[str, Any]:
        """Clears the pending flag and stamps last_applied_* after the hook writes files.

        Returns the updated push state. If no pending push existed, returns the
        current state unchanged (no-op).
        """
        cls.get_or_create_project(project_id)
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT pending_push_version FROM projects WHERE id = ? AND deleted_at IS NULL",
                (project_id,),
            )
            row = cursor.fetchone()
            pending = row[0] if row else None
            if not pending:
                return cls.get_project_push_state(project_id)
            now = get_utc_now_iso()
            cursor.execute(
                """
                UPDATE projects
                SET pending_push_version = NULL,
                    last_applied_at = ?,
                    last_applied_version = ?
                WHERE id = ? AND deleted_at IS NULL
                """,
                (now, pending, project_id),
            )
            conn.commit()
            return cls.get_project_push_state(project_id)

    @classmethod
    def cancel_pending_push(cls, project_id: str) -> Dict[str, Any]:
        """Clears the pending flag without recording an application (e.g. user declined)."""
        cls.get_or_create_project(project_id)
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE projects SET pending_push_version = NULL WHERE id = ? AND deleted_at IS NULL",
                (project_id,),
            )
            conn.commit()
            return cls.get_project_push_state(project_id)

    @classmethod
    def set_push_enabled(cls, project_id: str, enabled: bool) -> Dict[str, Any]:
        """Toggles whether the server is allowed to stage pushes for this project."""
        cls.get_or_create_project(project_id)
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE projects SET push_enabled = ? WHERE id = ? AND deleted_at IS NULL",
                (1 if enabled else 0, project_id),
            )
            conn.commit()
            return cls.get_project_push_state(project_id)

    @classmethod
    def record_scan_event(
        cls,
        project_id: str,
        committer: str,
        branch: str,
        commit_hash: str,
        passed: bool,
        critical_issues: List[str],
        suggestions: List[str],
        summary: str,
        files: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Records an audit scan event."""
        # Ensure project exists
        cls.get_or_create_project(project_id)

        event_id = str(uuid.uuid4())
        now = get_utc_now_iso()

        # Sanitize files for storage (truncate huge content)
        stored_files = []
        for f in files:
            stored_files.append({
                "filename": f.get("filename", ""),
                "language": f.get("language", ""),
                "length": len(f.get("content", "")),
                "preview": f.get("content", "")[:300],
            })

        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO scan_events (
                    id, project_id, committer, branch, commit_hash,
                    passed, critical_issues_json, suggestions_json, summary,
                    files_count, files_detail_json, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    event_id,
                    project_id,
                    committer or "unknown",
                    branch or "main",
                    commit_hash or "",
                    1 if passed else 0,
                    json.dumps(critical_issues, ensure_ascii=False),
                    json.dumps(suggestions, ensure_ascii=False),
                    summary,
                    len(files),
                    json.dumps(stored_files, ensure_ascii=False),
                    now,
                ),
            )
            conn.commit()

        return {
            "id": event_id,
            "project_id": project_id,
            "committer": committer or "unknown",
            "branch": branch or "main",
            "passed": passed,
            "critical_issues": critical_issues,
            "suggestions": suggestions,
            "summary": summary,
            "files_count": len(files),
            "created_at": now,
        }

    @classmethod
    def list_recent_events(cls, project_id: Optional[str] = None, limit: int = 30) -> List[Dict[str, Any]]:
        """Retrieves recent audit scan events, optionally filtered by project."""
        with get_connection() as conn:
            cursor = conn.cursor()
            if project_id:
                cursor.execute(
                    """
                    SELECT * FROM scan_events
                    WHERE project_id = ?
                      AND project_id NOT IN (SELECT id FROM projects WHERE deleted_at IS NOT NULL)
                    ORDER BY created_at DESC
                    LIMIT ?
                    """,
                    (project_id, limit),
                )
            else:
                cursor.execute(
                    """
                    SELECT * FROM scan_events
                    WHERE project_id NOT IN (SELECT id FROM projects WHERE deleted_at IS NOT NULL)
                    ORDER BY created_at DESC
                    LIMIT ?
                    """,
                    (limit,),
                )

            rows = cursor.fetchall()
            events = []
            for r in rows:
                events.append({
                    "id": r["id"],
                    "project_id": r["project_id"],
                    "committer": r["committer"],
                    "branch": r["branch"],
                    "commit_hash": r["commit_hash"],
                    "passed": bool(r["passed"]),
                    "critical_issues": json.loads(r["critical_issues_json"] or "[]"),
                    "suggestions": json.loads(r["suggestions_json"] or "[]"),
                    "summary": r["summary"],
                    "files_count": r["files_count"],
                    "files": json.loads(r["files_detail_json"] or "[]"),
                    "created_at": normalize_iso_timestamp(r["created_at"]),
                })
            return events

    # =========================================================================
    # Committer analytics — feeds the "全员提交拦截与审计流水" leaderboard.
    # =========================================================================

    @classmethod
    def list_committers_leaderboard(cls, days: int = 30, limit: int = 50) -> List[Dict[str, Any]]:
        """Per-committer audit aggregates over the last `days` days.

        Computes per-committer:
          - total_commits, blocked_commits, passed_commits
          - pass_rate (%), block_rate (%)
          - first_seen, last_seen (UTC ISO timestamps)
          - top_projects (top 3 project ids by scan count)
          - top_files (top 3 files most frequently involved in blocks)
          - last_blocked_at (most recent critical event timestamp)
          - risk_score (0-100; higher = riskier)

        Sorted by risk_score DESC then blocked_commits DESC.
        """
        from datetime import datetime, timezone, timedelta
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, project_id, committer, passed, critical_issues_json, created_at
                FROM scan_events
                WHERE created_at >= ?
                  AND project_id NOT IN (SELECT id FROM projects WHERE deleted_at IS NOT NULL)
                ORDER BY created_at DESC
                """,
                (cutoff,),
            )
            rows = cursor.fetchall()

        committers: Dict[str, Dict[str, Any]] = {}
        for r in rows:
            committer = (r["committer"] or "unknown").strip() or "unknown"
            proj = r["project_id"] or "unknown"
            entry = committers.setdefault(committer, {
                "committer": committer,
                "total_commits": 0,
                "blocked_commits": 0,
                "passed_commits": 0,
                "first_seen": None,
                "last_seen": None,
                "last_blocked_at": None,
                "project_counter": {},
                "blocked_files": [],
            })
            entry["total_commits"] += 1
            if not r["passed"]:
                entry["blocked_commits"] += 1
                ts = normalize_iso_timestamp(r["created_at"])
                if entry["last_blocked_at"] is None or (ts and ts > entry["last_blocked_at"]):
                    entry["last_blocked_at"] = ts
            else:
                entry["passed_commits"] += 1
            ts = normalize_iso_timestamp(r["created_at"])
            if entry["first_seen"] is None or (ts and ts < entry["first_seen"]):
                entry["first_seen"] = ts
            if entry["last_seen"] is None or (ts and ts > entry["last_seen"]):
                entry["last_seen"] = ts
            entry["project_counter"][proj] = entry["project_counter"].get(proj, 0) + 1
            if not r["passed"]:
                try:
                    issues = json.loads(r["critical_issues_json"] or "[]")
                except Exception:
                    issues = []
                for iss in issues:
                    iss_str = str(iss)
                    m = re.match(r"^\s*\[([^\]]+)\]", iss_str)
                    if m:
                        entry["blocked_files"].append(m.group(1))

        # Now compute risk scores + flatten top-N lists
        results: List[Dict[str, Any]] = []
        now = datetime.now(timezone.utc)
        for entry in committers.values():
            total = entry["total_commits"]
            blocked = entry["blocked_commits"]
            block_ratio = (blocked / total) if total > 0 else 0.0
            pass_rate = ((total - blocked) / total * 100) if total > 0 else 100.0

            # Recency score: 20 if blocked in last 24h, decaying to 0 over `days`
            recency_score = 0.0
            if entry["last_blocked_at"]:
                try:
                    last_dt = datetime.fromisoformat(entry["last_blocked_at"].rstrip("Z"))
                    hours_ago = (now - last_dt).total_seconds() / 3600.0
                    if hours_ago < 24:
                        recency_score = 20.0
                    elif hours_ago < 24 * days:
                        recency_score = max(0.0, 20.0 * (1 - (hours_ago - 24) / (24 * days)))
                except Exception:
                    pass

            volume_score = min(blocked, 20) / 20.0 * 30.0
            risk_score = round(block_ratio * 50.0 + volume_score + recency_score, 1)

            top_projects = sorted(
                [{"project_id": k, "count": v} for k, v in entry["project_counter"].items()],
                key=lambda x: -x["count"],
            )[:3]
            file_counter: Dict[str, int] = {}
            for f in entry["blocked_files"]:
                file_counter[f] = file_counter.get(f, 0) + 1
            top_files = sorted(
                [{"file": k, "count": v} for k, v in file_counter.items()],
                key=lambda x: -x["count"],
            )[:3]

            results.append({
                "committer": entry["committer"],
                "total_commits": total,
                "blocked_commits": blocked,
                "passed_commits": total - blocked,
                "pass_rate": round(pass_rate, 1),
                "block_rate": round(block_ratio * 100, 1),
                "first_seen": entry["first_seen"],
                "last_seen": entry["last_seen"],
                "last_blocked_at": entry["last_blocked_at"],
                "risk_score": risk_score,
                "top_projects": top_projects,
                "top_files": top_files,
            })

        results.sort(key=lambda x: (-x["risk_score"], -x["blocked_commits"]))
        return results[:limit]

    @classmethod
    def list_committer_events(cls, committer: str, days: int = 30, limit: int = 50) -> List[Dict[str, Any]]:
        """Returns scan events attributed to a specific committer.

        Committer matching is exact (case-sensitive) since git config user.name
        is consistent across commits from the same author. Useful for drilling
        into a single developer's audit history from the leaderboard.
        """
        from datetime import datetime, timezone, timedelta
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT * FROM scan_events
                WHERE committer = ? AND created_at >= ?
                  AND project_id NOT IN (SELECT id FROM projects WHERE deleted_at IS NOT NULL)
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (committer, cutoff, limit),
            )
            rows = cursor.fetchall()
            events = []
            for r in rows:
                events.append({
                    "id": r["id"],
                    "project_id": r["project_id"],
                    "committer": r["committer"],
                    "branch": r["branch"],
                    "commit_hash": r["commit_hash"],
                    "passed": bool(r["passed"]),
                    "critical_issues": json.loads(r["critical_issues_json"] or "[]"),
                    "suggestions": json.loads(r["suggestions_json"] or "[]"),
                    "summary": r["summary"],
                    "files_count": r["files_count"],
                    "files": json.loads(r["files_detail_json"] or "[]"),
                    "created_at": normalize_iso_timestamp(r["created_at"]),
                })
            return events

    # =========================================================================
    # LLM Connection Profiles Management (Multi-Key & Multi-Profile Support)
    # =========================================================================

    @classmethod
    def _format_profile_dict(cls, row_dict: Dict[str, Any]) -> Dict[str, Any]:
        """Formats and enriches LLM profile data with multi-key arrays and masked previews."""
        d = dict(row_dict)
        raw_key = d.get("api_key", "") or ""
        keys = parse_api_keys(raw_key)
        d["api_keys"] = keys
        d["key_count"] = len(keys)
        d["masked_keys"] = [mask_key(k) for k in keys]
        if len(keys) == 0:
            d["masked_key"] = ""
        elif len(keys) == 1:
            d["masked_key"] = mask_key(keys[0])
        else:
            d["masked_key"] = f"{mask_key(keys[0])} (+{len(keys)-1}个备用Key)"
        d["has_key"] = len(keys) > 0
        d["is_active"] = bool(d.get("is_active", 0))
        d["api_key"] = "\n".join(keys) if keys else ""
        return d

    @classmethod
    def list_llm_profiles(cls) -> List[Dict[str, Any]]:
        """Returns all configured LLM profiles with multi-key details."""
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM llm_profiles ORDER BY is_active DESC, updated_at DESC")
            rows = cursor.fetchall()
            return [cls._format_profile_dict(dict(r)) for r in rows]

    @classmethod
    def get_active_llm_profile(cls) -> Optional[Dict[str, Any]]:
        """Returns the currently active LLM profile or the latest configured profile."""
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM llm_profiles WHERE is_active = 1 LIMIT 1")
            row = cursor.fetchone()
            if row:
                d = cls._format_profile_dict(dict(row))
                d["is_active"] = True
                return d
            # fallback to latest
            cursor.execute("SELECT * FROM llm_profiles ORDER BY updated_at DESC LIMIT 1")
            row = cursor.fetchone()
            if row:
                d = cls._format_profile_dict(dict(row))
                return d
            return None

    @classmethod
    def get_llm_profile(cls, profile_id: str) -> Optional[Dict[str, Any]]:
        """Returns a single LLM profile by ID."""
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM llm_profiles WHERE id = ?", (profile_id,))
            row = cursor.fetchone()
            if not row:
                return None
            return cls._format_profile_dict(dict(row))

    @classmethod
    def create_llm_profile(
        cls,
        name: str,
        api_base: str,
        api_key: Any,
        default_model: str,
        request_timeout: float = 60.0,
        provider_type: str = "custom",
        set_active: bool = False,
    ) -> Dict[str, Any]:
        """Creates a new LLM connection profile supporting multiple API keys."""
        with get_connection() as conn:
            cursor = conn.cursor()
            pid = f"prof_{uuid.uuid4().hex[:8]}"
            now = get_utc_now_iso()
            if set_active:
                cursor.execute("UPDATE llm_profiles SET is_active = 0")
            
            parsed_keys = parse_api_keys(api_key)
            stored_key_str = "\n".join(parsed_keys) if parsed_keys else (str(api_key).strip() if api_key else "")

            cursor.execute(
                """
                INSERT INTO llm_profiles (id, name, provider_type, api_base, api_key, default_model, request_timeout, is_active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    pid,
                    name.strip() or "未命名连接",
                    provider_type.strip() or "custom",
                    api_base.strip().rstrip("/"),
                    stored_key_str,
                    default_model.strip() or "deepseek-chat",
                    float(request_timeout),
                    1 if set_active else 0,
                    now,
                    now,
                ),
            )
            conn.commit()
            return cls.get_llm_profile(pid)

    @classmethod
    def update_llm_profile(cls, profile_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Updates fields of an existing LLM connection profile."""
        with get_connection() as conn:
            cursor = conn.cursor()
            now = get_utc_now_iso()
            fields = []
            values = []

            for k in ["name", "provider_type", "api_base", "default_model", "request_timeout"]:
                if k in data and data[k] is not None:
                    v = data[k]
                    if k == "api_base" and isinstance(v, str):
                        v = v.strip().rstrip("/")
                    elif k == "name" and isinstance(v, str):
                        v = v.strip()
                    elif k == "default_model" and isinstance(v, str):
                        v = v.strip()
                    elif k == "request_timeout":
                        v = float(v)
                    fields.append(f"{k} = ?")
                    values.append(v)

            # Handle api_key or api_keys
            if "api_keys" in data and data["api_keys"] is not None:
                parsed_keys = parse_api_keys(data["api_keys"])
                fields.append("api_key = ?")
                values.append("\n".join(parsed_keys))
            elif "api_key" in data and data["api_key"] is not None:
                raw_val = data["api_key"]
                parsed_keys = parse_api_keys(raw_val)
                # If key is not masked placeholder
                if not (isinstance(raw_val, str) and "..." in raw_val and len(raw_val) < 15):
                    fields.append("api_key = ?")
                    values.append("\n".join(parsed_keys) if parsed_keys else str(raw_val).strip())

            if fields:
                fields.append("updated_at = ?")
                values.append(now)
                values.append(profile_id)
                cursor.execute(
                    f"UPDATE llm_profiles SET {', '.join(fields)} WHERE id = ?",
                    tuple(values),
                )
                conn.commit()
            return cls.get_llm_profile(profile_id)

    @classmethod
    def set_active_llm_profile(cls, profile_id: str) -> Optional[Dict[str, Any]]:
        """Sets a profile as the currently active one and deactivates others."""
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE llm_profiles SET is_active = 0")
            cursor.execute(
                "UPDATE llm_profiles SET is_active = 1, updated_at = ? WHERE id = ?",
                (get_utc_now_iso(), profile_id),
            )
            conn.commit()
            return cls.get_llm_profile(profile_id)

    @classmethod
    def delete_llm_profile(cls, profile_id: str) -> bool:
        """Deletes a profile by ID and promotes another if active was deleted."""
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM llm_profiles WHERE id = ?", (profile_id,))
            cursor.execute("SELECT COUNT(*) FROM llm_profiles WHERE is_active = 1")
            active_count = cursor.fetchone()[0]
            if active_count == 0:
                cursor.execute(
                    "UPDATE llm_profiles SET is_active = 1 WHERE id IN (SELECT id FROM llm_profiles ORDER BY updated_at DESC LIMIT 1)"
                )
            conn.commit()
            return True


# Automatically sanitize and heal any corrupted policies on startup
try:
    DatabaseService.sanitize_project_policies()
except Exception:
    pass


