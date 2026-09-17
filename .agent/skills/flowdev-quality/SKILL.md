---
name: flowdev-quality
description: FlowDev-AI Code Quality & Pre-Commit Gatekeeper Defensive Guidelines for flowdev-ai.
---

# FlowDev-AI Defensive Coding Skill (flowdev-ai)

This skill contains active quality guidelines, architectural constraints, and learned anti-patterns for `flowdev-ai`.

## 🛡️ Critical Quality Gate Requirements
When generating or refactoring code in this repository, you MUST adhere to the following rules:

## 📚 Standard Defensive Rules
- Always perform defensive null checks (`?.`, `??`).
- Never use dangerous dynamic execution functions like `eval()`.
- Keep all credentials and tokens in environment variables.
- Write unit tests for core edge cases.