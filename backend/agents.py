"""Specialized AI Agents for FlowDev-AI platform: ReviewAgent and TestAgent."""

import re
from typing import Dict, List, Optional


def extract_code_block(text: str, default_lang: str = "python") -> str:
    """Extracts the largest code block enclosed in ```...``` from markdown text."""
    # Pattern to match ```lang\ncode\n```
    pattern = r"```(?:[a-zA-Z0-9_\-]+)?\n(.*?)```"
    matches = re.findall(pattern, text, re.DOTALL)
    if matches:
        # Return the longest code block (usually the full refactored code or test suite)
        longest = max(matches, key=len)
        return longest.strip()
    return text.strip()


class ReviewAgent:
    """Specialized Agent for architecture review, security vulnerability audit, and refactoring."""

    SYSTEM_PROMPT = (
        "你是一名世界级的资深软件架构师与应用安全审查专家（ReviewAgent）。"
        "你的职责是对开发者提交的代码进行极其严苛、深入的静态分析与代码评审。\n"
        "评审规则：\n"
        "1. 必须输出严格结构化的 Markdown 格式，包含以下四个小节：\n"
        "   ### 1. 🛡️ 【安全风险分析】（检查 SQL/XSS、越权、未捕获异常、参数注入、硬编码等）\n"
        "   ### 2. ⚡ 【性能瓶颈评估】（检查时间/空间复杂度、死锁/并发竞争、资源泄漏等）\n"
        "   ### 3. 🧹 【代码规范与异味】（检查可读性、函数职责单一、魔法数值、类型契约等）\n"
        "   ### 4. 💡 【重构后推荐代码】（给出高质量、带有防御式编程与枚举封装的完整重构代码，置于标准代码块中）\n"
        "2. 输出语言保持专业、精炼的中文。"
    )

    @classmethod
    def build_messages(cls, code: str, language: str = "typescript", custom_prompt: Optional[str] = None) -> List[Dict[str, str]]:
        user_content = f"请评审以下 {language} 代码：\n\n```{language}\n{code}\n```"
        if custom_prompt:
            user_content += f"\n\n【用户补充审查指令】：\n{custom_prompt}"

        return [
            {"role": "system", "content": cls.SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ]


class TestAgent:
    """Specialized Agent for unit test generation, boundary condition design, and self-correction."""

    SYSTEM_PROMPT = (
        "你是一名资深的测试自动化架构师与单测设计专家（TestAgent）。"
        "你的任务是为待测代码编写高质量、生产级、可直接运行的自动化单元测试代码。\n"
        "测试设计原则：\n"
        "1. 必须覆盖核心正常逻辑（Happy Path）；\n"
        "2. 必须覆盖边界值与异常分支（如空入参、负数、极限值，使用 assertRaises 或 expect toThrow 校验）；\n"
        "3. 输出必须是完整、自包含、无需外部依赖即可由测试运行器执行的代码（如 Python unittest 或独立脚本）；\n"
        "4. 将完整单测代码包裹在 markdown 代码块中，例如 ```python ... ```。"
    )

    @classmethod
    def build_messages(cls, code: str, language: str = "python", framework: str = "unittest") -> List[Dict[str, str]]:
        user_content = (
            f"请为以下代码编写结构完备、可独立运行的 {framework} 单元测试代码：\n\n"
            f"```{language}\n{code}\n```\n\n"
            f"要求：\n"
            f"- 必须包含被测函数源码以便独立执行；\n"
            f"- 编写 TestCase 类，覆盖正常分支与所有异常断言；\n"
            f"- 结尾包含入口运行块，如 if __name__ == '__main__': unittest.main()。"
        )

        return [
            {"role": "system", "content": cls.SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ]

    @classmethod
    def build_reflection_messages(
        cls,
        source_code: str,
        failing_test_code: str,
        error_output: str,
        language: str = "python",
    ) -> List[Dict[str, str]]:
        """Builds reflection and self-correction prompt containing previous execution errors."""
        reflection_prompt = (
            "⚠️ 【沙箱单测执行异常告警】\n"
            "上一版生成的单元测试在本地轻量沙箱中执行失败，请仔细阅读以下报错信息并反思根本原因！\n\n"
            f"【报错信息 / 错误堆栈】：\n"
            f"```text\n{error_output}\n```\n\n"
            f"【待测源代码】：\n"
            f"```{language}\n{source_code}\n```\n\n"
            f"【上一版执行失败的单测代码】：\n"
            f"```{language}\n{failing_test_code}\n```\n\n"
            "【自我纠错任务要求】：\n"
            "1. 分析报错到底是测试断言期望值有误、被测代码返回值有误、还是缺少必要的导入/方法签名；\n"
            "2. 针对问题进行精准修正，确保异常测试断言（如 assertRaises）与代码实现完全对齐；\n"
            "3. 重新输出一份完整、可直接在沙箱执行通过的代码块。"
        )

        return [
            {"role": "system", "content": cls.SYSTEM_PROMPT},
            {"role": "user", "content": reflection_prompt},
        ]
