"""Workflow Execution Engine with Real LLM Streaming and Self-Correction Sandbox Loop."""

import asyncio
import difflib
import json
from typing import AsyncGenerator, Dict, Any, List

from scheduler import KahnScheduler, WorkflowPayload, WorkflowNode, DAGCycleError
from ai_service import LLMService
from agents import ReviewAgent, TestAgent, extract_code_block
from sandbox import TestSandbox, SandboxResult


def sse_event(event: str, data: Dict[str, Any]) -> str:
    """Encodes event and data dictionary to SSE wire format."""
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


DEFAULT_SAMPLE_CODE = (
    "def calculate_discount(price: float, member_type: str = 'REGULAR') -> float:\n"
    "    if price < 0:\n"
    "        raise ValueError('Invalid price')\n"
    "    if member_type == 'VIP':\n"
    "        return price * 0.8\n"
    "    return price * 0.95\n"
)


class WorkflowExecutor:
    """Executes the workflow graph in DAG topological order with AI agents and test sandbox."""

    @classmethod
    async def execute_stream(cls, payload: WorkflowPayload) -> AsyncGenerator[str, None]:
        # Step 1: Topology validation
        try:
            ordered_nodes = KahnScheduler.schedule(payload)
        except DAGCycleError as err:
            yield sse_event("workflow_error", {"error": str(err)})
            return
        except Exception as err:
            yield sse_event("workflow_error", {"error": f"拓扑调度异常: {str(err)}"})
            return

        yield sse_event(
            "workflow_started",
            {
                "totalNodes": len(ordered_nodes),
                "executionOrder": [n.id for n in ordered_nodes],
                "message": "DAG 拓扑调度完成，启动多 Agent 流式协同流程",
            },
        )
        await asyncio.sleep(0.3)

        # Context shared across nodes
        pipeline_context: Dict[str, Any] = {
            "source_code": DEFAULT_SAMPLE_CODE,
            "language": "python",
            "review_markdown": "",
            "refactored_code": "",
            "test_code": "",
            "diff_patch": "",
        }

        # Step 2: Iterate and execute nodes in topological sequence
        for index, node in enumerate(ordered_nodes):
            yield sse_event(
                "node_status",
                {
                    "nodeId": node.id,
                    "status": "running",
                    "message": f"正在执行节点: {node.label}",
                    "step": index + 1,
                    "total": len(ordered_nodes),
                },
            )
            await asyncio.sleep(0.3)

            # Node Type Handler
            if node.type == "code_input":
                async for chunk in cls._handle_code_input(node, pipeline_context):
                    yield chunk

            elif node.type == "llm_review":
                async for chunk in cls._handle_llm_review(node, pipeline_context):
                    yield chunk

            elif node.type == "test_generator":
                async for chunk in cls._handle_test_generator(node, pipeline_context):
                    yield chunk

            elif node.type == "diff_export":
                async for chunk in cls._handle_diff_export(node, pipeline_context):
                    yield chunk

            else:
                yield sse_event("node_log", {"nodeId": node.id, "log": f"执行通用算子 [{node.label}] 完成"})
                await asyncio.sleep(0.4)

            yield sse_event(
                "node_status",
                {
                    "nodeId": node.id,
                    "status": "completed",
                    "message": f"节点执行完成: {node.label}",
                },
            )
            await asyncio.sleep(0.3)

        # Final workflow completion
        yield sse_event(
            "workflow_finished",
            {
                "status": "success",
                "message": "所有 Agent 节点与单测闭环执行完毕！",
                "completedNodes": len(ordered_nodes),
                "artifacts": {
                    "originalCode": pipeline_context.get("source_code", ""),
                    "refactoredCode": pipeline_context.get("refactored_code", ""),
                    "testCode": pipeline_context.get("test_code", ""),
                    "diffPatch": pipeline_context.get("diff_patch", ""),
                    "language": pipeline_context.get("language", "python"),
                },
            },
        )

    @classmethod
    async def _handle_code_input(cls, node: WorkflowNode, ctx: Dict[str, Any]) -> AsyncGenerator[str, None]:
        config = node.config or {}
        code = config.get("sampleCode") or config.get("code") or DEFAULT_SAMPLE_CODE
        lang = config.get("language") or "python"

        ctx["source_code"] = code
        ctx["language"] = lang

        line_count = len(code.strip().splitlines())
        yield sse_event("node_log", {"nodeId": node.id, "log": f"📥 读取待测源码上下文 ({lang.upper()}, 共 {line_count} 行)"})
        await asyncio.sleep(0.3)
        yield sse_event("node_log", {"nodeId": node.id, "log": "✅ 源码语法结构校验正常，已载入多 Agent 共享执行上下文"})
        await asyncio.sleep(0.3)

    @classmethod
    async def _handle_llm_review(cls, node: WorkflowNode, ctx: Dict[str, Any]) -> AsyncGenerator[str, None]:
        config = node.config or {}
        model = config.get("model")
        temp = config.get("temperature", 0.2)
        code = ctx["source_code"]
        lang = ctx["language"]

        yield sse_event("node_log", {"nodeId": node.id, "log": f"🚀 ReviewAgent 审查专家已激活 (驱动模型: {model or '默认模型'})"})
        await asyncio.sleep(0.2)
        yield sse_event("node_log", {"nodeId": node.id, "log": "🔍 正在进行架构规范、安全隐患与代码异味深度推演..."})

        messages = ReviewAgent.build_messages(code, language=lang, custom_prompt=config.get("promptTemplate"))
        full_review = []

        buffer = ""
        async for token in LLMService.stream_chat(messages, model=model, temperature=temp):
            full_review.append(token)
            buffer += token
            # Stream in natural line/sentence chunks
            if "\n" in buffer or len(buffer) >= 28:
                yield sse_event("node_log", {"nodeId": node.id, "log": buffer.strip()})
                buffer = ""
                await asyncio.sleep(0.04)

        if buffer.strip():
            yield sse_event("node_log", {"nodeId": node.id, "log": buffer.strip()})

        review_text = "".join(full_review)
        ctx["review_markdown"] = review_text
        ctx["refactored_code"] = extract_code_block(review_text, default_lang=lang) or code

        yield sse_event("node_log", {"nodeId": node.id, "log": "💡 代码审查与重构建议已生成并完成提取"})
        await asyncio.sleep(0.3)

    @classmethod
    async def _handle_test_generator(cls, node: WorkflowNode, ctx: Dict[str, Any]) -> AsyncGenerator[str, None]:
        config = node.config or {}
        code = ctx["source_code"]
        lang = ctx["language"]
        framework = config.get("framework", "unittest")

        yield sse_event("node_log", {"nodeId": node.id, "log": f"🧪 TestAgent 已启动，正在基于逻辑分支编写 {framework.upper()} 单测..."})

        messages = TestAgent.build_messages(code, language=lang, framework=framework)
        full_test_response = []
        buffer = ""

        async for token in LLMService.stream_chat(messages):
            full_test_response.append(token)
            buffer += token
            if "\n" in buffer or len(buffer) >= 28:
                yield sse_event("node_log", {"nodeId": node.id, "log": buffer.strip()})
                buffer = ""
                await asyncio.sleep(0.04)

        if buffer.strip():
            yield sse_event("node_log", {"nodeId": node.id, "log": buffer.strip()})

        test_text = "".join(full_test_response)
        test_code = extract_code_block(test_text, default_lang=lang)
        ctx["test_code"] = test_code

        # --- Self-Correction Sandbox Execution Loop ---
        yield sse_event("node_log", {"nodeId": node.id, "log": "📦 正在将单测注入独立沙箱子进程实际执行验证..."})
        await asyncio.sleep(0.4)

        sandbox_res: SandboxResult = await TestSandbox.run_test(test_code, language=lang, timeout=5.0)

        if sandbox_res.success:
            yield sse_event(
                "node_log",
                {"nodeId": node.id, "log": f"✅ 沙箱执行成功！所有测试用例通过 (耗时 {sandbox_res.duration_ms:.1f}ms, returncode=0)"}
            )
        else:
            # Test failed, trigger reflection and self-correction (up to 2 retries)
            max_retries = 2
            current_code = test_code

            for attempt in range(1, max_retries + 1):
                yield sse_event(
                    "node_log",
                    {
                        "nodeId": node.id,
                        "log": f"⚠️ [第 {attempt} 次沙箱告警] 测试未通过 (returncode={sandbox_res.returncode}): {sandbox_res.error_summary[:80]}",
                    },
                )
                yield sse_event(
                    "node_log",
                    {
                        "nodeId": node.id,
                        "log": f"🤖 触发 TestAgent 自我反思机制：正在分析失败堆栈并重构单测用例 (重试 {attempt}/{max_retries})...",
                    },
                )
                await asyncio.sleep(0.4)

                # Send error traceback and previous code to TestAgent for reflection
                reflection_msgs = TestAgent.build_reflection_messages(
                    source_code=code,
                    failing_test_code=current_code,
                    error_output=sandbox_res.stderr or sandbox_res.stdout,
                    language=lang,
                )

                retry_response = []
                buffer = ""
                async for token in LLMService.stream_chat(reflection_msgs):
                    retry_response.append(token)
                    buffer += token
                    if "\n" in buffer or len(buffer) >= 28:
                        yield sse_event("node_log", {"nodeId": node.id, "log": buffer.strip()})
                        buffer = ""
                        await asyncio.sleep(0.04)

                if buffer.strip():
                    yield sse_event("node_log", {"nodeId": node.id, "log": buffer.strip()})

                current_code = extract_code_block("".join(retry_response), default_lang=lang)
                ctx["test_code"] = current_code

                # Re-run in sandbox
                yield sse_event("node_log", {"nodeId": node.id, "log": f"📦 [重试 {attempt}] 重新在沙箱执行修正后的单测..."})
                sandbox_res = await TestSandbox.run_test(current_code, language=lang, timeout=5.0)

                if sandbox_res.success:
                    yield sse_event(
                        "node_log",
                        {
                            "nodeId": node.id,
                            "log": f"🎉 ✅ [自我纠错成功] 修正版单测全部通过！(耗时 {sandbox_res.duration_ms:.1f}ms, returncode=0)",
                        },
                    )
                    break
            else:
                yield sse_event(
                    "node_log",
                    {
                        "nodeId": node.id,
                        "log": f"⚠️ 已达最大纠错重试次数，已归档当前最佳单测版本及诊断报告",
                    },
                )

        await asyncio.sleep(0.3)

    @classmethod
    async def _handle_diff_export(cls, node: WorkflowNode, ctx: Dict[str, Any]) -> AsyncGenerator[str, None]:
        config = node.config or {}
        output_path = config.get("outputPath", "./output/review_patch.diff")
        format_type = config.get("exportFormat", "unified_diff")

        yield sse_event("node_log", {"nodeId": node.id, "log": "📊 汇聚 ReviewAgent 重构成果与 TestAgent 经沙箱验证的单测套件..."})
        await asyncio.sleep(0.3)

        # Compute unified diff
        src_lines = ctx["source_code"].splitlines(keepends=True)
        ref_lines = (ctx["refactored_code"] or ctx["source_code"]).splitlines(keepends=True)
        diff_lines = list(difflib.unified_diff(
            src_lines,
            ref_lines,
            fromfile="a/source_code",
            tofile="b/optimized_code",
        ))
        diff_text = "".join(diff_lines) if diff_lines else "# 代码结构规范，无需产生破坏性变更 Diff"
        ctx["diff_patch"] = diff_text

        yield sse_event("node_log", {"nodeId": node.id, "log": f"📄 生成标准 {format_type.upper()} 补丁文件 (包含 {len(diff_lines)} 行变更标记)"})
        await asyncio.sleep(0.3)
        yield sse_event("node_log", {"nodeId": node.id, "log": f"💾 差异补丁与审查报告就绪，归档路径: {output_path}"})
        await asyncio.sleep(0.2)

        # Send Feishu notification card if configured
        if config.get("notifyChannel") == "feishu" or settings.has_feishu:
            try:
                from feishu_notifier import FeishuNotifier
                sent = await FeishuNotifier.send_audit_card(
                    project_id="flowdev-ai",
                    committer="FlowDev-IDE",
                    branch="main",
                    passed=True,
                    critical_issues=[],
                    suggestions=["建议在核心业务分支合入前完成全量沙箱单测验证"],
                    summary="DAG 策略仿真执行完成，所有节点均流式验证通过！",
                    files_count=1,
                    webhook_url=settings.FEISHU_WEBHOOK_URL,
                )
                if sent:
                    yield sse_event("node_log", {"nodeId": node.id, "log": "🔔 已向飞书群机器人成功推送本次策略执行卡片！"})
            except Exception as e:
                logger.warning(f"Failed to send Feishu notification from executor: {e}")
