# start-all.ps1
# Script để start tất cả services cho Tank Online

Write-Host "`n╗" -ForegroundColor Cyan
Write-Host "       TANK ONLINE - Starting All Services      " -ForegroundColor Cyan
Write-Host "╝`n" -ForegroundColor Cyan

# Step 1: Check Docker
Write-Host " Step 1: Checking Docker..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host " Docker installed: $dockerVersion" -ForegroundColor Green
    }
} catch {
    Write-Host " Docker not found! Please install Docker Desktop." -ForegroundColor Red
    exit 1
}

# Step 2: Check if Docker is running
Write-Host "`n Step 2: Checking Docker daemon..." -ForegroundColor Yellow
try {
    docker ps | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host " Docker is running!" -ForegroundColor Green
    }
} catch {
    Write-Host " Docker Desktop is not running!" -ForegroundColor Red
    Write-Host "   Please start Docker Desktop and wait for it to be ready." -ForegroundColor Yellow
    Write-Host "   Then run this script again.`n" -ForegroundColor Yellow
    
    Read-Host "Press Enter to exit"
    exit 1
}

# Step 3: Stop any existing containers
Write-Host "`n Step 3: Cleaning up old containers..." -ForegroundColor Yellow
docker-compose down 2>&1 | Out-Null
Write-Host " Old containers stopped" -ForegroundColor Green

# Step 4: Start all services
Write-Host "`n Step 4: Starting all services..." -ForegroundColor Yellow
Write-Host "   This may take 30-60 seconds...`n" -ForegroundColor Cyan

docker-compose up -d

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n All services started successfully!`n" -ForegroundColor Green
} else {
    Write-Host "`n Failed to start services. Check logs above.`n" -ForegroundColor Red
    exit 1
}

# Step 5: Wait for services to be ready
Write-Host " Step 5: Waiting for services to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Step 6: Check service status
Write-Host "`n Step 6: Checking service status...`n" -ForegroundColor Yellow
docker-compose ps

# Step 7: Display URLs
Write-Host "`n╗" -ForegroundColor Green
Write-Host "                   ALL READY!                     " -ForegroundColor Green
Write-Host "╝`n" -ForegroundColor Green

Write-Host " Available Services:" -ForegroundColor Cyan
Write-Host "   • Game:          http://localhost" -ForegroundColor White
Write-Host "   • Grafana:       http://localhost:3000 (admin/admin)" -ForegroundColor White
Write-Host "   • Prometheus:    http://localhost:9090" -ForegroundColor White
Write-Host "   • Monitor:       http://localhost/monitor`n" -ForegroundColor White

Write-Host " Next Steps:" -ForegroundColor Cyan
Write-Host "   1. Open game:    start http://localhost" -ForegroundColor Yellow
Write-Host "   2. Open Grafana: start http://localhost:3000" -ForegroundColor Yellow
Write-Host "   3. Run autoscaler: node scripts/autoscaler.js`n" -ForegroundColor Yellow

Read-Host "Press Enter to exit"
