"""SQLite Database Layer for Multi-Tenant Projects and Audit History."""

import json
import os
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

DB_PATH = Path(__file__).parent / "flowdev.db"


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
                results.append({
                    "id": row["id"],
                    "name": row["name"],
                    "description": row["description"],
                    "policy": json.loads(row["policy_dag_json"] or "{}"),
                    "total_scans": total,
                    "passed_scans": passed,
                    "pass_rate": pass_rate,
                    "last_scan_at": normalize_iso_timestamp(row["last_scan_at"]),
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
