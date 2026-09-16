"""Configuration loader for FlowDev-AI backend."""

import os
from pathlib import Path
from dotenv import load_dotenv

# Locate and load .env file from backend directory
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)


class Settings:
    OPENAI_API_BASE: str = os.getenv(
        "OPENAI_API_BASE", "https://api.openai.com/v1"
    ).rstrip("/")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "").strip()
    DEFAULT_MODEL: str = os.getenv("DEFAULT_MODEL", "deepseek-chat").strip()
    REQUEST_TIMEOUT: float = float(os.getenv("REQUEST_TIMEOUT", "60.0"))
    FEISHU_WEBHOOK_URL: str = os.getenv("FEISHU_WEBHOOK_URL", "").strip()
    FEISHU_NOTIFY_ONLY_BLOCKED: bool = (
        os.getenv("FEISHU_NOTIFY_ONLY_BLOCKED", "true").lower() == "true"
    )

    @property
    def has_api_key(self) -> bool:
        return bool(self.OPENAI_API_KEY and len(self.OPENAI_API_KEY) > 5)

    @property
    def has_feishu(self) -> bool:
        return bool(self.FEISHU_WEBHOOK_URL and "open.feishu.cn" in self.FEISHU_WEBHOOK_URL)

    def reload(self):
        """Reload configuration from .env file."""
        load_dotenv(dotenv_path=env_path, override=True)
        self.OPENAI_API_BASE = os.getenv("OPENAI_API_BASE", "https://api.openai.com/v1").rstrip("/")
        self.OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
        self.DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "deepseek-chat").strip()
        self.REQUEST_TIMEOUT = float(os.getenv("REQUEST_TIMEOUT", "60.0"))
        self.FEISHU_WEBHOOK_URL = os.getenv("FEISHU_WEBHOOK_URL", "").strip()
        self.FEISHU_NOTIFY_ONLY_BLOCKED = (
            os.getenv("FEISHU_NOTIFY_ONLY_BLOCKED", "true").lower() == "true"
        )


def save_env_updates(updates: dict) -> bool:
    """Safely updates or appends key-value pairs into the backend .env file."""
    try:
        lines = []
        if env_path.exists():
            lines = env_path.read_text(encoding="utf-8").splitlines()

        keys_found = set()
        new_lines = []
        for line in lines:
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                new_lines.append(line)
                continue

            updated = False
            for k, v in updates.items():
                if line.startswith(f"{k}="):
                    new_lines.append(f"{k}={v}")
                    keys_found.add(k)
                    updated = True
                    break
            if not updated:
                new_lines.append(line)

        for k, v in updates.items():
            if k not in keys_found:
                new_lines.append(f"{k}={v}")

        env_path.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
        settings.reload()
        return True
    except Exception as e:
        import logging
        logging.getLogger("flowdev.config").warning(f"Failed to save .env: {e}")
        return False


settings = Settings()

