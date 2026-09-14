# ==============================================================================
# FlowDev-AI 服务状态查询脚本 (Status Check)
# ==============================================================================
[CmdletBinding()]
param()

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$ProjectRoot = $PSScriptRoot
$LogsDir = Join-Path $ProjectRoot "logs"
$BackendLog = Join-Path $LogsDir "backend.log"
$FrontendLog = Join-Path $LogsDir "frontend.log"

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

Write-Host ""
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "                    FlowDev-AI 智能全栈开发流 - 状态看板                        " -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""

# ------------------------------------------------------------------------------
# 1. 检查后端状态 (Port 8000)
# ------------------------------------------------------------------------------
Write-Host "[后端服务状态 (FastAPI Core)]" -ForegroundColor White
$backendPid = Get-PortProcessId -Port 8000
if ($backendPid) {
    $proc = Get-Process -Id $backendPid -ErrorAction SilentlyContinue
    $memMB = if ($proc) { [math]::Round($proc.WorkingSet64 / 1MB, 1) } else { "未知" }
    $procName = if ($proc) { $proc.ProcessName } else { "未知" }

    Write-Host "  • 进程状态: " -NoNewline
    Write-Host "🟢 运行中" -ForegroundColor Green
    Write-Host "  • 监听端口: 8000" -ForegroundColor Gray
    Write-Host "  • 进程信息: PID: $backendPid ($procName, 内存: $memMB MB)" -ForegroundColor Gray

    # 测试健康接口
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $health = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/health" -Method Get -TimeoutSec 2 -ErrorAction Stop
        $sw.Stop()
        Write-Host "  • 健康响应: " -NoNewline
        Write-Host "✓ healthy (耗时: $($sw.ElapsedMilliseconds) ms)" -ForegroundColor Green
        Write-Host "  • DAG 调度引擎: $($health.dag_engine)" -ForegroundColor Gray
        $modelStr = $health.llm_config.default_model
        $hasKey = if ($health.llm_config.has_api_key) { "已配置真实 Key" } else { "自适应仿真模式 (Mock)" }
        Write-Host "  • LLM 配置: 模型=$modelStr | Key=$hasKey" -ForegroundColor Gray
    } catch {
        $sw.Stop()
        Write-Host "  • 健康响应: " -NoNewline
        Write-Host "⚠ 端口已打开但 HTTP 接口未响应: $_" -ForegroundColor Yellow
    }
} else {
    Write-Host "  • 进程状态: " -NoNewline
    Write-Host "⚪ 未运行 (端口 8000 空闲)" -ForegroundColor Red
}

Write-Host ""

# ------------------------------------------------------------------------------
# 2. 检查前端状态 (Port 3000)
# ------------------------------------------------------------------------------
Write-Host "[前端服务状态 (Next.js)]" -ForegroundColor White
$frontendPid = Get-PortProcessId -Port 3000
if ($frontendPid) {
    $proc = Get-Process -Id $frontendPid -ErrorAction SilentlyContinue
    $memMB = if ($proc) { [math]::Round($proc.WorkingSet64 / 1MB, 1) } else { "未知" }
    $procName = if ($proc) { $proc.ProcessName } else { "未知" }

    Write-Host "  • 进程状态: " -NoNewline
    Write-Host "🟢 运行中" -ForegroundColor Green
    Write-Host "  • 监听端口: 3000" -ForegroundColor Gray
    Write-Host "  • 进程信息: PID: $frontendPid ($procName, 内存: $memMB MB)" -ForegroundColor Gray

    # 测试页面响应
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $page = Invoke-WebRequest -Uri "http://127.0.0.1:3000" -Method Get -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
        $sw.Stop()
        Write-Host "  • 页面响应: " -NoNewline
        Write-Host "✓ HTTP $($page.StatusCode) OK (耗时: $($sw.ElapsedMilliseconds) ms)" -ForegroundColor Green
    } catch {
        $sw.Stop()
        Write-Host "  • 页面响应: " -NoNewline
        Write-Host "⚠ 端口已通但页面返回异常: $_" -ForegroundColor Yellow
    }
} else {
    Write-Host "  • 进程状态: " -NoNewline
    Write-Host "⚪ 未运行 (端口 3000 空闲)" -ForegroundColor Red
}

Write-Host ""

# ------------------------------------------------------------------------------
# 3. 日志摘要信息
# ------------------------------------------------------------------------------
Write-Host "[运行日志摘要]" -ForegroundColor White
if (Test-Path $BackendLog) {
    $bItem = Get-Item $BackendLog
    $bSizeKB = [math]::Round($bItem.Length / 1KB, 1)
    Write-Host "  • 后端日志: $BackendLog (${bSizeKB} KB, 更新于: $($bItem.LastWriteTime.ToString('HH:mm:ss')))" -ForegroundColor Gray
} else {
    Write-Host "  • 后端日志: 暂无日志文件" -ForegroundColor Gray
}

if (Test-Path $FrontendLog) {
    $fItem = Get-Item $FrontendLog
    $fSizeKB = [math]::Round($fItem.Length / 1KB, 1)
    Write-Host "  • 前端日志: $FrontendLog (${fSizeKB} KB, 更新于: $($fItem.LastWriteTime.ToString('HH:mm:ss')))" -ForegroundColor Gray
} else {
    Write-Host "  • 前端日志: 暂无日志文件" -ForegroundColor Gray
}

Write-Host ""
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "  快捷指令:" -ForegroundColor Cyan
Write-Host "     • 启动服务: .\start.ps1   (或双击 start.bat)" -ForegroundColor White
Write-Host "     • 停止服务: .\stop.ps1    (或双击 stop.bat)" -ForegroundColor White
Write-Host "     • 重启服务: .\restart.ps1 (或双击 restart.bat)" -ForegroundColor White
Write-Host "     • 查看日志: .\logs.ps1    (或双击 logs.bat)" -ForegroundColor White
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""
