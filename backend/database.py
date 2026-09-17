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
    def get_or_create_project(cls, project_id: str, name: Optional[str] = None) -> Dict[str, Any]:
        """Ensures a project exists in the database, auto-creating if new."""
        clean_id = project_id.strip() or "default-project"
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM projects WHERE id = ?", (clean_id,))
            row = cursor.fetchone()
            if row:
                return dict(row)

            now = get_utc_now_iso()
            display_name = name or clean_id
            cursor.execute(
                """
                INSERT INTO projects (id, name, description, policy_dag_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (clean_id, display_name, f"自动识别的代码仓库: {clean_id}", "{}", now, now),
            )
            conn.commit()
            return {
                "id": clean_id,
                "name": display_name,
                "description": f"自动识别的代码仓库: {clean_id}",
                "policy_dag_json": "{}",
                "created_at": now,
                "updated_at": now,
            }

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
    def get_project_policy(cls, project_id: str) -> Dict[str, Any]:
        """Fetches the parsed policy DAG dictionary for a project."""
        project = cls.get_or_create_project(project_id)
        raw_json = project.get("policy_dag_json") or "{}"
        try:
            return json.loads(raw_json)
        except Exception:
            return {}

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
                WHERE id = ?
                """,
                (json.dumps(policy_dag, ensure_ascii=False), now, project_id),
            )
            conn.commit()
            return cursor.rowcount > 0

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
                    ORDER BY created_at DESC
                    LIMIT ?
                    """,
                    (project_id, limit),
                )
            else:
                cursor.execute(
                    """
                    SELECT * FROM scan_events
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

