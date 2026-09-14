# ==============================================================================
# FlowDev-AI 智能全栈开发流 - 综合服务管理器 (All-In-One Unified Manager)
# 包含：启动、停止、重启、状态查询、实时日志
# ==============================================================================
[CmdletBinding()]
param(
    [Parameter(Position=0)]
    [ValidateSet("start", "stop", "restart", "status", "logs", "help", "menu")]
    [string]$Action = "menu",

    [switch]$NoBrowser,
    [switch]$FollowLogs,
    [string]$LogType = "all", # "backend", "frontend", "all"
    [int]$Lines = 30
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$ProjectRoot = $PSScriptRoot
$BackendDir = Join-Path $ProjectRoot "backend"
$LogsDir = Join-Path $ProjectRoot "logs"
$PidFile = Join-Path $LogsDir "pids.json"
$BackendLog = Join-Path $LogsDir "backend.log"
$FrontendLog = Join-Path $LogsDir "frontend.log"

if (-not (Test-Path $LogsDir)) {
    New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null
}

function Show-Header {
    Write-Host ""
    Write-Host "================================================================================" -ForegroundColor Cyan
    Write-Host "                FlowDev-AI 智能全栈开发流 - 一站式服务管理控制台                " -ForegroundColor Cyan
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

# ------------------------------------------------------------------------------
# 核心动作 1: 启动服务 (Start)
# ------------------------------------------------------------------------------
function Start-AllServices {
    param([bool]$OpenBrowser = $true)

    Show-Header
    Write-Host ">>> 正在启动 FlowDev-AI 全部服务 (FastAPI 后端 + Next.js 前端)..." -ForegroundColor White
    Write-Host ""

    # 1. 环境与依赖检查
    Write-Step "1/5" "检查运行环境与前置依赖..."
    
    # 检查 Python
    $pythonCmd = $null
    if (Get-Command python -ErrorAction SilentlyContinue) {
        $pythonCmd = "python"
    } elseif (Get-Command py -ErrorAction SilentlyContinue) {
        $pythonCmd = "py"
    }

    if (-not $pythonCmd) {
        Write-Err "未找到 Python，请先安装 Python 3.10+ 并加入 PATH"
        return
    }
    $pyVer = (& $pythonCmd --version 2>&1)
    Write-Success "Python 环境就绪: $pyVer"

    # 检查后端依赖
    $depsCheck = & $pythonCmd -c "import fastapi, uvicorn, pydantic, sse_starlette; print('OK')" 2>&1
    if ($depsCheck -ne "OK") {
        Write-Warn "后端依赖未完全安装，正在自动执行 pip install -r requirements.txt..."
        & $pythonCmd -m pip install -r "$BackendDir\requirements.txt"
    } else {
        Write-Success "FastAPI 与 Uvicorn 依赖就绪"
    }

    # 检查 Node.js
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Err "未找到 Node.js，请先安装 Node.js (v18+) 并加入 PATH"
        return
    }
    $nodeVer = (& node --version 2>&1)
    Write-Success "Node.js 环境就绪: $nodeVer"

    # 检查包管理器
    $pkgManager = "pnpm"
    if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
        if (Get-Command npm -ErrorAction SilentlyContinue) {
            $pkgManager = "npm"
            Write-Warn "未找到 pnpm，将自动回退使用 npm"
        } else {
            Write-Err "未找到 pnpm 或 npm，无法启动前端"
            return
        }
    } else {
        $pnpmVer = (& pnpm --version 2>&1)
        Write-Success "包管理器就绪: pnpm v$pnpmVer"
    }

    # 检查 .env
    $envFile = Join-Path $BackendDir ".env"
    $envExample = Join-Path $BackendDir ".env.example"
    if (-not (Test-Path $envFile) -and (Test-Path $envExample)) {
        Copy-Item $envExample $envFile
        Write-Info "已根据 .env.example 自动生成 backend\.env 配置文件"
    }

    # 2. 端口检查与排查
    Write-Step "2/5" "检查服务端口占用 (后端: 8000, 前端: 3000)..."
    Kill-ProcessByPort -Port 8000 -ServiceName "FastAPI 后端"
    Kill-ProcessByPort -Port 3000 -ServiceName "Next.js 前端"
    Start-Sleep -Milliseconds 500

    $startTime = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

    # 3. 启动后端服务
    Write-Step "3/5" "启动后端服务 (FastAPI / Uvicorn, 监听端口: 8000)..."
    $backendBanner = "==================== FlowDev Backend Log [$startTime] ===================="
    Set-Content -Path $BackendLog -Value $backendBanner -Encoding UTF8

    $backendCmd = "$pythonCmd -m uvicorn main:app --host 127.0.0.1 --port 8000"
    $backendProc = Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/c $backendCmd >> `"$BackendLog`" 2>&1" `
        -WorkingDirectory $BackendDir `
        -WindowStyle Hidden `
        -PassThru

    Write-Success "后端服务已派生 (Wrapper PID: $($backendProc.Id))"
    Write-Info "后端日志重定向: logs\backend.log"

    # 4. 启动前端服务
    Write-Step "4/5" "启动前端服务 (Next.js, 监听端口: 3000)..."
    $frontendBanner = "==================== FlowDev Frontend Log [$startTime] ===================="
    Set-Content -Path $FrontendLog -Value $frontendBanner -Encoding UTF8

    $frontendRunCmd = if ($pkgManager -eq "pnpm") { "pnpm dev -p 3000" } else { "npm run dev -- -p 3000" }
    $frontendProc = Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/c $frontendRunCmd >> `"$FrontendLog`" 2>&1" `
        -WorkingDirectory $ProjectRoot `
        -WindowStyle Hidden `
        -PassThru

    Write-Success "前端服务已派生 (Wrapper PID: $($frontendProc.Id))"
    Write-Info "前端日志重定向: logs\frontend.log"

    # 5. 健康检查与连通性验证
    Write-Step "5/5" "正在轮询检测服务健康度与连通性 (最长等待 30 秒)..."

    $maxWaitSeconds = 30
    $backendReady = $false
    $frontendReady = $false
    $backendHealthData = $null
    $elapsed = 0

    $backendActualPid = $null
    $frontendActualPid = $null

    while ($elapsed -lt $maxWaitSeconds) {
        # 检查后端
        if (-not $backendReady) {
            $backendActualPid = Get-PortProcessId -Port 8000
            if ($backendActualPid) {
                try {
                    $resp = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/health" -Method Get -TimeoutSec 2 -ErrorAction Stop
                    if ($resp.status -eq "healthy") {
                        $backendReady = $true
                        $backendHealthData = $resp
                        Write-Success "后端就绪: http://127.0.0.1:8000/api/health (PID: $backendActualPid, 引擎: $($resp.dag_engine))"
                    }
                } catch {}
            }
        }

        # 检查前端
        if (-not $frontendReady) {
            $frontendActualPid = Get-PortProcessId -Port 3000
            if ($frontendActualPid) {
                try {
                    $webResp = Invoke-WebRequest -Uri "http://127.0.0.1:3000" -Method Get -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
                    if ($webResp.StatusCode -eq 200) {
                        $frontendReady = $true
                        Write-Success "前端就绪: http://localhost:3000 (PID: $frontendActualPid, HTTP: 200 OK)"
                    }
                } catch {}
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

    # 保存 PID 记录
    $pidRecord = @{
        backend = @{
            wrapper_pid = $backendProc.Id
            process_pid = $backendActualPid
            port = 8000
            url = "http://127.0.0.1:8000"
            status = if ($backendReady) { "healthy" } else { "starting" }
        }
        frontend = @{
            wrapper_pid = $frontendProc.Id
            process_pid = $frontendActualPid
            port = 3000
            url = "http://localhost:3000"
            status = if ($frontendReady) { "healthy" } else { "starting" }
        }
        started_at = $startTime
    }
    $pidRecord | ConvertTo-Json -Depth 3 | Set-Content -Path $PidFile -Encoding UTF8

    # 启动结果展示面板
    Write-Host ""
    Write-Host "+------------------------------------------------------------------------------+" -ForegroundColor Cyan
    Write-Host "|                        FlowDev-AI 服务启动完成看板                           |" -ForegroundColor Cyan
    Write-Host "+------------------------------------------------------------------------------+" -ForegroundColor Cyan

    if ($frontendReady) {
        Write-Host "|  [前端界面]: http://localhost:3000" -ForegroundColor Green
        Write-Host "|  [前端状态]: [OK] 正常运行 (端口: 3000, PID: $frontendActualPid, HTTP: 200)" -ForegroundColor Gray
    } else {
        Write-Host "|  [前端界面]: http://localhost:3000 (仍在构建中)" -ForegroundColor Yellow
        Write-Host "|  [前端状态]: [WAIT] 稍后刷新浏览器即可，进度请看 logs\frontend.log" -ForegroundColor Gray
    }

    Write-Host "|                                                                              |" -ForegroundColor Cyan

    if ($backendReady) {
        Write-Host "|  [后端服务]: http://127.0.0.1:8000" -ForegroundColor Green
        Write-Host "|  [后端状态]: [OK] 正常运行 (端口: 8000, PID: $backendActualPid, 状态: healthy)" -ForegroundColor Gray
        Write-Host "|  [接口文档]: http://127.0.0.1:8000/docs" -ForegroundColor Cyan
        
        $modelName = if ($backendHealthData.llm_config.default_model) { $backendHealthData.llm_config.default_model } else { "未指定" }
        $keyStatus = if ($backendHealthData.llm_config.has_api_key) { "已接入真实 API Key" } else { "自适应仿真增强模式 (无需外部Key)" }
        Write-Host "|  [LLM 引擎]: 模型: $modelName | 状态: $keyStatus" -ForegroundColor Gray
    } else {
        Write-Host "|  [后端服务]: http://127.0.0.1:8000 (初始化中)" -ForegroundColor Yellow
        Write-Host "|  [后端状态]: [WAIT] 详情请看 logs\backend.log" -ForegroundColor Gray
    }

    Write-Host "+------------------------------------------------------------------------------+" -ForegroundColor Cyan
    Write-Host "|  运行日志路径:                                                               |" -ForegroundColor Cyan
    Write-Host "|     * 后端日志: logs\backend.log                                             |" -ForegroundColor Gray
    Write-Host "|     * 前端日志: logs\frontend.log                                            |" -ForegroundColor Gray
    Write-Host "+------------------------------------------------------------------------------+" -ForegroundColor Cyan
    Write-Host ""

    if ($OpenBrowser -and $frontendReady) {
        Write-Host "正在为您在默认浏览器中打开 FlowDev-AI 前端界面..." -ForegroundColor Green
        Start-Process "http://localhost:3000"
    }
}

# ------------------------------------------------------------------------------
# 核心动作 2: 停止服务 (Stop)
# ------------------------------------------------------------------------------
function Stop-AllServices {
    Show-Header
    Write-Host ">>> 正在停止 FlowDev-AI 全部服务..." -ForegroundColor White
    Write-Host ""

    $recordedBackendWrapper = $null
    $recordedBackendPid = $null
    $recordedFrontendWrapper = $null
    $recordedFrontendPid = $null

    if (Test-Path $PidFile) {
        try {
            $pidData = Get-Content $PidFile -Raw -Encoding UTF8 | ConvertFrom-Json
            $recordedBackendWrapper = $pidData.backend.wrapper_pid
            $recordedBackendPid = $pidData.backend.process_pid
            $recordedFrontendWrapper = $pidData.frontend.wrapper_pid
            $recordedFrontendPid = $pidData.frontend.process_pid
        } catch {}
    }

    # 停止前端 (3000)
    Write-Step "1/3" "正在停止前端服务 (端口 3000)..."
    $port3000Pid = Get-PortProcessId -Port 3000
    if ($port3000Pid) {
        taskkill /F /T /PID $port3000Pid | Out-Null
        Write-Success "已终止前端监听进程 (PID: $port3000Pid)"
    }
    if ($recordedFrontendPid -and $recordedFrontendPid -ne $port3000Pid) {
        taskkill /F /T /PID $recordedFrontendPid 2>$null | Out-Null
    }
    if ($recordedFrontendWrapper) {
        taskkill /F /T /PID $recordedFrontendWrapper 2>$null | Out-Null
    }

    # 停止后端 (8000)
    Write-Step "2/3" "正在停止后端服务 (端口 8000)..."
    $port8000Pid = Get-PortProcessId -Port 8000
    if ($port8000Pid) {
        taskkill /F /T /PID $port8000Pid | Out-Null
        Write-Success "已终止后端监听进程 (PID: $port8000Pid)"
    }
    if ($recordedBackendPid -and $recordedBackendPid -ne $port8000Pid) {
        taskkill /F /T /PID $recordedBackendPid 2>$null | Out-Null
    }
    if ($recordedBackendWrapper) {
        taskkill /F /T /PID $recordedBackendWrapper 2>$null | Out-Null
    }

    # 释放与清理验证
    Write-Step "3/3" "验证端口释放状态..."
    Start-Sleep -Seconds 1
    $remain3000 = Get-PortProcessId -Port 3000
    $remain8000 = Get-PortProcessId -Port 8000

    if ($remain3000) { taskkill /F /T /PID $remain3000 | Out-Null }
    if ($remain8000) { taskkill /F /T /PID $remain8000 | Out-Null }

    if (Test-Path $PidFile) {
        Remove-Item -Path $PidFile -Force -ErrorAction SilentlyContinue
    }

    Write-Host ""
    Write-Host "================================================================================" -ForegroundColor Green
    Write-Host "                        FlowDev-AI 全部服务已完全停止                           " -ForegroundColor Green
    Write-Host "================================================================================" -ForegroundColor Green
    Write-Host "  * 端口 3000 (前端): 已释放" -ForegroundColor Gray
    Write-Host "  * 端口 8000 (后端): 已释放" -ForegroundColor Gray
    Write-Host ""
}

# ------------------------------------------------------------------------------
# 核心动作 3: 重启服务 (Restart)
# ------------------------------------------------------------------------------
function Restart-AllServices {
    Show-Header
    Write-Host ">>> 正在执行服务重启流程..." -ForegroundColor White
    Write-Host ""
    Stop-AllServices
    Write-Host "等待 1 秒以确保端口完全就绪..." -ForegroundColor Gray
    Start-Sleep -Seconds 1
    Start-AllServices -OpenBrowser (-not $NoBrowser)
}

# ------------------------------------------------------------------------------
# 核心动作 4: 状态查询 (Status)
# ------------------------------------------------------------------------------
function Get-ServiceStatus {
    Show-Header
    Write-Host ">>> FlowDev-AI 实时运行状态看板:" -ForegroundColor White
    Write-Host ""

    # 后端状态
    Write-Host "[后端服务状态 (FastAPI Core)]" -ForegroundColor Cyan
    $backendPid = Get-PortProcessId -Port 8000
    if ($backendPid) {
        $proc = Get-Process -Id $backendPid -ErrorAction SilentlyContinue
        $memMB = if ($proc) { [math]::Round($proc.WorkingSet64 / 1MB, 1) } else { "未知" }
        $procName = if ($proc) { $proc.ProcessName } else { "未知" }

        Write-Host "  • 进程状态: [OK] 运行中" -ForegroundColor Green
        Write-Host "  • 监听端口: 8000" -ForegroundColor Gray
        Write-Host "  • 进程信息: PID: $backendPid ($procName, 内存: $memMB MB)" -ForegroundColor Gray

        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        try {
            $health = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/health" -Method Get -TimeoutSec 2 -ErrorAction Stop
            $sw.Stop()
            Write-Host "  • 健康响应: [OK] healthy (延迟: $($sw.ElapsedMilliseconds) ms)" -ForegroundColor Green
            Write-Host "  • DAG 调度引擎: $($health.dag_engine)" -ForegroundColor Gray
            $modelStr = $health.llm_config.default_model
            $hasKey = if ($health.llm_config.has_api_key) { "已接入官方 API Key" } else { "自适应仿真增强模式" }
            Write-Host "  • LLM 配置: 模型=$modelStr | Key=$hasKey" -ForegroundColor Gray
        } catch {
            $sw.Stop()
            Write-Host "  • 健康响应: [WARN] 端口已打开但 HTTP 接口未就绪" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  • 进程状态: [OFF] 未运行 (端口 8000 空闲)" -ForegroundColor Red
    }

    Write-Host ""

    # 前端状态
    Write-Host "[前端服务状态 (Next.js)]" -ForegroundColor Cyan
    $frontendPid = Get-PortProcessId -Port 3000
    if ($frontendPid) {
        $proc = Get-Process -Id $frontendPid -ErrorAction SilentlyContinue
        $memMB = if ($proc) { [math]::Round($proc.WorkingSet64 / 1MB, 1) } else { "未知" }
        $procName = if ($proc) { $proc.ProcessName } else { "未知" }

        Write-Host "  • 进程状态: [OK] 运行中" -ForegroundColor Green
        Write-Host "  • 监听端口: 3000" -ForegroundColor Gray
        Write-Host "  • 进程信息: PID: $frontendPid ($procName, 内存: $memMB MB)" -ForegroundColor Gray

        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        try {
            $page = Invoke-WebRequest -Uri "http://127.0.0.1:3000" -Method Get -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
            $sw.Stop()
            Write-Host "  • 页面响应: [OK] HTTP $($page.StatusCode) (延迟: $($sw.ElapsedMilliseconds) ms)" -ForegroundColor Green
        } catch {
            $sw.Stop()
            Write-Host "  • 页面响应: [WARN] 端口已打开但页面返回异常" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  • 进程状态: [OFF] 未运行 (端口 3000 空闲)" -ForegroundColor Red
    }

    Write-Host ""

    # 日志摘要
    Write-Host "[运行日志摘要]" -ForegroundColor Cyan
    if (Test-Path $BackendLog) {
        $bItem = Get-Item $BackendLog
        $bSizeKB = [math]::Round($bItem.Length / 1KB, 1)
        Write-Host "  • 后端日志: $BackendLog (${bSizeKB} KB, 最后写入: $($bItem.LastWriteTime.ToString('HH:mm:ss')))" -ForegroundColor Gray
    } else {
        Write-Host "  • 后端日志: 暂无日志文件" -ForegroundColor Gray
    }

    if (Test-Path $FrontendLog) {
        $fItem = Get-Item $FrontendLog
        $fSizeKB = [math]::Round($fItem.Length / 1KB, 1)
        Write-Host "  • 前端日志: $FrontendLog (${fSizeKB} KB, 最后写入: $($fItem.LastWriteTime.ToString('HH:mm:ss')))" -ForegroundColor Gray
    } else {
        Write-Host "  • 前端日志: 暂无日志文件" -ForegroundColor Gray
    }
    Write-Host ""
}

# ------------------------------------------------------------------------------
# 核心动作 5: 实时日志查看 (Logs)
# ------------------------------------------------------------------------------
function Show-LogsViewer {
    param([string]$Target = "all", [int]$TailLines = 30)

    Show-Header

    if ($Target -eq "backend") {
        if (-not (Test-Path $BackendLog)) { Write-Warn "后端日志文件尚不存在: $BackendLog"; return }
        Write-Host "正在实时跟踪后端日志 (logs\backend.log, 按 Ctrl+C 退出)..." -ForegroundColor Cyan
        Get-Content -Path $BackendLog -Tail $TailLines -Wait
        return
    }

    if ($Target -eq "frontend") {
        if (-not (Test-Path $FrontendLog)) { Write-Warn "前端日志文件尚不存在: $FrontendLog"; return }
        Write-Host "正在实时跟踪前端日志 (logs\frontend.log, 按 Ctrl+C 退出)..." -ForegroundColor Cyan
        Get-Content -Path $FrontendLog -Tail $TailLines -Wait
        return
    }

    # 打印前后端最新日志快照
    Write-Host "--- [后端日志最新 $TailLines 行 (logs\backend.log)] ---" -ForegroundColor Green
    if (Test-Path $BackendLog) {
        Get-Content -Path $BackendLog -Tail $TailLines
    } else {
        Write-Host "暂无后端日志" -ForegroundColor Gray
    }

    Write-Host ""
    Write-Host "--- [前端日志最新 $TailLines 行 (logs\frontend.log)] ---" -ForegroundColor Green
    if (Test-Path $FrontendLog) {
        Get-Content -Path $FrontendLog -Tail $TailLines
    } else {
        Write-Host "暂无前端日志" -ForegroundColor Gray
    }
    Write-Host ""
}

# ------------------------------------------------------------------------------
# 交互式菜单模式 (Menu)
# ------------------------------------------------------------------------------
function Show-InteractiveMenu {
    while ($true) {
        Show-Header
        Write-Host "请选择管理操作:" -ForegroundColor White
        Write-Host "  [1] 一键启动全部服务 (后端 :8000 + 前端 :3000)" -ForegroundColor Green
        Write-Host "  [2] 一键停止全部服务 (释放端口 8000 与 3000)" -ForegroundColor Red
        Write-Host "  [3] 一键重启全部服务 (平滑重启并执行健康检查)" -ForegroundColor Yellow
        Write-Host "  [4] 查看服务运行状态 (端口占用、PID、内存、响应延迟)" -ForegroundColor Cyan
        Write-Host "  [5] 查看实时后端日志 (FastAPI :8000)" -ForegroundColor Magenta
        Write-Host "  [6] 查看实时前端日志 (Next.js :3000)" -ForegroundColor Magenta
        Write-Host "  [7] 查看前后端日志快照" -ForegroundColor Gray
        Write-Host "  [0] 退出控制台" -ForegroundColor DarkGray
        Write-Host ""

        $choice = Read-Host "请输入数字选项 [0-7]"
        switch ($choice) {
            "1" { Start-AllServices -OpenBrowser (-not $NoBrowser); pause }
            "2" { Stop-AllServices; pause }
            "3" { Restart-AllServices; pause }
            "4" { Get-ServiceStatus; pause }
            "5" { Show-LogsViewer -Target "backend" -TailLines $Lines }
            "6" { Show-LogsViewer -Target "frontend" -TailLines $Lines }
            "7" { Show-LogsViewer -Target "all" -TailLines $Lines; pause }
            "0" { Write-Host "已退出服务管理器。"; break }
            default { Write-Warn "无效选项，请重新输入。" }
        }
    }
}

# ------------------------------------------------------------------------------
# 主入口路由
# ------------------------------------------------------------------------------
switch ($Action.ToLower()) {
    "start"   { Start-AllServices -OpenBrowser (-not $NoBrowser) }
    "stop"    { Stop-AllServices }
    "restart" { Restart-AllServices }
    "status"  { Get-ServiceStatus }
    "logs"    { Show-LogsViewer -Target $LogType -TailLines $Lines }
    "help"    {
        Show-Header
        Write-Host "用法示例:" -ForegroundColor White
        Write-Host "  .\manage.ps1               # 进入交互式控制台菜单" -ForegroundColor Gray
        Write-Host "  .\manage.ps1 start         # 一键启动前端和后端" -ForegroundColor Gray
        Write-Host "  .\manage.ps1 stop          # 一键停止全部服务" -ForegroundColor Gray
        Write-Host "  .\manage.ps1 restart       # 一键重启全部服务" -ForegroundColor Gray
        Write-Host "  .\manage.ps1 status        # 查看运行状态与健康检查" -ForegroundColor Gray
        Write-Host "  .\manage.ps1 logs          # 查看最新日志" -ForegroundColor Gray
    }
    default   { Show-InteractiveMenu }
}
