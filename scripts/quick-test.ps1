# quick-test.ps1
# Script để nhanh chóng setup test environment cho auto-scaling

Write-Host "`n╗" -ForegroundColor Cyan
Write-Host "      🧪 TANK ONLINE - AUTO-SCALE TEST SETUP      " -ForegroundColor Cyan
Write-Host "╝`n" -ForegroundColor Cyan

# Check Docker
Write-Host " Checking Docker..." -ForegroundColor Yellow
try {
    docker ps | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host " Docker is running!" -ForegroundColor Green
    }
} catch {
    Write-Host " Docker Desktop not running!" -ForegroundColor Red
    Write-Host "   Please start Docker Desktop first.`n" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Check services
Write-Host "`n Checking services..." -ForegroundColor Yellow
$services = docker-compose ps --services 2>$null
if ($services -match "game-service") {
    Write-Host " Services are running!" -ForegroundColor Green
} else {
    Write-Host "  Services not running. Starting now..." -ForegroundColor Yellow
    docker-compose up -d
    Start-Sleep -Seconds 10
}

Write-Host "`n Launching test tools...`n" -ForegroundColor Cyan

# Window 1: Auto-scaler
Write-Host "   Window 1: Auto-scaler" -ForegroundColor White  
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "node scripts/autoscaler.js"
Start-Sleep -Milliseconds 500

# Window 2: Docker logs
Write-Host "   Window 2: Game Service Logs" -ForegroundColor White
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "docker-compose logs -f --tail=50 game-service"
Start-Sleep -Milliseconds 500

Write-Host "`n All test tools launched!`n" -ForegroundColor Green

Write-Host "╗" -ForegroundColor Green
Write-Host "                 📝 NEXT STEPS                     " -ForegroundColor Green
Write-Host "╝`n" -ForegroundColor Green

Write-Host "Choose one method to generate load:`n" -ForegroundColor Cyan

Write-Host "METHOD 1: Real Players (Recommended)" -ForegroundColor Yellow
Write-Host "   1. Mở nhiều browser tabs:" -ForegroundColor White
Write-Host "      1..12 | ForEach-Object { start http://localhost }`n" -ForegroundColor Gray

Write-Host "METHOD 2: Fake Load Script" -ForegroundColor Yellow
Write-Host "   1. In this window, run:" -ForegroundColor White
Write-Host "      node scripts/load-generator.js 15`n" -ForegroundColor Gray

Write-Host "Monitor via:" -ForegroundColor Cyan
Write-Host "   Grafana: http://localhost:3000 (visual dashboard)" -ForegroundColor White
Write-Host "   Logs:    Check Auto-scaler window for scaling actions`n" -ForegroundColor White

Write-Host " URLs:" -ForegroundColor Yellow
Write-Host "   Game:     http://localhost" -ForegroundColor White
Write-Host "   Grafana:  http://localhost:3000`n" -ForegroundColor White

$choice = Read-Host "Generate load now? (1=Real tabs, 2=Fake script, N=Skip)"

switch ($choice) {
    "1" {
        Write-Host "`n Opening 12 browser tabs..." -ForegroundColor Cyan
        1..12 | ForEach-Object { 
            Start-Process "http://localhost"
            Start-Sleep -Milliseconds 300
        }
        Write-Host " Tabs opened! Login and click 'Find Match' in each tab.`n" -ForegroundColor Green
    }
    "2" {
        Write-Host "`n Starting load generator..." -ForegroundColor Cyan
        Start-Process pwsh -ArgumentList "-NoExit", "-Command", "node load-generator.js 15"
        Write-Host " Load generator started!`n" -ForegroundColor Green
    }
    default {
        Write-Host "`n  Skipped. You can generate load manually later.`n" -ForegroundColor Gray
    }
}

Write-Host "" -ForegroundColor Gray
Write-Host "Press Enter to finish setup" -ForegroundColor Gray
Write-Host "" -ForegroundColor Gray
Read-Host
