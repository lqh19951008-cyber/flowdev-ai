# ==============================================================================
# FlowDev-AI 服务启动脚本 (Start Service - 支持前后端全套或单独启动)
# ==============================================================================
[CmdletBinding()]
param(
    [switch]$NoBrowser,
    [switch]$FollowLogs,
    [switch]$FrontendOnly,
    [switch]$BackendOnly
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$ProjectRoot = $PSScriptRoot
$BackendDir = Join-Path $ProjectRoot "backend"
$LogsDir = Join-Path $ProjectRoot "logs"
$PidFile = Join-Path $LogsDir "pids.json"
$BackendLog = Join-Path $LogsDir "backend.log"
$FrontendLog = Join-Path $LogsDir "frontend.log"

$shouldStartBackend = -not $FrontendOnly
$shouldStartFrontend = -not $BackendOnly

# 创建日志目录
if (-not (Test-Path $LogsDir)) {
    New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null
}

function Show-Banner {
    Write-Host ""
    Write-Host "================================================================================" -ForegroundColor Cyan
    if ($FrontendOnly) {
        Write-Host "                    FlowDev-AI 前端独立服务 - 启动器                            " -ForegroundColor Cyan
    } elseif ($BackendOnly) {
        Write-Host "                    FlowDev-AI 后端独立服务 - 启动器                            " -ForegroundColor Cyan
    } else {
        Write-Host "                    FlowDev-AI 智能全栈开发流 - 前后端联合启动器                " -ForegroundColor Cyan
    }
    Write-Host "================================================================================" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Step {
    param([string]$Step, [string]$Message)
    Write-Host "[$Step] " -NoNewline -ForegroundColor Yellow
    Write-Host $Message -ForegroundColor White
}

function Write-Success {
    param([string]$Message)
    Write-Host "  [OK] " -NoNewline -ForegroundColor Green
    Write-Host $Message -ForegroundColor Green
}

function Write-Info {
    param([string]$Message)
    Write-Host "  [INFO] " -NoNewline -ForegroundColor Cyan
    Write-Host $Message -ForegroundColor Gray
}

function Write-Warn {
    param([string]$Message)
    Write-Host "  [WARN] " -NoNewline -ForegroundColor Yellow
    Write-Host $Message -ForegroundColor Yellow
}

function Write-Err {
    param([string]$Message)
    Write-Host "  [ERR] " -NoNewline -ForegroundColor Red
    Write-Host $Message -ForegroundColor Red
}

function Get-PortProcessId {
    param([int]$Port)
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($conn) {
        return $conn.OwningProcess
    }
    # 兼容回退使用 netstat
    $netstatMatch = (netstat -ano | findstr ":$Port" | findstr "LISTENING")
    if ($netstatMatch) {
        $parts = ($netstatMatch.Trim() -split "\s+")
        if ($parts.Count -gt 4) {
            return [int]$parts[-1]
        }
    }
    return $null
}

function Kill-ProcessByPort {
    param([int]$Port, [string]$ServiceName)
    $pidToKill = Get-PortProcessId -Port $Port
    if ($pidToKill) {
        Write-Warn "检测到端口 $Port 已被占用 (PID: $pidToKill, 服务: $ServiceName)，正在自动清理..."
        try {
            taskkill /F /T /PID $pidToKill | Out-Null
            Start-Sleep -Milliseconds 800
            Write-Success "已释放端口 $Port"
        } catch {
            Write-Warn "清理 PID $pidToKill 提示: $_"
        }
    }
}

Show-Banner

# ------------------------------------------------------------------------------
# 步骤 1: 环境与依赖项检查
# ------------------------------------------------------------------------------
Write-Step "1/5" "正在检查运行环境与依赖..."

$pythonCmd = $null
if ($shouldStartBackend) {
    if (Get-Command python -ErrorAction SilentlyContinue) {
        $pythonCmd = "python"
    } elseif (Get-Command py -ErrorAction SilentlyContinue) {
        $pythonCmd = "py"
    }

    if (-not $pythonCmd) {
        Write-Err "未找到 Python，请先安装 Python 3.10+ 并加入系统环境变量 PATH"
        exit 1
    }
    $pyVer = (& $pythonCmd --version 2>&1)
    Write-Success "Python 环境正常: $pyVer"

    # 检查后端 FastAPI / Uvicorn 依赖
    $depsCheck = & $pythonCmd -c "import fastapi, uvicorn, pydantic, sse_starlette; print('OK')" 2>&1
    if ($depsCheck -ne "OK") {
        Write-Warn "检测到后端依赖未完全安装，正在执行 pip install -r requirements.txt..."
        & $pythonCmd -m pip install -r "$BackendDir\requirements.txt"
    } else {
        Write-Success "FastAPI 与 Uvicorn 核心依赖就绪"
    }

    # 检查环境变量文件
    $envFile = Join-Path $BackendDir ".env"
    $envExample = Join-Path $BackendDir ".env.example"
    if (-not (Test-Path $envFile) -and (Test-Path $envExample)) {
        Copy-Item $envExample $envFile
        Write-Info "已根据 .env.example 自动生成 backend\.env 配置文件"
    }
}

$pkgManager = "pnpm"
if ($shouldStartFrontend) {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Err "未找到 Node.js，请先安装 Node.js (v18+) 并加入系统环境变量 PATH"
        exit 1
    }
    $nodeVer = (& node --version 2>&1)
    Write-Success "Node.js 环境正常: $nodeVer"

    if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
        if (Get-Command npm -ErrorAction SilentlyContinue) {
            $pkgManager = "npm"
            Write-Warn "未找到 pnpm，将自动回退使用 npm"
        } else {
            Write-Err "未找到 pnpm 或 npm，无法启动前端"
            exit 1
        }
    } else {
        $pnpmVer = (& pnpm --version 2>&1)
        Write-Success "包管理器就绪: pnpm v$pnpmVer"
    }
}

