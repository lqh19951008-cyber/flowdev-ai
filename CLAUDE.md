# flowdev-ai - Code Quality Standards & Agent Skills
> Automatically synthesized and maintained by FlowDev-AI Pre-Commit Gatekeeper.
> Target Spec: Claude Code Guidelines (CLAUDE.md)

## General Instructions
You are the AI coding companion working on repository 'flowdev-ai'.
You must strictly adhere to the following quality standards and learned architectural constraints.
Under no circumstances should you generate code that violates these rules.

### Pre-Commit Quality Gate Regex Constraints
The repository gatekeeper actively blocks commits violating these regex patterns:
- **未防御的深层属性访问与空对象引用**: `\b(null|undefined)\.[a-zA-Z0-9_]+`
  *Reason:* 检测到针对 null/undefined 的直接属性访问，请使用可选链 (?.) 或显式判空防御！
- **拦截高危函数 / 字符串拼接 SQL / 硬编码密钥 / 通配 CORS / shell 模板注入 / 链式 .get 缺 None 防御**: `(?ms)(?:^|[^A-Za-z_])(?:eval\s*\(|exec\s*\(|execSync\s*\([^)]*\$\{|allow_origins\s*=\s*\[\s*["']\*["']\s*\]|["']\s*\+\s*[A-Za-z_][A-Za-z0-9_]*\s*\+\s*["'].*?(?:SELECT|INSERT|UPDATE|DELETE|FROM\s+\w+)|sk-[A-Za-z0-9_-]{16,}\s*=\s*["'][^"']+["']|(?<![A-Za-z_])\.get\([^)]+\)\s*\.get\(|child_process.*?execSync\s*\(\s*`[^`]*\$\{))`
  *Reason:* FlowDev 安全门禁拦截：检测到高危代码模式（eval/exec/shell模板注入/SQL字符串拼接/硬编码sk-/通配CORS/缺None防御的链式.get），请改用参数化查询、execFile数组参数、显式CORS域名白名单、`or {}`空值防御与Pydantic/Zod强类型校验。

### Synthesized Agent Skills & Defensive Standards
#### Skill 1: 防御性可选链与空指针安全防护规范
**Summary:** 禁止对深层对象或外部输入进行未经校验的解构和直接链式访问，必须使用可选链（?.）与空值合并运算符（??）。

# Skill: Defensive Optional Chaining & Null Safety

## Context
When writing JavaScript / TypeScript code that accesses external API payloads, nested state, or optional parameters, avoid direct chaining that causes runtime crashes.

## Guidelines for AI Coding Assistants
1. **Always use optional chaining (`?.`)** when traversing 2+ levels deep into objects that may be undefined.
2. **Provide safe fallbacks with `??`** (nullish coalescing) instead of assuming values always exist.
3. **Perform guard clauses** early in handler functions (`if (!payload) return;`).
4. **Do not use dangerous type assertions** (`as any` or `!`) to bypass compiler type checks.

## Example
```typescript
// Safe access pattern
const total = cart?.summary?.totalAmount ?? 0;
```


#### Skill 2: 安全敏感接口与高危函数防护规范（eval/exec/SQL注入/SSRF/CORS/鉴权/空指针硬编码凭据）
**Summary:** 禁止在任何业务代码中使用 eval/exec、字符串拼接 SQL、未校验的内网 URL 请求、allow_origins=['*']+credentials 组合、未鉴权的管理端点、硬编码 API Key，以及对可能为 None 的返回值直接调用方法；所有 shell 调用必须使用 execFile/spawn 数组参数形式；任何敏感 IO（写 .env、读 git 暂存区）必须先做权限校验、路径边界校验与结构校验，杜绝 RCE/SSRF/凭据泄漏/越权写入。

# FlowDev 安全敏感接口与高危函数防护 Skill

> 适用：Python (FastAPI) 后端、Node.js CLI / Hook、TypeScript 前端
> 触发：编写/修改 API 路由、shell 命令执行、数据库访问、CORS/中间件配置、LLM/外部 HTTP 调用、环境变量与 .env 写入、git hook、文件读取、敏感字段返回等场景。

---

## 1. 永远禁止（Hard Block）

1. **禁止** 在任何业务路径使用 `eval(...)` / `exec(...)` / `Function(...)` / `vm.runInNewContext` 等动态执行入口；若必须动态逻辑，使用白名单 dispatch / 表达式解析库（如 `simpleeval`）。
2. **禁止** 字符串拼接构造 SQL；统一使用参数化查询（SQLAlchemy `text(:n)`、psycopg 参数、`?` 占位符）。
3. **禁止** 硬编码任何形式的密钥、Token、Webhook、数据库密码、JWT Secret（正则：`sk-[A-Za-z0-9_-]{16,}`、`AKID`、`xoxb-`、`ghp_`、`AIza[0-9A-Za-z_-]{35}`）。必须从环境变量 / KMS / Vault 注入。
4. **禁止** `execSync(\`git show :${filepath}\`)` 这类字符串模板 → shell 的调用；一律改用 `execFileSync("git", ["show", ":" + filepath])` 或 `spawn(cmd, [args...])` 数组形式。
5. **禁止** `allow_origins=["*"]` 与 `allow_credentials=True` 同时出现；通配仅可在 `allow_credentials=False` 时用于开发环境，并通过环境变量显式声明。
6. **禁止** 任何写 `.env` / `process.env` / 系统环境 的接口不经过鉴权与字段白名单。

## 2. 强制要求（Must-Have）

### 2.1 鉴权
- 所有 `/api/admin/*`、`/api/llm/*`、`/api/feishu/*`、`/api/projects/*/policy`、`/api/projects/*/gate-mode`、`/api/projects/*/rules/*`、`/api/env` 必须挂 `Depends(require_admin)` 或等价鉴权依赖。
- 未鉴权端点禁止返回 `api_key` / `webhook_url` / `password` 等敏感字段；列表接口必须做 `mask()` 脱敏。

### 2.2 输入校验
- 所有写接口必须有 Pydantic / Zod / TypeBox 强类型 schema，字段名白名单，禁止 `dict` 直通。
- 关键字段使用 `Literal[...]` 限定枚举（如 `failure_action` 仅允许 `block|warn|bypass`）。

### 2.3 SSRF 防御（任何接收用户输入 URL 的端点）
- 仅允许 `https://`；拒绝 `http://`、`file://`、`gopher://`。
- `follow_redirects=False`。
- 解析 URL 后校验 IP：`is_private | is_loopback | is_link_local | is_multicast | is_reserved` 全部拒绝。
- 域名场景必须先解析 A/AAAA 再校验，且结果需 pin，避免 DNS rebinding。

### 2.4 CORS
```python
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "https://app.flowdev.ai").split(",")
app.add_middleware(CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET","POST","PUT","DELETE"],
    allow_headers=["Authorization","Content-Type"])
```

### 2.5 None / 空值防御
- 对数据库查询返回值、字典取值、`.env` 读取、API 响应一律假设可能为 `None` / `{}` / `undefined`。
- 模式：`result = db.get(...) or {}` / `data?.field ?? default` / `if (!scanResult || typeof scanResult.passed !== "boolean") reject(...)`。

### 2.6 导入一致性
- 任何符号在使用前必须在文件顶部显式 import；不要相信 IDE 自动 import 在运行时一定存在。
- 推荐：在 CI 加 `pyflakes` / `ruff F401,F821` / `tsc --noEmit` 兜底。

### 2.7 Node.js Shell 与文件 IO
- 所有 `child_process` 调用必须用数组参数形式；禁用 backtick / `${}` 模板拼命令。
- 所有 `fs.readFile*` 必须先 `path.resolve` 后判断是否位于 `git rev-parse --show-toplevel` 之内，阻断 `../../../` 越界。
- 所有 shell 命令结果必须做 `trim()` + 存在性校验；任何 `execSync` 必须 `stdio: ["pipe","pipe","ignore"]` 防止泄漏到 stderr。

### 2.8 旁路开关审计
- 所有 `FLOWDEV_DISABLE` / `BYPASS` / `SKIP` / `git config flowdev.enabled=false` / `--disable` / `--warn` 必须：
  1. 写入 `.flowdev-bypass.log`（含时间戳、user、reason、commit hash）；
  2. 触发 webhook 通知安全团队；
  3. 在 CI 报告里以红色高亮标记。

## 3. 检测模式（pre-commit 正则）

| 模式 | 含义 |
| --- | --- |
| `\beval\s*\(` / `\bexec\s*\(` | Python 高危函数 |
| `"\s*\+\s*\w+\s*\+\s*"\s*SELECT\|INSERT\|UPDATE\|DELETE` | 字符串拼接 SQL |
| `(sk-[A-Za-z0-9_-]{16,})\s*=\s*["']` | 硬编码 OpenAI Key |
| `allow_origins\s*=\s*\[["']\*["']\]` 且同文件存在 `allow_credentials\s*=\s*True` | 通配 CORS + 凭据 |
| `execSync\s*\(\s*` 同一行包含 `\$\{` | shell 模板注入 |
| `\.get\([^)]+\)\s*\.get\(` 无 `or\s*\{\}` 保护 | 链式 .get 缺 None 防御 |

## 4. 出错时该怎么做

- `NameError`：检查 import；改用类型显式返回（`JSONResponse(status_code=404, ...)`）。
- `AttributeError: 'NoneType'`：在每一层 DB/IO 返回后立即 `or {}` / `?? {}`。
- `execSync` / `spawn` 命令注入：立即改为 `execFileSync` 数组参数。
- 发现硬编码 Key：立刻 `git filter-repo` 替换 + 轮换真实凭据 + 提交报告。

## 5. 审查清单（提交前自查）

- [ ] 没有 `eval`/`exec`/`Function`/`vm`
- [ ] SQL 全部参数化
- [ ] 没有硬编码 `sk-`/`ghp_`/`AKID`/`xoxb-`
- [ ] 管理端点都有 `Depends(require_admin)`
- [ ] CORS 没有 `*+credentials` 组合
- [ ] 接收 URL 的端点都做了 IP 白名单校验
- [ ] 写 `.env` 前做了字段白名单 + 鉴权
- [ ] 所有 `execSync` 改 `execFileSync` 数组参数
- [ ] 所有 `db.get` 都有 `or {}` 防御
- [ ] 所有 bypass 都有审计日志

<!-- FLOWDEV_RULES_START -->
# flowdev-ai - Code Quality Standards & Agent Skills
> Automatically synthesized and maintained by FlowDev-AI Pre-Commit Gatekeeper.
> Target Spec: Claude Code Guidelines (CLAUDE.md)

## General Instructions
You are the AI coding companion working on repository 'flowdev-ai'.
You must strictly adhere to the following quality standards and learned architectural constraints.
Under no circumstances should you generate code that violates these rules.

### Pre-Commit Quality Gate Regex Constraints
The repository gatekeeper actively blocks commits violating these regex patterns:
- **未防御的深层属性访问与空对象引用**: `\b(null|undefined)\.[a-zA-Z0-9_]+`
  *Reason:* 检测到针对 null/undefined 的直接属性访问，请使用可选链 (?.) 或显式判空防御！
- **拦截高危函数 / 字符串拼接 SQL / 硬编码密钥 / 通配 CORS / shell 模板注入 / 链式 .get 缺 None 防御**: `(?ms)(?:^|[^A-Za-z_])(?:eval\s*\(|exec\s*\(|execSync\s*\([^)]*\$\{|allow_origins\s*=\s*\[\s*["']\*["']\s*\]|["']\s*\+\s*[A-Za-z_][A-Za-z0-9_]*\s*\+\s*["'].*?(?:SELECT|INSERT|UPDATE|DELETE|FROM\s+\w+)|sk-[A-Za-z0-9_-]{16,}\s*=\s*["'][^"']+["']|(?<![A-Za-z_])\.get\([^)]+\)\s*\.get\(|child_process.*?execSync\s*\(\s*`[^`]*\$\{))`
  *Reason:* FlowDev 安全门禁拦截：检测到高危代码模式（eval/exec/shell模板注入/SQL字符串拼接/硬编码sk-/通配CORS/缺None防御的链式.get），请改用参数化查询、execFile数组参数、显式CORS域名白名单、`or {}`空值防御与Pydantic/Zod强类型校验。
- **高危动态执行与注入函数检测**: `\b(eval|exec)\s*\(`
  *Reason:* 严禁使用 eval() 或 exec() 危险动态执行函数！
- **禁止在 React 组件中直接访问可能为 null/undefined 的属性**: `(?:const|let)\s+\w+\s*=\s*(?:use\w+\(|useStore\(|props\.|state\.)[^;\n]*\.(?!\?)[a-zA-Z_]\w*`
  *Reason:* 🚫 [FlowDev-Gate] 检测到对可能为 undefined 的数据源直接做属性解构。必须使用可选链 (?.) + 空值合并 (?? '默认值') 兜底，或先做类型守卫 (if (!x) return <Empty/>)。涉及 URL 参数透传时还需白名单校验。详见 .cursorrules/react-ts-null-safety。

### Synthesized Agent Skills & Defensive Standards
#### Skill 1: 防御性可选链与空指针安全防护规范
**Summary:** 禁止对深层对象或外部输入进行未经校验的解构和直接链式访问，必须使用可选链（?.）与空值合并运算符（??）。

# Skill: Defensive Optional Chaining & Null Safety

## Context
When writing JavaScript / TypeScript code that accesses external API payloads, nested state, or optional parameters, avoid direct chaining that causes runtime crashes.

## Guidelines for AI Coding Assistants
1. **Always use optional chaining (`?.`)** when traversing 2+ levels deep into objects that may be undefined.
2. **Provide safe fallbacks with `??`** (nullish coalescing) instead of assuming values always exist.
3. **Perform guard clauses** early in handler functions (`if (!payload) return;`).
4. **Do not use dangerous type assertions** (`as any` or `!`) to bypass compiler type checks.

## Example
```typescript
// Safe access pattern
const total = cart?.summary?.totalAmount ?? 0;
```


#### Skill 2: 安全敏感接口与高危函数防护规范（eval/exec/SQL注入/SSRF/CORS/鉴权/空指针硬编码凭据）
**Summary:** 禁止在任何业务代码中使用 eval/exec、字符串拼接 SQL、未校验的内网 URL 请求、allow_origins=['*']+credentials 组合、未鉴权的管理端点、硬编码 API Key，以及对可能为 None 的返回值直接调用方法；所有 shell 调用必须使用 execFile/spawn 数组参数形式；任何敏感 IO（写 .env、读 git 暂存区）必须先做权限校验、路径边界校验与结构校验，杜绝 RCE/SSRF/凭据泄漏/越权写入。

# FlowDev 安全敏感接口与高危函数防护 Skill

> 适用：Python (FastAPI) 后端、Node.js CLI / Hook、TypeScript 前端
> 触发：编写/修改 API 路由、shell 命令执行、数据库访问、CORS/中间件配置、LLM/外部 HTTP 调用、环境变量与 .env 写入、git hook、文件读取、敏感字段返回等场景。

---

## 1. 永远禁止（Hard Block）

1. **禁止** 在任何业务路径使用 `eval(...)` / `exec(...)` / `Function(...)` / `vm.runInNewContext` 等动态执行入口；若必须动态逻辑，使用白名单 dispatch / 表达式解析库（如 `simpleeval`）。
2. **禁止** 字符串拼接构造 SQL；统一使用参数化查询（SQLAlchemy `text(:n)`、psycopg 参数、`?` 占位符）。
3. **禁止** 硬编码任何形式的密钥、Token、Webhook、数据库密码、JWT Secret（正则：`sk-[A-Za-z0-9_-]{16,}`、`AKID`、`xoxb-`、`ghp_`、`AIza[0-9A-Za-z_-]{35}`）。必须从环境变量 / KMS / Vault 注入。
4. **禁止** `execSync(\`git show :${filepath}\`)` 这类字符串模板 → shell 的调用；一律改用 `execFileSync("git", ["show", ":" + filepath])` 或 `spawn(cmd, [args...])` 数组形式。
5. **禁止** `allow_origins=["*"]` 与 `allow_credentials=True` 同时出现；通配仅可在 `allow_credentials=False` 时用于开发环境，并通过环境变量显式声明。
6. **禁止** 任何写 `.env` / `process.env` / 系统环境 的接口不经过鉴权与字段白名单。

## 2. 强制要求（Must-Have）

### 2.1 鉴权
- 所有 `/api/admin/*`、`/api/llm/*`、`/api/feishu/*`、`/api/projects/*/policy`、`/api/projects/*/gate-mode`、`/api/projects/*/rules/*`、`/api/env` 必须挂 `Depends(require_admin)` 或等价鉴权依赖。
- 未鉴权端点禁止返回 `api_key` / `webhook_url` / `password` 等敏感字段；列表接口必须做 `mask()` 脱敏。

### 2.2 输入校验
- 所有写接口必须有 Pydantic / Zod / TypeBox 强类型 schema，字段名白名单，禁止 `dict` 直通。
- 关键字段使用 `Literal[...]` 限定枚举（如 `failure_action` 仅允许 `block|warn|bypass`）。

### 2.3 SSRF 防御（任何接收用户输入 URL 的端点）
- 仅允许 `https://`；拒绝 `http://`、`file://`、`gopher://`。
- `follow_redirects=False`。
- 解析 URL 后校验 IP：`is_private | is_loopback | is_link_local | is_multicast | is_reserved` 全部拒绝。
- 域名场景必须先解析 A/AAAA 再校验，且结果需 pin，避免 DNS rebinding。

### 2.4 CORS
```python
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "https://app.flowdev.ai").split(",")
app.add_middleware(CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET","POST","PUT","DELETE"],
    allow_headers=["Authorization","Content-Type"])
```

### 2.5 None / 空值防御
- 对数据库查询返回值、字典取值、`.env` 读取、API 响应一律假设可能为 `None` / `{}` / `undefined`。
- 模式：`result = db.get(...) or {}` / `data?.field ?? default` / `if (!scanResult || typeof scanResult.passed !== "boolean") reject(...)`。

### 2.6 导入一致性
- 任何符号在使用前必须在文件顶部显式 import；不要相信 IDE 自动 import 在运行时一定存在。
- 推荐：在 CI 加 `pyflakes` / `ruff F401,F821` / `tsc --noEmit` 兜底。

### 2.7 Node.js Shell 与文件 IO
- 所有 `child_process` 调用必须用数组参数形式；禁用 backtick / `${}` 模板拼命令。
- 所有 `fs.readFile*` 必须先 `path.resolve` 后判断是否位于 `git rev-parse --show-toplevel` 之内，阻断 `../../../` 越界。
- 所有 shell 命令结果必须做 `trim()` + 存在性校验；任何 `execSync` 必须 `stdio: ["pipe","pipe","ignore"]` 防止泄漏到 stderr。

### 2.8 旁路开关审计
- 所有 `FLOWDEV_DISABLE` / `BYPASS` / `SKIP` / `git config flowdev.enabled=false` / `--disable` / `--warn` 必须：
  1. 写入 `.flowdev-bypass.log`（含时间戳、user、reason、commit hash）；
  2. 触发 webhook 通知安全团队；
  3. 在 CI 报告里以红色高亮标记。

## 3. 检测模式（pre-commit 正则）

| 模式 | 含义 |
| --- | --- |
| `\beval\s*\(` / `\bexec\s*\(` | Python 高危函数 |
| `"\s*\+\s*\w+\s*\+\s*"\s*SELECT\|INSERT\|UPDATE\|DELETE` | 字符串拼接 SQL |
| `(sk-[A-Za-z0-9_-]{16,})\s*=\s*["']` | 硬编码 OpenAI Key |
| `allow_origins\s*=\s*\[["']\*["']\]` 且同文件存在 `allow_credentials\s*=\s*True` | 通配 CORS + 凭据 |
| `execSync\s*\(\s*` 同一行包含 `\$\{` | shell 模板注入 |
| `\.get\([^)]+\)\s*\.get\(` 无 `or\s*\{\}` 保护 | 链式 .get 缺 None 防御 |

## 4. 出错时该怎么做

- `NameError`：检查 import；改用类型显式返回（`JSONResponse(status_code=404, ...)`）。
- `AttributeError: 'NoneType'`：在每一层 DB/IO 返回后立即 `or {}` / `?? {}`。
- `execSync` / `spawn` 命令注入：立即改为 `execFileSync` 数组参数。
- 发现硬编码 Key：立刻 `git filter-repo` 替换 + 轮换真实凭据 + 提交报告。

## 5. 审查清单（提交前自查）

- [ ] 没有 `eval`/`exec`/`Function`/`vm`
- [ ] SQL 全部参数化
- [ ] 没有硬编码 `sk-`/`ghp_`/`AKID`/`xoxb-`
- [ ] 管理端点都有 `Depends(require_admin)`
- [ ] CORS 没有 `*+credentials` 组合
- [ ] 接收 URL 的端点都做了 IP 白名单校验
- [ ] 写 `.env` 前做了字段白名单 + 鉴权
- [ ] 所有 `execSync` 改 `execFileSync` 数组参数
- [ ] 所有 `db.get` 都有 `or {}` 防御
- [ ] 所有 bypass 都有审计日志


#### Skill 3: 杜绝危险动态执行与代码注入防御规范
**Summary:** 严禁在业务逻辑中调用 eval()、exec() 或未参数化的 SQL 字符串拼接，消除远程代码执行（RCE）与注入风险。

# Skill: Secure Execution & Injection Prevention

## Context
Prevent security vulnerabilities arising from untrusted input execution or unsanitized database queries.

## Guidelines for AI Coding Assistants
1. Never recommend or generate `eval()`, `exec()`, `Function()`, or `setTimeout` with string arguments.
2. Always use parameterized queries or ORM query builders (e.g. Prisma, Drizzle, SQLAlchemy) for database interactions.
3. Validate all incoming payload schemas with Zod, Joi, or Pydantic.


#### Skill 4: React/TS 组件空值安全访问与可选链防御规范
**Summary:** FlowDev 仓库出现 50+ 处 '未处理的 null 异常隐患'，集中在 Dashboard 组件、Modal 表单、Store 状态消费与 URL 参数透传场景。根因是直接对可能为 null/undefined 的 store 数据、props、searchParams、API 响应做属性解构与函数调用，TypeScript 严格模式下编译可过但运行时一旦上游返回空值即触发 Cannot read properties of null/undefined 白屏崩溃。所有可选数据流必须强制使用可选链 + 默认值兜底，并对 URL 参数做白名单校验，禁止将原始 searchParams 直接灌入全局 Store。

---
name: react-ts-null-safety
description: 在 FlowDev 仓库编写 React/TypeScript 组件时强制空值安全访问，禁止直接对可能为 null/undefined 的 store/props/URL 参数做属性解构。
applies_to:
  - "src/components/**/*.tsx"
  - "src/stores/**/*.ts"
  - "src/app/**/*.tsx"
trigger:
  - context: "编辑 React 组件渲染逻辑"
  - context: "消费 zustan / redux / context 提供的可选数据"
  - context: "读取 useSearchParams / location.search / router.query"
  - context: "处理 Antd Form 字段值"
---

# React/TS 空值安全防御规范

## 编码准则（强制）

### 1. Store / Props 数据消费三原则
- **可选链优先**：访问对象属性前一律用 `?.`
- **空值合并兜底**：渲染文本用 `value ?? '默认值'`
- **类型守卫渲染**：对象为 null 时返回 `<Skeleton />` 或 `<Empty />`，禁止返回半个组件

### 2. URL 参数透传白名单校验
- 任何 `params.get(...)` 的结果写入全局 Store / 透传给下游 API 前，必须校验：
  - 非空字符串
  - 长度上限（建议 ≤ 64）
  - 字符集白名单正则（如 `/^[a-zA-Z0-9_-]+$/`）
- 失败时回退默认值或 `null`，绝不静默放行

### 3. Antd Form 字段安全读取
- `form.getFieldValue(key)` 必须 `?? ''` 或 `?? null` 后再使用
- 提交前对所有必填字段做非空 + 格式校验，校验失败 `return` 并提示用户
- 禁止 `fieldA + fieldB` 字符串拼接，可能产出 `'undefinedxxx'`

### 4. Zustand Selector 安全消费
```ts
// ✅ 正确：先 select 字段，再做空值守卫
const projectId = useFlowStore(s => s.currentProject?.id);
if (!projectId) return <Empty description="请选择项目" />;
```

### 5. useState 未使用 setter 处理
- 解构出但未使用的 setter：直接改为 `const xxx = 默认值;`
- 若后续会用到：保留并加 `// eslint-disable-next-line @typescript-eslint/no-unused-vars`

## 反模式（禁止）

```tsx
// ❌ 直接属性访问
{user.name}
{project.owner.avatar}
{config.feishu.webhook}

// ❌ 原始 searchParams 透传
setSelectedProjectId(params.get('project'));

// ❌ 表单字段裸拼接
const url = webhook + '/hook';

// ❌ 渲染函数返回可能为 undefined 的 JSX 片段
return data?.map(...) // data 为 null 时 React 报 'map is not function'
```

## 正模式（推荐）

```tsx
// ✅ 三件套：可选链 + 兜底 + 守卫
const name = user?.name ?? '匿名用户';
if (!data) return <Skeleton />;
return data.map(item => <Item key={item.id} {...item} />);

// ✅ URL 参数白名单
const safeId = (() => {
  const raw = params.get('id');
  return raw && /^p-[a-z0-9]{1,12}$/.test(raw) ? raw : null;
})();

// ✅ 表单字段非空校验
const url = form.getFieldValue('webhook')?.trim();
if (!url) { message.error('必填'); return; }
```

## 自检清单（提交前必看）
- [ ] 所有 `?.` 出现的地方是否搭配了 `??` 兜底
- [ ] 所有 useSearchParams 结果是否经过白名单校验
- [ ] 所有 zustand selector 是否处理了 undefined 情况
- [ ] 所有 form.getFieldValue 是否做了非空判断
- [ ] 是否存在解构出但未使用的 setter（需清理）

## 关联门禁
- pre-commit: `no-direct-property-access`
- CI: ESLint `@typescript-eslint/no-non-null-assertion` + 自定义 `no-raw-searchparams-in-store`
<!-- FLOWDEV_RULES_END -->
