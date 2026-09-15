"""Configuration loader for FlowDev-AI backend."""

import os
from pathlib import Path
from dotenv import load_dotenv

# Locate and load .env file from backend directory
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)


class Settings:
    OPENAI_API_BASE: str = os.getenv(
        "OPENAI_API_BASE", "https://tokenerpgw.asiainfo.com/erp/v1"
    ).rstrip("/")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "").strip()
    DEFAULT_MODEL: str = os.getenv("DEFAULT_MODEL", "AI/deekseek-v4-flash-0731").strip()
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


settings = Settings()