# ------------------------------------------------------------------------------
# 步骤 2: 端口排查与冲突处理
# ------------------------------------------------------------------------------
Write-Step "2/5" "排查服务端口占用..."
if ($shouldStartBackend) {
    Kill-ProcessByPort -Port 8000 -ServiceName "FastAPI 后端"
}
if ($shouldStartFrontend) {
    Kill-ProcessByPort -Port 3000 -ServiceName "Next.js 前端"
}
Start-Sleep -Milliseconds 500

$startTime = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$backendProc = $null
$frontendProc = $null

# ------------------------------------------------------------------------------
# 步骤 3: 启动后端服务 (FastAPI)
# ------------------------------------------------------------------------------
if ($shouldStartBackend) {
    Write-Step "3/5" "启动后端服务 (FastAPI / Uvicorn, 监听端口: 8000)..."
    $backendBanner = "==================== FlowDev Backend Log [$startTime] ===================="
    Set-Content -Path $BackendLog -Value $backendBanner -Encoding UTF8

    $backendCmd = "$pythonCmd -m uvicorn main:app --host 127.0.0.1 --port 8000"
    $backendProc = Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/c $backendCmd >> `"$BackendLog`" 2>&1" `
        -WorkingDirectory $BackendDir `
        -WindowStyle Hidden `
        -PassThru

    Write-Success "后端服务已在后台启动 (Wrapper PID: $($backendProc.Id))"
    Write-Info "后端日志实时输出: logs\backend.log"
} else {
    Write-Step "3/5" "跳过后端启动 (已指定仅启动前端)"
}

# ------------------------------------------------------------------------------
# 步骤 4: 启动前端服务 (Next.js)
# ------------------------------------------------------------------------------
if ($shouldStartFrontend) {
    Write-Step "4/5" "启动前端服务 (Next.js, 监听端口: 3000)..."
    $frontendBanner = "==================== FlowDev Frontend Log [$startTime] ===================="
    Set-Content -Path $FrontendLog -Value $frontendBanner -Encoding UTF8

    $frontendRunCmd = if ($pkgManager -eq "pnpm") { "pnpm dev -p 3000" } else { "npm run dev -- -p 3000" }
    $frontendProc = Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/c $frontendRunCmd >> `"$FrontendLog`" 2>&1" `
        -WorkingDirectory $ProjectRoot `
        -WindowStyle Hidden `
        -PassThru

    Write-Success "前端服务已在后台启动 (Wrapper PID: $($frontendProc.Id))"
    Write-Info "前端日志实时输出: logs\frontend.log"
} else {
    Write-Step "4/5" "跳过前端启动 (已指定仅启动后端)"
}

