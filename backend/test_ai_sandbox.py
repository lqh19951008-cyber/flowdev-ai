import asyncio
from sandbox import TestSandbox, SandboxResult
from agents import ReviewAgent, TestAgent, extract_code_block
from ai_service import LLMService

async def test_sandbox_success():
    python_code = """
import unittest

def add(a, b):
    return a + b

class TestAdd(unittest.TestCase):
    def test_add(self):
        self.assertEqual(add(1, 2), 3)

if __name__ == '__main__':
    unittest.main()
"""
    res = await TestSandbox.run_test(python_code, language="python", timeout=5.0)
    assert res.success is True, f"Sandbox should pass, got: {res.stderr}"
    print("[OK] TestSandbox success case passed")

async def test_sandbox_failure_and_capture():
    python_code = """
import unittest

def add(a, b):
    return a + b

class TestAdd(unittest.TestCase):
    def test_add_wrong(self):
        self.assertEqual(add(1, 2), 999) # Intentionally wrong

if __name__ == '__main__':
    unittest.main()
"""
    res = await TestSandbox.run_test(python_code, language="python", timeout=5.0)
    assert res.success is False, "Sandbox should fail on wrong assertion"
    assert "AssertionError" in res.stderr or "FAILED" in res.stderr
    print("[OK] TestSandbox failure & error summary capture passed")

async def test_llm_stream():
    messages = [{"role": "user", "content": "1+2=?"}]
    tokens = []
    async for token in LLMService.stream_chat(messages):
        tokens.append(token)
    assert len(tokens) > 0
    print("[OK] LLMService token streaming passed, tokens received:", len(tokens))

async def test_agents_and_reflection():
    review_msgs = ReviewAgent.build_messages("def foo(): pass")
    assert len(review_msgs) == 2
    assert "ReviewAgent" in review_msgs[0]["content"]

    test_msgs = TestAgent.build_messages("def foo(): pass")
    assert len(test_msgs) == 2
    assert "TestAgent" in test_msgs[0]["content"]

    reflection_msgs = TestAgent.build_reflection_messages(
        source_code="def foo(): pass",
        failing_test_code="self.assertEqual(foo(), 1)",
        error_output="AssertionError: None != 1"
    )
    assert "AssertionError" in reflection_msgs[1]["content"]
    assert "自我纠错" in reflection_msgs[1]["content"]
    print("[OK] Agent prompt & reflection message building passed")

async def main():
    await test_sandbox_success()
    await test_sandbox_failure_and_capture()
    await test_llm_stream()
    await test_agents_and_reflection()
    print("All Milestone 4 backend tests passed successfully!")

if __name__ == "__main__":
    asyncio.run(main())
