# ==============================================================================
# FlowDev-AI 一键停止服务脚本 (Stop Service)
# ==============================================================================
[CmdletBinding()]
param()

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$ProjectRoot = $PSScriptRoot
$LogsDir = Join-Path $ProjectRoot "logs"
$PidFile = Join-Path $LogsDir "pids.json"

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

function Stop-TargetPid {
    param([int]$PidToStop, [string]$Desc)
    if (-not $PidToStop) { return }
    try {
        $p = Get-Process -Id $PidToStop -ErrorAction SilentlyContinue
        if ($p) {
            Write-Info "正在终止 $Desc (PID: $PidToStop, 进程名: $($p.ProcessName))..."
            taskkill /F /T /PID $PidToStop | Out-Null
            Start-Sleep -Milliseconds 400
            Write-Success "已终止 $Desc (PID: $PidToStop)"
        }
    } catch {
        Write-Warn "终止 PID $PidToStop 遇到提示: $_"
    }
}

Write-Host ""
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "                    FlowDev-AI 智能全栈开发流 - 服务停止器                      " -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""

# 读取记录的 PID 文件
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
    } catch {
        Write-Warn "解析 pids.json 失败，将基于实时端口探测进行停止"
    }
}

# ------------------------------------------------------------------------------
# 步骤 1: 停止前端服务 (Port 3000)
# ------------------------------------------------------------------------------
Write-Step "1/3" "正在停止前端服务 (Port 3000)..."
$port3000Pid = Get-PortProcessId -Port 3000

if ($port3000Pid) {
    Stop-TargetPid -PidToStop $port3000Pid -Desc "前端监听进程 (Port 3000)"
}
if ($recordedFrontendPid -and $recordedFrontendPid -ne $port3000Pid) {
    Stop-TargetPid -PidToStop $recordedFrontendPid -Desc "前端记录进程"
}
if ($recordedFrontendWrapper) {
    Stop-TargetPid -PidToStop $recordedFrontendWrapper -Desc "前端包装进程"
}

# ------------------------------------------------------------------------------
# 步骤 2: 停止后端服务 (Port 8000)
# ------------------------------------------------------------------------------
Write-Step "2/3" "正在停止后端服务 (Port 8000)..."
$port8000Pid = Get-PortProcessId -Port 8000

if ($port8000Pid) {
    Stop-TargetPid -PidToStop $port8000Pid -Desc "后端监听进程 (Port 8000)"
}
if ($recordedBackendPid -and $recordedBackendPid -ne $port8000Pid) {
    Stop-TargetPid -PidToStop $recordedBackendPid -Desc "后端记录进程"
}
if ($recordedBackendWrapper) {
    Stop-TargetPid -PidToStop $recordedBackendWrapper -Desc "后端包装进程"
}

# ------------------------------------------------------------------------------
# 步骤 3: 校验端口释放与清理
# ------------------------------------------------------------------------------
Write-Step "3/3" "验证端口释放与清理运行状态..."
Start-Sleep -Seconds 1

$remain3000 = Get-PortProcessId -Port 3000
$remain8000 = Get-PortProcessId -Port 8000

if ($remain3000) {
    Write-Warn "检测到端口 3000 仍有残留进程 (PID: $remain3000)，进行强制清理..."
    taskkill /F /T /PID $remain3000 | Out-Null
}
if ($remain8000) {
    Write-Warn "检测到端口 8000 仍有残留进程 (PID: $remain8000)，进行强制清理..."
    taskkill /F /T /PID $remain8000 | Out-Null
}

if (Test-Path $PidFile) {
    Remove-Item -Path $PidFile -Force -ErrorAction SilentlyContinue
    Write-Success "已清除 PID 记录状态"
}

Write-Host ""
Write-Host "================================================================================" -ForegroundColor Green
Write-Host "                        FlowDev-AI 所有服务已完全停止                           " -ForegroundColor Green
Write-Host "================================================================================" -ForegroundColor Green
Write-Host "  • 端口 3000 (前端): 已释放" -ForegroundColor Gray
Write-Host "  • 端口 8000 (后端): 已释放" -ForegroundColor Gray
Write-Host ""
Write-Host "  如需重新启动，请执行: .\start.ps1 或双击 start.bat" -ForegroundColor Cyan
Write-Host ""
