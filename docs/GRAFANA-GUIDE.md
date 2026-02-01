# 🚀 Quick Start Guide - Tank Online với Grafana

## ⚠️ VẤN ĐỀ: Grafana không hiển thị dashboard

### Nguyên nhân chính:
**Docker Desktop chưa được khởi động!**

---

## ✅ GIẢI PHÁP - 3 Bước đơn giản

### Bước 1: Khởi động Docker Desktop

1. **Mở Docker Desktop**
   - Tìm Docker Desktop trong Start Menu
   - Hoặc chạy từ Desktop shortcut
   - Đợi cho đến khi thấy "Docker Desktop is running" ở system tray

2. **Kiểm tra Docker đã chạy**
   ```powershell
   docker ps
   ```
   - ✅ Nếu thấy danh sách containers (hoặc rỗng) → OK
   - ❌ Nếu báo lỗi "cannot connect" → Docker chưa chạy, đợi thêm

---

### Bước 2: Khởi động tất cả services

```powershell
cd "e:\anh chinh\tank-onlline"

# Start tất cả services (với 1 game instance ban đầu)
docker-compose up -d

# Kiểm tra tất cả services đang chạy
docker-compose ps
```

**Kết quả mong đợi:**
```
NAME                  STATUS
tank-auth             running
tank-game-1           running (hoặc tank-onlline-game-service-1)
tank-nginx            running
tank-prometheus       running
tank-grafana          running
tank-redis            running
```

---

### Bước 3: Truy cập Grafana

1. **Mở browser và truy cập:**
   ```
   http://localhost:3000
   ```

2. **Login lần đầu:**
   - Username: `admin`
   - Password: `admin`
   - Grafana sẽ yêu cầu đổi password → Có thể skip

3. **Tìm Dashboard:**
   - Click vào icon **☰** (hamburger menu) bên trái
   - Chọn **Dashboards**
   - Hoặc **Search** (🔍) → Gõ "Tank"
   - Click vào **"Tank Online Monitor"**

---

## 📊 Dashboard Metrics

Dashboard sẽ hiển thị 4 panels:

### 1. Active Players (Time Series)
- Số người chơi đang active theo thời gian
- Metric: `game_active_players_total`

### 2. Queue Size (Gauge)
- Số người đang chờ matchmaking
- Metric: `matchmaking_queue_size`
- Màu đỏ khi > 50 người

### 3. CPU Usage (Time Series)
- CPU usage của từng game node
- Metric: `rate(process_cpu_user_seconds_total[1m]) * 100`

### 4. Memory Usage (Time Series)
- RAM usage của từng game node
- Metric: `process_resident_memory_bytes`

---

## 🔧 Troubleshooting

### Problem: Dashboard hiển thị "No data"

**Nguyên nhân:** Metrics chưa có data vì chưa có ai chơi

**Giải pháp:**
1. Mở game: http://localhost
2. Login và vào game
3. Đợi 15-30 giây để Prometheus scrape metrics
4. Refresh Grafana dashboard

---

### Problem: Dashboard không tìm thấy

**Cách 1: Import thủ công**
1. Trong Grafana, click **☰** → **Dashboards** → **New** → **Import**
2. Paste nội dung file: `services/monitoring/grafana/dashboards/json/tank_dashboard.json`
3. Click **Load**
4. Chọn datasource: **Prometheus**
5. Click **Import**

**Cách 2: Restart Grafana container**
```powershell
docker-compose restart grafana

# Đợi 10 giây
# Refresh browser
```

---

### Problem: Prometheus datasource not found

**Kiểm tra:**
```powershell
# Check Prometheus đang chạy
docker-compose ps prometheus

# Test connection
curl http://localhost:9090
```

**Nếu Prometheus không chạy:**
```powershell
docker-compose up -d prometheus
```

**Trong Grafana:**
1. Click **⚙️** (Settings) → **Data sources**
2. Nên thấy **Prometheus** với URL `http://prometheus:9090`
3. Click **Test** → Nên thấy "✅ Data source is working"

---

## 🎯 Các URLs hữu ích

| Service | URL | Credentials |
|---------|-----|-------------|
| **Game** | http://localhost | - |
| **Grafana** | http://localhost:3000 | admin / admin |
| **Prometheus** | http://localhost:9090 | - |
| **Monitor Dashboard** | http://localhost/monitor | - |

---

## 📸 Screenshot mẫu

Khi dashboard hoạt động đúng, bạn sẽ thấy:

```
╔════════════════════════════════════════════════╗
║         Tank Online Monitor Dashboard         ║
╠════════════════════════════════════════════════╣
║  Active Players          │  Queue Size        ║
║  [📈 Line Chart]          │  [⏱️ Gauge: 0]      ║
╠════════════════════════════════════════════════╣
║  CPU Usage (%)           │  Memory Usage      ║
║  [📈 Multi-line]          │  [📈 Multi-line]    ║
╚════════════════════════════════════════════════╝
```

---

## 🚀 Workflow hoàn chỉnh

```powershell
# 1. Start Docker Desktop (manual)

# 2. Start services
docker-compose up -d

# 3. Verify all running
docker-compose ps

# 4. Mở Grafana
start http://localhost:3000

# 5. Login (admin/admin)

# 6. Tìm "Tank Online Monitor" dashboard

# 7. Chơi game để generate metrics
start http://localhost

# 8. (Optional) Chạy auto-scaler
node autoscaler.js

# 9. (Optional) Monitor real-time
node monitor-status.js --watch
```

---

## ❓ FAQ

**Q: Tại sao metrics là 0?**
A: Chưa có người chơi. Vào game và đợi vài giây.

**Q: CPU/Memory graph trống?**
A: Prometheus chưa scrape đủ data. Đợi 30s-1 phút.

**Q: Có thể custom dashboard không?**
A: Có! Click **⚙️** icon trên dashboard → **Settings** → Chỉnh sửa panels.

**Q: Dashboard bị mất khi restart?**
A: Không mất. Dashboard được lưu trong `grafana-data` volume.

**Q: Làm sao thêm panel mới?**
A: Click **Add panel** → Chọn visualization type → Nhập Prometheus query.

---

## 🎨 Custom Queries hữu ích

Thêm vào dashboard của bạn:

### Total Bullets Active
```promql
sum(game_active_bullets_total)
```

### Average Queue Wait Time
```promql
avg_over_time(matchmaking_queue_size[5m])
```

### Game Rooms Count
```promql
sum(game_active_rooms_total)
```

### Memory per Player
```promql
sum(process_resident_memory_bytes) / sum(game_active_players_total)
```

---

## ✅ Kết luận

**TÓM TẮT:**
1. ✅ Dashboard đã được config sẵn
2. ✅ Grafana + Prometheus ready
3. ⚠️ **CHỈ CẦN START DOCKER DESKTOP**
4. ✅ Sau đó `docker-compose up -d`
5. ✅ Vào http://localhost:3000

**Grafana sẽ tự động load dashboard và hiển thị metrics!** 🎉
