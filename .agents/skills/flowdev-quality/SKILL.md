---
name: flowdev-quality
description: FlowDev-AI Code Quality & Pre-Commit Gatekeeper Defensive Guidelines for flowdev-ai.
---

# FlowDev-AI Defensive Coding Skill (flowdev-ai)

This skill contains active quality guidelines, architectural constraints, and learned anti-patterns for `flowdev-ai`.

## 🛡️ Critical Quality Gate Requirements
When generating or refactoring code in this repository, you MUST adhere to the following rules:

### Active Pre-Commit Gatekeeper Regex Checks
- **防御性可选链与空指针安全防护规范**: `\b(null|undefined)\.[a-zA-Z0-9_]+` (Level: critical)
  *Enforcement:* 检测到针对 null/undefined 的直接属性访问，请使用可选链 (?.) 或显式判空防御！
- **安全敏感接口与高危函数防护规范**: `(?ms)(?:^|[^A-Za-z_])(?:eval\s*\(|exec\s*\(|execSync\s*\([^)]*\$\{|allow_origins\s*=\s*\[\s*[\'"]\*[\'"]\s*\])` (Level: critical)
  *Enforcement:* FlowDev 安全门禁拦截：检测到高危代码模式（eval/exec/shell模板注入/通配CORS），请改用execFile数组参数与显式白名单！
- **杜绝危险动态执行与代码注入防御规范**: `\b(eval|exec)\s*\(` (Level: critical)
  *Enforcement:* 严禁使用 eval() 或 exec() 危险动态执行函数！
- **React/TS 组件空值安全访问与可选链防御规范**: `(?:const|let)\s+\w+\s*=\s*(?:use\w+\(|useStore\(|props\.|state\.)[^;\n]*\.(?!\?)[a-zA-Z_]\w*` (Level: critical)
  *Enforcement:* 🚫 [FlowDev-Gate] 检测到对可能为 undefined 的数据源直接做属性解构。必须使用可选链 (?.) + 空值合并 (?? 默认值) 兜底！

## 📚 Synthesized Engineering Best Practices
### Rule 1: 防御性可选链与空指针安全防护规范
**Principle:** 禁止对深层对象或外部输入进行未经校验的解构和直接链式访问，必须使用可选链（?.）与空值合并运算符（??）。

# Skill: Defensive Optional Chaining & Null Safety

## Guidelines for AI Coding Assistants
1. Always use optional chaining (`?.`) when traversing 2+ levels deep into objects that may be undefined.
2. Provide safe fallbacks with `??` (nullish coalescing) instead of assuming values always exist.
3. Perform guard clauses early in handler functions (`if (!payload) return;`).
4. Do not use dangerous type assertions (`as any` or `!`) to bypass compiler type checks.

## Example
```typescript
// Safe access pattern
const total = cart?.summary?.totalAmount ?? 0;
```


### Rule 2: 安全敏感接口与高危函数防护规范
**Principle:** 禁止在任何业务代码中使用 eval/exec、字符串拼接 SQL、通配 CORS+凭据组合与硬编码 API Key；所有 shell 调用必须使用 execFile/spawn 数组参数形式。

# Skill: Security Sensitive Interfaces & RCE Defense

## 1. 永远禁止（Hard Block）
1. 禁止动态执行入口 eval / exec / Function
2. 禁止字符串拼接构造 SQL，统一使用参数化查询
3. 禁止硬编码任何形式的密钥与 Token (sk-, ghp-, AKID)
4. 禁止 shell 字符串模板拼接，改用 execFile / spawn 数组参数
5. 禁止 allow_origins=['*'] 与 allow_credentials=True 组合


### Rule 3: 杜绝危险动态执行与代码注入防御规范
**Principle:** 严禁在业务逻辑中调用 eval()、exec() 或未参数化的 SQL 字符串拼接，消除远程代码执行（RCE）与注入风险。

# Skill: Secure Execution & Injection Prevention

## Context
Prevent security vulnerabilities arising from untrusted input execution or unsanitized database queries.

## Guidelines
1. Never recommend or generate eval(), exec(), or Function() calls.
2. Always use parameterized queries or ORM builders.
3. Validate all incoming payload schemas with Zod or Pydantic.


### Rule 4: React/TS 组件空值安全访问与可选链防御规范
**Principle:** 严禁直接对可能为 null/undefined 的 store 数据、props、searchParams 做裸属性访问与裸调用。所有可选数据流必须强制使用可选链 + 默认值兜底，并对 URL 参数做白名单校验。

# Skill: React / TS Null Safety & Guard Pattern

## 编码准则
1. 可选链优先：访问对象属性前一律用 ?.
2. 空值合并兜底：渲染文本用 value ?? '默认值'
3. 类型守卫渲染：对象为 null 时返回 <Skeleton /> 或 <Empty />
4. URL 参数白名单：任何 params.get(...) 必须经由正则白名单校验后再写入 Store

