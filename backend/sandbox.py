"""Lightweight asynchronous sandbox runner for unit tests using subprocess with thread pooling."""

import asyncio
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import List, Tuple
from pydantic import BaseModel


class SandboxResult(BaseModel):
    success: bool
    returncode: int
    stdout: str
    stderr: str
    duration_ms: float
    error_summary: str = ""


def _run_sync(cmd: List[str], timeout: float) -> Tuple[int, str, str, bool]:
    """Runs a command synchronously with a timeout, portable across all OS event loops."""
    try:
        proc = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=timeout,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        return proc.returncode, proc.stdout, proc.stderr, False
    except subprocess.TimeoutExpired as te:
        stdout = te.stdout.decode("utf-8", errors="replace") if isinstance(te.stdout, bytes) else (te.stdout or "")
        stderr = te.stderr.decode("utf-8", errors="replace") if isinstance(te.stderr, bytes) else (te.stderr or "")
        return -1, stdout, f"沙箱执行超时 (超过 {timeout:.1f} 秒): {stderr}", True
    except Exception as ex:
        return -1, "", f"子进程启动异常: {str(ex)}", False


class TestSandbox:
    """Safely executes generated test files in isolated subprocess with strict timeouts."""

    @classmethod
    async def run_test(
        cls,
        test_code: str,
        language: str = "python",
        timeout: float = 5.0,
    ) -> SandboxResult:
        """Executes test code asynchronously in a worker thread.

        Args:
            test_code: The Python or Node.js test script code.
            language: Programming language.
            timeout: Maximum execution seconds (default 5s).
        """
        start_time = time.time()
        ext = ".py" if "python" in language.lower() else ".js"

        temp_dir = tempfile.gettempdir()
        temp_file = Path(temp_dir) / f"flowdev_sandbox_{os.getpid()}_{int(time.time() * 1000)}{ext}"

        try:
            with open(temp_file, "w", encoding="utf-8") as f:
                f.write(test_code)

            if "python" in language.lower():
                cmd = [sys.executable, str(temp_file)]
            else:
                cmd = ["node", str(temp_file)]

            # Run in worker thread to prevent event loop blocking & Windows proactor issues
            returncode, stdout, stderr, is_timeout = await asyncio.to_thread(
                _run_sync, cmd, timeout
            )

            duration_ms = (time.time() - start_time) * 1000
            success = (returncode == 0 and not is_timeout)

            error_summary = ""
            if not success:
                err_text = stderr.strip() or stdout.strip()
                lines = err_text.splitlines()
                error_summary = "\n".join(lines[-6:]) if lines else f"Exit code {returncode}"

            return SandboxResult(
                success=success,
                returncode=returncode,
                stdout=stdout,
                stderr=stderr,
                duration_ms=duration_ms,
                error_summary=error_summary,
            )

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            return SandboxResult(
                success=False,
                returncode=-1,
                stdout="",
                stderr=str(e),
                duration_ms=duration_ms,
                error_summary=f"沙箱初始化异常: {str(e)}",
            )
        finally:
            if temp_file.exists():
                try:
                    temp_file.unlink()
                except Exception:
                    pass
