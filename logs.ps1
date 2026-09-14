# ==============================================================================
# FlowDev-AI 实时日志监控脚本 (Log Viewer)
# ==============================================================================
[CmdletBinding()]
param(
    [switch]$Backend,
    [switch]$Frontend,
    [int]$Lines = 30,
    [switch]$NoFollow
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$ProjectRoot = $PSScriptRoot
$LogsDir = Join-Path $ProjectRoot "logs"
$BackendLog = Join-Path $LogsDir "backend.log"
$FrontendLog = Join-Path $LogsDir "frontend.log"

function Show-LogFile {
    param([string]$FilePath, [string]$Title, [bool]$Follow)
    if (-not (Test-Path $FilePath)) {
        Write-Host "日志文件不存在: $FilePath" -ForegroundColor Yellow
        Write-Host "服务可能尚未启动，请先运行 .\start.ps1 启动服务" -ForegroundColor Gray
        return
    }

    Write-Host ""
    Write-Host "================================================================================" -ForegroundColor Cyan
    Write-Host " 正在监控 $Title (按 Ctrl+C 退出监控)" -ForegroundColor Cyan
    Write-Host " 日志文件: $FilePath" -ForegroundColor Gray
    Write-Host "================================================================================" -ForegroundColor Cyan
    Write-Host ""

    if ($Follow) {
        Get-Content -Path $FilePath -Tail $Lines -Wait
    } else {
        Get-Content -Path $FilePath -Tail $Lines
    }
}

if ($Backend) {
    Show-LogFile -FilePath $BackendLog -Title "后端服务日志 (FastAPI: 8000)" -Follow (-not $NoFollow)
    exit 0
}

if ($Frontend) {
    Show-LogFile -FilePath $FrontendLog -Title "前端服务日志 (Next.js: 3000)" -Follow (-not $NoFollow)
    exit 0
}

# 交互式选择菜单
Write-Host ""
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "                    FlowDev-AI 智能全栈开发流 - 日志控制台                      " -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "请选择需要查看的日志:" -ForegroundColor White
Write-Host "  [1] 实时监控后端日志 (FastAPI / 端口 8000)" -ForegroundColor Yellow
Write-Host "  [2] 实时监控前端日志 (Next.js / 端口 3000)" -ForegroundColor Yellow
Write-Host "  [3] 查看前后端最新 $Lines 行日志快照" -ForegroundColor Yellow
Write-Host "  [0] 退出" -ForegroundColor Gray
Write-Host ""

$choice = Read-Host "请输入数字选项 [默认 1]"
if ([string]::IsNullOrWhiteSpace($choice)) {
    $choice = "1"
}

switch ($choice) {
    "1" {
        Show-LogFile -FilePath $BackendLog -Title "后端服务日志 (FastAPI: 8000)" -Follow $true
    }
    "2" {
        Show-LogFile -FilePath $FrontendLog -Title "前端服务日志 (Next.js: 3000)" -Follow $true
    }
    "3" {
        Write-Host ""
        Write-Host "--- [后端日志最新 $Lines 行] ---" -ForegroundColor Green
        if (Test-Path $BackendLog) {
            Get-Content -Path $BackendLog -Tail $Lines
        } else {
            Write-Host "暂无后端日志文件" -ForegroundColor Gray
        }

        Write-Host ""
        Write-Host "--- [前端日志最新 $Lines 行] ---" -ForegroundColor Green
        if (Test-Path $FrontendLog) {
            Get-Content -Path $FrontendLog -Tail $Lines
        } else {
            Write-Host "暂无前端日志文件" -ForegroundColor Gray
        }
        Write-Host ""
    }
    default {
        Write-Host "已退出日志控制台" -ForegroundColor Gray
    }
}
