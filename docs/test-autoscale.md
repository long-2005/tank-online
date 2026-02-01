# 🧪 Test Auto-Scaling - Hướng Dẫn Chi Tiết

## 🎯 Mục tiêu
Verify auto-scaler tự động scale game service từ 1 → 2 → 3 instances khi có load cao, và scale down khi load thấp.

---

## 📋 Checklist chuẩn bị

- [ ] Docker Desktop đang chạy
- [ ] Đã chạy `docker-compose up -d` hoặc `.\start-all.ps1`
- [ ] All services healthy (`docker-compose ps`)
- [ ] Node.js installed (để chạy scripts)
- [ ] 3 terminals sẵn sàng

---

## 🚀 Test Scenario 1: Manual Scaling (Warm-up)

### Mục đích: Familiarize với scaling commands

```powershell
# Terminal 1: Monitor real-time status
node monitor-status.js --watch

# Terminal 2: Test manual scaling
node scale-helper.js status
# Should show: 1 container running

node scale-helper.js set 2
# Wait 10-15 seconds

node scale-helper.js status
# Should show: 2 containers running

node scale-helper.js down
# Back to 1 container
```

**✅ Success criteria:**
- Containers tăng/giảm theo lệnh
- `monitor-status.js` hiển thị số instances đúng
- No errors in logs

---

## 🔥 Test Scenario 2: Auto Scale UP (Load Test)

### Setup - 3 Terminals

**Terminal 1: Monitor Status**
```powershell
node monitor-status.js --watch
```

**Terminal 2: Auto-scaler**
```powershell
node autoscaler.js
```
Để nguyên terminal này chạy. Bạn sẽ thấy output như:
```
╔════════════════════════════════════════════════════╗
║        🚀 TANK ONLINE AUTO-SCALER STARTED        ║
╚════════════════════════════════════════════════════╝

⏰ [14:30:00] ═══════════════════════════════════════
📊 Metrics:
   CPU Avg: 5.23%
   Queue: 0 players
   Active Players: 0
   Current Nodes: 1/5
✅ System stable. No scaling needed.
```

**Terminal 3: Load Generator**

### Method 1: Real Players (Preferred)

Mở **11+ tabs** trong browser:
```powershell
# PowerShell loop để mở tabs
1..12 | ForEach-Object { start http://localhost }
```

Trong mỗi tab:
1. Login với username khác nhau (`player1`, `player2`, ...)
2. Click **"Find Match"**
3. Để nguyên ở waiting screen

**Kết quả mong đợi:**

Trong **Terminal 2** (autoscaler), sau 15-30 giây bạn sẽ thấy:
```
⏰ [14:30:15] ═══════════════════════════════════════
📊 Metrics:
   CPU Avg: 12.45%
   Queue: 11 players  ← TRIGGER!
   Active Players: 0
   Current Nodes: 1/5
🔥 HIGH LOAD detected! Triggering SCALE UP...

📈 ═══ SCALE UP ═══
   From: 1 → To: 2 containers
🔧 Executing: docker-compose up -d --scale game-service=2 --no-recreate
✅ Scale up successful!
```

**Verify:**
```powershell
# Terminal 3
docker-compose ps game-service
# Should show 2 containers
```

---

### Method 2: Fake Load Script (Advanced)

Tạo file `load-generator.js`:

```javascript
// load-generator.js - Giả lập nhiều players vào queue
const io = require('socket.io-client');

const NUM_FAKE_PLAYERS = 15;
const GAME_URL = 'http://localhost:6000'; // Direct to game service

console.log(`🎮 Generating load: ${NUM_FAKE_PLAYERS} fake players...\n`);

const sockets = [];

for (let i = 1; i <= NUM_FAKE_PLAYERS; i++) {
    const socket = io(GAME_URL, {
        transports: ['websocket']
    });

    socket.on('connect', () => {
        console.log(`✅ Player ${i} connected (${socket.id})`);
        
        // Join matchmaking
        socket.emit('join_matchmaking', {
            username: `TestPlayer${i}`,
            socketId: socket.id
        });
    });

    socket.on('match_found', (data) => {
        console.log(`🎯 Player ${i} matched! Room: ${data.roomId}`);
    });

    socket.on('disconnect', () => {
        console.log(`❌ Player ${i} disconnected`);
    });

    sockets.push(socket);
}

// Cleanup after 2 minutes
setTimeout(() => {
    console.log('\n🧹 Cleaning up...');
    sockets.forEach(s => s.disconnect());
    process.exit(0);
}, 120000);

console.log('\n⏳ Fake players will stay for 2 minutes...');
console.log('Press Ctrl+C to cleanup early.\n');
```