# ------------------------------------------------------------------------------
# 步骤 5: 动态健康检查与连通性验证
# ------------------------------------------------------------------------------
Write-Step "5/5" "正在轮询检测服务健康度与连通性 (最长等待 30 秒)..."

$maxWaitSeconds = 30
$backendReady = -not $shouldStartBackend
$frontendReady = -not $shouldStartFrontend
$backendHealthData = $null
$elapsed = 0

$backendActualPid = $null
$frontendActualPid = $null

while ($elapsed -lt $maxWaitSeconds) {
    # 检查后端
    if ($shouldStartBackend -and -not $backendReady) {
        $backendActualPid = Get-PortProcessId -Port 8000
        if ($backendActualPid) {
            try {
                $resp = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/health" -Method Get -TimeoutSec 2 -ErrorAction Stop
                if ($resp.status -eq "healthy") {
                    $backendReady = $true
                    $backendHealthData = $resp
                    Write-Success "后端接口就绪: http://127.0.0.1:8000/api/health (PID: $backendActualPid, 引擎: $($resp.dag_engine))"
                }
            } catch {
                # 预热中
            }
        }
    }

    # 检查前端
    if ($shouldStartFrontend -and -not $frontendReady) {
        $frontendActualPid = Get-PortProcessId -Port 3000
        if ($frontendActualPid) {
            try {
                $webResp = Invoke-WebRequest -Uri "http://127.0.0.1:3000" -Method Get -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
                if ($webResp.StatusCode -eq 200) {
                    $frontendReady = $true
                    Write-Success "前端页面就绪: http://localhost:3000 (PID: $frontendActualPid, HTTP: 200 OK)"
                }
            } catch {
                # 编译中
            }
        }
    }

    if ($backendReady -and $frontendReady) {
        break
    }

    Start-Sleep -Seconds 1
    $elapsed++
    Write-Host -NoNewline "." -ForegroundColor Yellow
}
Write-Host ""

# 读取旧 PID 记录进行合并 (统一转回 hashtable，避免 PSCustomObject 不支持 .属性=值 赋值导致崩溃)
$pidRecord = @{}
if (Test-Path $PidFile) {
    try {
        $oldRecord = Get-Content $PidFile -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($null -ne $oldRecord) {
            foreach ($prop in $oldRecord.PSObject.Properties) {
                $pidRecord[$prop.Name] = $prop.Value
            }
        }
    } catch {}
}

if ($shouldStartBackend) {
    $pidRecord.backend = @{
        wrapper_pid = if ($backendProc) { $backendProc.Id } else { $null }
        process_pid = $backendActualPid
        port = 8000
        url = "http://127.0.0.1:8000"
        status = if ($backendReady) { "healthy" } else { "starting" }
    }
}

if ($shouldStartFrontend) {
    $pidRecord.frontend = @{
        wrapper_pid = if ($frontendProc) { $frontendProc.Id } else { $null }
        process_pid = $frontendActualPid
        port = 3000
        url = "http://localhost:3000"
        status = if ($frontendReady) { "healthy" } else { "starting" }
    }
}
$pidRecord.updated_at = $startTime
$pidRecord | ConvertTo-Json -Depth 3 | Set-Content -Path $PidFile -Encoding UTF8

# ------------------------------------------------------------------------------
# 启动结果与效果仪表盘 (Summary Dashboard)
# ------------------------------------------------------------------------------
Write-Host ""
Write-Host "+------------------------------------------------------------------------------+" -ForegroundColor Cyan
Write-Host "|                        FlowDev-AI 服务启动完成看板                           |" -ForegroundColor Cyan
Write-Host "+------------------------------------------------------------------------------+" -ForegroundColor Cyan

