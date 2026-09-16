"""Feishu (Lark) Webhook Bot Notification Service for FlowDev-AI.

Sends interactive card alerts to Feishu developer groups whenever code commits
are intercepted by the quality gatekeeper or reviewed.
"""

import logging
from typing import Any, Dict, List, Optional
import httpx

try:
    from config import settings
except ImportError:
    from backend.config import settings

logger = logging.getLogger("flowdev.feishu")


class FeishuNotifier:
    """High-level notifier for Feishu Custom Bot Webhook."""

    @classmethod
    async def send_audit_card(
        cls,
        project_id: str,
        committer: str,
        branch: str,
        passed: bool,
        critical_issues: List[str],
        suggestions: List[str],
        summary: str,
        files_count: int,
        dashboard_url: str = "http://localhost:3000/?view=dashboard",
        webhook_url: Optional[str] = None,
    ) -> bool:
        """Sends an interactive card alert to Feishu group."""
        target_url = (webhook_url or settings.FEISHU_WEBHOOK_URL).strip()
        if not target_url:
            logger.info("Feishu webhook URL is not configured. Skipping notification.")
            return False

        # If configured to only notify blocked commits
        if passed and settings.FEISHU_NOTIFY_ONLY_BLOCKED and not webhook_url:
            logger.debug("Commit passed and notify_only_blocked is True. Skipping.")
            return False

        header_title = "✅ 代码门禁检查通过" if passed else "🚨 代码提交已被门禁拦截"
        header_template = "green" if passed else "red"

        # Build card elements
        elements: List[Dict[str, Any]] = [
            {
                "tag": "div",
                "fields": [
                    {
                        "is_short": True,
                        "text": {"tag": "lark_md", "content": f"**📦 代码仓库:**\n`{project_id}`"},
                    },
                    {
                        "is_short": True,
                        "text": {"tag": "lark_md", "content": f"**🌿 提交分支:**\n`{branch}`"},
                    },
                    {
                        "is_short": True,
                        "text": {"tag": "lark_md", "content": f"**👤 提交者:**\n{committer}"},
                    },
                    {
                        "is_short": True,
                        "text": {"tag": "lark_md", "content": f"**📁 扫描文件:**\n{files_count} 个"},
                    },
                ],
            },
            {"tag": "hr"},
            {
                "tag": "div",
                "text": {"tag": "lark_md", "content": f"**📋 门禁结论:**\n{summary}"},
            },
        ]

        if not passed and critical_issues:
            issues_md = "\n".join([f"• ❌ {iss}" for iss in critical_issues[:5]])
            elements.append({
                "tag": "div",
                "text": {
                    "tag": "lark_md",
                    "content": f"**🔥 阻断性致命缺陷 (Top {len(critical_issues[:5])}):**\n{issues_md}",
                },
            })

        if suggestions:
            sug_md = "\n".join([f"• 💡 {sug}" for sug in suggestions[:3]])
            elements.append({
                "tag": "div",
                "text": {"tag": "lark_md", "content": f"**🛠️ 建议修复措施:**\n{sug_md}"},
            })

        # Action Buttons
        elements.append({
            "tag": "action",
            "actions": [
                {
                    "tag": "button",
                    "text": {"tag": "plain_text", "content": "📊 前往质量大盘查看"},
                    "type": "primary" if not passed else "default",
                    "url": dashboard_url,
                }
            ],
        })

        card_payload = {
            "msg_type": "interactive",
            "card": {
                "config": {"wide_screen_mode": True},
                "header": {
                    "title": {"tag": "plain_text", "content": header_title},
                    "template": header_template,
                },
                "elements": elements,
            },
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(target_url, json=card_payload)
                if res.status_code == 200:
                    resp_json = res.json()
                    if resp_json.get("code") == 0 or resp_json.get("StatusCode") == 0:
                        logger.info(f"Successfully sent Feishu notification for project {project_id}")
                        return True
                    else:
                        logger.warning(f"Feishu webhook responded with error: {resp_json}")
                else:
                    logger.warning(f"Feishu webhook HTTP error {res.status_code}: {res.text}")
        except Exception as err:
            logger.warning(f"Failed to post to Feishu webhook: {err}")

        return False

    @classmethod
    async def send_test_card(cls, webhook_url: Optional[str] = None) -> Dict[str, Any]:
        """Sends a verification test card to the given or configured Feishu webhook."""
        target_url = (webhook_url or settings.FEISHU_WEBHOOK_URL).strip()
        if not target_url:
            return {"success": False, "message": "未配置飞书 Webhook URL，请先填写"}

        card_payload = {
            "msg_type": "interactive",
            "card": {
                "config": {"wide_screen_mode": True},
                "header": {
                    "title": {"tag": "plain_text", "content": "🎉 FlowDev-AI 飞书通知集成测试"},
                    "template": "blue",
                },
                "elements": [
                    {
                        "tag": "div",
                        "text": {
                            "tag": "lark_md",
                            "content": "**恭喜！飞书群自定义机器人已成功连接 FlowDev-AI 代码质量门禁系统。**\n\n当开发团队在代码仓库中提交未通过门禁的风险代码时，机器人将自动向本群推送拦截预警与 AI 修复建议。",
                        },
                    },
                    {
                        "tag": "div",
                        "fields": [
                            {"is_short": True, "text": {"tag": "lark_md", "content": "**系统状态:**\n🟢 运行就绪"}},
                            {"is_short": True, "text": {"tag": "lark_md", "content": "**门禁探针:**\nGit Pre-Commit"}},
                        ],
                    },
                    {"tag": "hr"},
                    {
                        "tag": "action",
                        "actions": [
                            {
                                "tag": "button",
                                "text": {"tag": "plain_text", "content": "📈 打开质量大盘"},
                                "type": "primary",
                                "url": "http://localhost:3000/?view=dashboard",
                            }
                        ],
                    },
                ],
            },
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(target_url, json=card_payload)
                if res.status_code == 200:
                    resp_json = res.json()
                    if resp_json.get("code") == 0 or resp_json.get("StatusCode") == 0:
                        return {"success": True, "message": "飞书测试卡片发送成功！请在飞书群中查看"}
                    else:
                        return {"success": False, "message": f"飞书返回错误: {resp_json.get('msg') or resp_json}"}
                else:
                    return {"success": False, "message": f"HTTP 请求失败 ({res.status_code}): {res.text}"}
        except Exception as err:
            return {"success": False, "message": f"网络异常: {str(err)}"}
