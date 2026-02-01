# 🚀 Auto-Scaling - Hướng Dẫn Sử Dụng

## Tổng quan

Hệ thống auto-scaling giám sát metrics từ Prometheus và tự động scale game service containers dựa trên:
- **CPU Usage**: Scale up khi CPU > 70%, scale down khi CPU < 30%
- **Queue Size**: Scale up khi có > 10 người chờ matchmaking
- **Cooldown**: 60 giây giữa các lần scale để tránh flapping

## Thành phần

### 1. Auto-Scaler (`autoscaler.js`)
Script tự động scale containers

**Chạy:**
```bash
node autoscaler.js
```

**Output:**
```
╔════════════════════════════════════════════════════╗
║        🚀 TANK ONLINE AUTO-SCALER STARTED        ║
╚════════════════════════════════════════════════════╝

⚙️  Configuration:
   Prometheus: http://localhost:9090
   Scale Range: 1 - 5 nodes
   CPU Threshold: 30% - 70%
   Queue Threshold: 10 players
   Check Interval: 15s
   Cooldown: 60s

🎯 Initial state synced: 1 container(s)

⏰ [14:00:00] ═══════════════════════════════════════
📊 Metrics:
   CPU Avg: 12.34%
   Queue: 0 players
   Active Players: 0
   Current Nodes: 1/5
✅ System stable. No scaling needed.
```

### 2. Manual Scale Helper (`scale-helper.js`)
Tool quản lý scaling thủ công

**Sử dụng:**
```bash
# Scale up thêm 1 container
node scale-helper.js up

# Scale down bớt 1 container
node scale-helper.js down

# Set số lượng container cố định
node scale-helper.js set 3

# Xem status hiện tại
node scale-helper.js status
```

### 3. Monitor Status (`monitor-status.js`)
Hiển thị metrics và trạng thái hệ thống

**Sử dụng:**
```bash
# Hiển thị 1 lần
node monitor-status.js

# Chế độ watch (refresh mỗi 5s)
node monitor-status.js --watch
```

**Output:**
```
╔══════════════════════════════════════════════════════╗
║           🎮 TANK ONLINE - MONITOR STATUS           ║
╚══════════════════════════════════════════════════════╝

📦 DOCKER CONTAINERS:
   Game Service Instances: 3

📊 PROMETHEUS METRICS:
   Queue Size:       5 players
   Active Players:   8
   Active Rooms:     2
   Avg CPU Usage:    45.23%
   Avg Memory:       156.78 MB

🏥 HEALTH CHECK:
   Prometheus:       ✅ Healthy
   Game Service:     ✅ Healthy
```

## 📝 Quy trình sử dụng

### Bước 1: Khởi động hệ thống
```bash
# Khởi động Docker stack (ban đầu với 1 instance)
docker-compose up -d

# Kiểm tra services đang chạy
docker-compose ps
```

### Bước 2: Kiểm tra Prometheus
```bash
# Mở Prometheus UI
start http://localhost:9090

# Hoặc query trực tiếp
curl "http://localhost:9090/api/v1/query?query=matchmaking_queue_size"
```

### Bước 3: Chạy Auto-Scaler
```bash
node autoscaler.js
```

**Để chạy background (Windows PowerShell):**
```powershell
Start-Process node -ArgumentList "autoscaler.js" -NoNewWindow
```

### Bước 4: Monitor Status
Mở terminal khác:
```bash
node monitor-status.js --watch
```

## 🧪 Test Auto-Scaling

### Test 1: Scale Up thủ công
```bash
# Terminal 1: Xem status
node monitor-status.js --watch

# Terminal 2: Scale up
node scale-helper.js set 3

# Verify
docker-compose ps game-service
```

### Test 2: Simulate Load (Trigger Auto Scale Up)
```bash
# Mở nhiều tab browser và vào game
# Hoặc fake metrics trong Prometheus (advanced)

# Watch auto-scaler logs để thấy scale up
# Khi queue > 10 hoặc CPU > 70%
```

### Test 3: Scale Down
```bash
# Đóng tất cả game tabs
# Đợi queue về 0 và CPU < 30%
# Sau 60s cooldown, auto-scaler sẽ scale down
```

## 🎛️ Cấu hình

Sửa các giá trị trong `autoscaler.js`:

```javascript
const SCALE_UP_THRESHOLD_CPU = 70;    // CPU > 70% → Scale up
const SCALE_DOWN_THRESHOLD_CPU = 30;  // CPU < 30% → Scale down
const SCALE_UP_THRESHOLD_QUEUE = 10;  // Queue > 10 → Scale up
const CHECK_INTERVAL = 15000;         // Check mỗi 15s
const COOLDOWN_PERIOD = 60000;        // 60s cooldown
const MIN_NODES = 1;                  // Minimum containers
const MAX_NODES = 5;                  // Maximum containers
```

## 📊 Xem Metrics trong Grafana

1. Mở Grafana: http://localhost:3000
2. Login: `admin` / `admin`
3. Import dashboard với metrics:
   - `matchmaking_queue_size`
   - `game_active_players_total`
   - `game_active_rooms_total`
   - CPU, Memory metrics

## ⚠️ Troubleshooting

### Auto-scaler không scale
**Nguyên nhân:** Docker Desktop không chạy hoặc Prometheus không có data

**Giải pháp:**
```bash
# Kiểm tra Docker
docker ps

# Kiểm tra Prometheus
curl http://localhost:9090/-/healthy

# Kiểm tra metrics
curl "http://localhost:9090/api/v1/query?query=matchmaking_queue_size"
```

### Nginx báo lỗi backend unavailable
**Nguyên nhân:** Scaled containers chưa ready

**Giải pháp:** Đợi 5-10 giây để containers khởi động xong, hoặc tăng `fail_timeout` trong nginx.conf

### Prometheus không thấy tất cả instances
**Nguyên nhân:** Static targets trong prometheus.yml

**Giải pháp:** Đây là limitation của Docker Compose. Prometheus sẽ dùng DNS để query `game-service:6000` nhưng chỉ lấy 1 IP. Để fully dynamic, cần migrate sang Docker Swarm hoặc Kubernetes.

## 🔄 Rollback

Nếu gặp vấn đề:
```bash
# Dừng auto-scaler
Ctrl+C

# Set về 1 instance
node scale-helper.js set 1

# Hoặc restart toàn bộ
docker-compose down
docker-compose up -d
```

## 🎯 Production Tips

1. **Chạy auto-scaler dưới dạng service** (PM2, systemd, Windows Service)
2. **Set up alerts** khi scale lên MAX_NODES (hết capacity)
3. **Log metrics** ra file để phân tích sau
4. **Monitor costs** nếu chạy trên cloud (mỗi container = money)
5. **Tune thresholds** dựa trên traffic thực tế

## 📚 Links hữu ích

- Prometheus: http://localhost:9090
- Grafana: http://localhost:3000
- Game: http://localhost
- Monitor Dashboard: http://localhost/monitor
- Redis Commander: (install nếu cần debug queue)