**Chạy:**
```powershell
# Terminal 3
node load-generator.js
```

---

## 📉 Test Scenario 3: Auto Scale DOWN

### Setup

**Điều kiện để scale down:**
- CPU < 30%
- Queue = 0 (no one waiting)
- Đã qua 60s cooldown

**Steps:**

1. **Đóng tất cả game tabs** hoặc stop load generator (Ctrl+C)
2. Đợi matchmaking queue về 0
3. Đợi thêm **60 giây** (cooldown period)
4. Autoscaler sẽ tự động scale down

**Terminal 2 output:**
```
⏰ [14:35:45] ═══════════════════════════════════════
📊 Metrics:
   CPU Avg: 8.12%
   Queue: 0 players
   Active Players: 0
   Current Nodes: 2/5
😴 LOW LOAD detected. Triggering SCALE DOWN...

📉 ═══ SCALE DOWN ═══
   From: 2 → To: 1 containers
🔧 Executing: docker-compose up -d --scale game-service=1 --no-recreate
✅ Scale down successful!
```

---

## 🎨 Test Scenario 4: Stress Test (Max Nodes)

### Mục đích: Test upper limit (MAX_NODES = 5)

**Cấu hình trong `autoscaler.js`:**
```javascript
const MAX_NODES = 5;
const SCALE_UP_THRESHOLD_QUEUE = 10;
```

**Steps:**

1. Mở **50+ tabs** hoặc adjust load generator:
   ```javascript
   const NUM_FAKE_PLAYERS = 50;
   ```

2. Tất cả join matchmaking

3. Watch autoscaler scale lên 2 → 3 → 4 → 5

4. Khi đạt 5, sẽ thấy:
   ```
   ⚠️  Already at MAX_NODES (5), cannot scale up
   ```

**Expected behavior:**
- Autoscaler không scale quá 5
- System vẫn stable với 5 nodes
- Matchmaking vẫn hoạt động

---

## 📊 Test Scenario 5: Cooldown Test

### Mục đích: Verify cooldown prevents flapping

**Setup:**

1. Start với 1 node
2. Trigger scale up (queue > 10)
3. **NGAY LẬP TỨC** trigger scale down (close tabs)

**Expected:**
```
⏰ Cooldown active (45s remaining), skipping scale down
```

Autoscaler sẽ KHÔNG scale down cho đến khi hết 60s từ lần scale up.

**Why important:**
Prevents "flapping" (rapid up/down) which wastes resources and causes instability.

---

## 🔍 Monitoring During Tests

### Terminal 1: monitor-status.js --watch

Sẽ hiển thị real-time:
```
╔══════════════════════════════════════════════════════╗
║           🎮 TANK ONLINE - MONITOR STATUS           ║
╚══════════════════════════════════════════════════════╝

📦 DOCKER CONTAINERS:
   Game Service Instances: 3  ← Watch this change

📊 PROMETHEUS METRICS:
   Queue Size:       12 players  ← Trigger threshold
   Active Players:   8
   Active Rooms:     2
   Avg CPU Usage:    45.23%
   Avg Memory:       256.78 MB
```

### Grafana Dashboard

Mở http://localhost:3000 và xem "Tank Online Monitor":
- Graph sẽ hiển thị spikes khi có load
- Queue size tăng/giảm
- CPU/Memory trends

### Docker Commands

```powershell
# Watch containers real-time
docker-compose ps game-service

# Watch logs
docker-compose logs -f game-service

# Check resource usage
docker stats
```

---

## ✅ Success Criteria

### Test PASSED nếu:

- [x] Scale UP tự động khi queue > 10
- [x] Scale DOWN tự động khi queue = 0 và CPU < 30%
- [x] Cooldown period được respect (60s)
- [x] Không scale quá MAX_NODES (5)
- [x] Không scale xuống dưới MIN_NODES (1)
- [x] monitor-status.js hiển thị số instances đúng
- [x] Grafana dashboard update metrics real-time
- [x] Game vẫn playable trong quá trình scaling
- [x] No crashes hoặc errors

---

## 🐛 Common Issues

### Issue 1: Autoscaler không scale up dù queue > 10

**Debug:**
```powershell
# Check Prometheus có data không
curl "http://localhost:9090/api/v1/query?query=matchmaking_queue_size"
```

**Expected output:**
```json
{
  "status": "success",
  "data": {
    "result": [
      {
        "value": [1234567890, "12"]  ← Queue size
      }
    ]
  }
}
```

**Solutions:**
- Restart Prometheus: `docker-compose restart prometheus`
- Check game service expose metrics: `curl http://localhost:6000/metrics`
- Wait 15-30s for Prometheus to scrape

---

### Issue 2: Docker scale command fails

**Error:**
```
Error: container name conflict
```

**Solution:**
```powershell
docker-compose down
docker-compose up -d
```

---

### Issue 3: Queue không tăng dù có nhiều người

**Debug:**
Check game service logs:
```powershell
docker-compose logs game-service | Select-String "join_matchmaking"
```

**Solution:**
- Verify players đã click "Find Match"
- Check Redis connection: `docker-compose ps redis`
- Restart game service

---

## 📈 Advanced Testing

### Custom Thresholds

Edit `autoscaler.js`:
```javascript
// Test với thresholds thấp hơn để scale nhanh hơn
const SCALE_UP_THRESHOLD_QUEUE = 5;  // Default: 10
const SCALE_DOWN_THRESHOLD_CPU = 50; // Default: 30
const CHECK_INTERVAL = 5000;         // Default: 15000 (5s check)
const COOLDOWN_PERIOD = 30000;       // Default: 60000 (30s cooldown)
```

**Restart autoscaler sau khi sửa.**

---

### Load Testing Script với CPU Stress

```javascript
// cpu-stress.js - Generate CPU load
function cpuStress(duration) {
    const end = Date.now() + duration;
    while (Date.now() < end) {
        Math.sqrt(Math.random()); // Busy work
    }
}

setInterval(() => {
    console.log('🔥 Generating CPU load...');
    cpuStress(5000); // 5s of CPU stress
}, 10000);
```

Chạy trong game service container:
```powershell
docker-compose exec game-service node cpu-stress.js
```

---

## 📝 Test Report Template

```markdown
# Auto-Scaling Test Report

**Date:** 2026-01-30
**Tester:** [Your Name]

## Test Results

### Scenario 1: Manual Scaling
- ✅ Scale up: PASSED
- ✅ Scale down: PASSED
- Time to scale: 12 seconds

### Scenario 2: Auto Scale UP
- ✅ Queue trigger (>10): PASSED
- Threshold reached at: 12 players
- Scale action: 1 → 2 nodes
- Time to detect: 18 seconds
- Time to complete: 28 seconds

### Scenario 3: Auto Scale DOWN
- ✅ Low load trigger: PASSED
- Cooldown respected: YES
- Scale action: 2 → 1 nodes
- Time to complete: 15 seconds

### Scenario 4: Max Nodes
- ✅ Stopped at MAX_NODES: PASSED
- Max reached: 5 nodes
- No crashes: CONFIRMED

### Scenario 5: Cooldown
- ✅ Prevented flapping: PASSED
- Cooldown period: 60s
- Worked as expected: YES

## Issues Found
- None / [List any issues]

## Recommendations
- [Any suggestions for improvement]
```

---

## 🎯 Quick Start Command

```powershell
# One-liner để start all test tools
Start-Process pwsh -ArgumentList "-Command node monitor-status.js --watch"
Start-Process pwsh -ArgumentList "-Command node autoscaler.js"
Start-Process pwsh -ArgumentList "-Command docker-compose logs -f game-service"

# Sau đó generate load bằng cách mở nhiều tabs
1..12 | ForEach-Object { start http://localhost }
```

---

**Happy Testing! 🧪🚀**