# 前端信息
if ($shouldStartFrontend) {
    if ($frontendReady) {
        Write-Host "|  [前端界面]: http://localhost:3000" -ForegroundColor Green
        Write-Host "|  [前端状态]: [OK] 正常运行 (端口: 3000, PID: $frontendActualPid, HTTP: 200)" -ForegroundColor Gray
    } else {
        Write-Host "|  [前端界面]: http://localhost:3000 (Next.js 仍在编译中)" -ForegroundColor Yellow
        Write-Host "|  [前端状态]: [WAIT] 稍后刷新浏览器即可访问，详情请看 logs\frontend.log" -ForegroundColor Gray
    }
} else {
    Write-Host "|  [前端状态]: 未启动 (仅运行后端)" -ForegroundColor DarkGray
}

Write-Host "|                                                                              |" -ForegroundColor Cyan

# 后端信息
if ($shouldStartBackend) {
    if ($backendReady) {
        Write-Host "|  [后端服务]: http://127.0.0.1:8000" -ForegroundColor Green
        Write-Host "|  [后端状态]: [OK] 正常运行 (端口: 8000, PID: $backendActualPid, 状态: healthy)" -ForegroundColor Gray
        Write-Host "|  [接口文档]: http://127.0.0.1:8000/docs" -ForegroundColor Cyan
        
        $modelName = if ($backendHealthData.llm_config.default_model) { $backendHealthData.llm_config.default_model } else { "未指定" }
        $keyStatus = if ($backendHealthData.llm_config.has_api_key) { "已接入真实 API Key" } else { "自适应仿真增强模式 (无需外部Key)" }
        Write-Host "|  [LLM 引擎]: 模型: $modelName | 状态: $keyStatus" -ForegroundColor Gray
    } else {
        Write-Host "|  [后端服务]: http://127.0.0.1:8000 (初始化中)" -ForegroundColor Yellow
        Write-Host "|  [后端状态]: [WAIT] 正在启动，详情请看 logs\backend.log" -ForegroundColor Gray
    }
} else {
    Write-Host "|  [后端状态]: 未启动 (仅运行前端)" -ForegroundColor DarkGray
}

Write-Host "+------------------------------------------------------------------------------+" -ForegroundColor Cyan
Write-Host "|  常用管理指令:                                                               |" -ForegroundColor Cyan
Write-Host "|     * 停止服务: .\stop.ps1    (或双击 stop.bat)                              |" -ForegroundColor White
Write-Host "|     * 重启服务: .\restart.ps1 (或双击 restart.bat)                           |" -ForegroundColor White
Write-Host "|     * 运行状态: .\status.ps1  (或双击 status.bat)                            |" -ForegroundColor White
Write-Host "|     * 实时日志: .\logs.ps1    (或双击 logs.bat)                              |" -ForegroundColor White
Write-Host "|                                                                              |" -ForegroundColor Cyan
Write-Host "|  运行日志路径:                                                               |" -ForegroundColor Cyan
Write-Host "|     * 后端日志: logs\backend.log                                             |" -ForegroundColor Gray
Write-Host "|     * 前端日志: logs\frontend.log                                            |" -ForegroundColor Gray
Write-Host "+------------------------------------------------------------------------------+" -ForegroundColor Cyan
Write-Host ""

# 自动打开浏览器 (如果前端就绪)
if (-not $NoBrowser -and $frontendReady) {
    Write-Host "正在为您在默认浏览器中打开 FlowDev-AI 前端界面..." -ForegroundColor Green
    Start-Process "http://localhost:3000"
}

if ($FollowLogs) {
    Write-Host ""
    Write-Host "正在进入日志追踪模式 (按 Ctrl+C 退出日志监控，服务保持后台运行)..." -ForegroundColor Cyan
    & "$ProjectRoot\logs.ps1" -Lines 20
}
