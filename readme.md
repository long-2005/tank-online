# 🎮 Tank Online - Multiplayer Game

Game xe tăng online với kiến trúc microservices, load balancing và monitoring.

## 🚀 Chạy Dự Án Với Docker (Khuyến Nghị)

### Yêu Cầu
- Docker Desktop đã cài đặt và đang chạy

### Các Bước

1. **Clone dự án và cài đặt**
```bash
cd "e:\anh chinh\tank-onlline"
```

2. **Kiểm tra file .env**
File `.env` đã được tạo sẵn với MongoDB URI. Bạn có thể chỉnh sửa nếu cần.

3. **Build và chạy toàn bộ hệ thống**
```bash
docker-compose up --build
```

4. **Truy cập game**
- **Game**: http://localhost
- **Monitor Dashboard**: http://localhost/monitor

### Dừng Hệ Thống
```bash
docker-compose down
```

### Xem Logs
```bash
# Xem tất cả logs
docker-compose logs -f

# Xem log của một service cụ thể
docker-compose logs -f auth-service
docker-compose logs -f game-service-1
```

---

## 🛠️ Chạy Thủ Công (Cách Cũ)

Nếu không dùng Docker, bạn vẫn có thể chạy thủ công:

```bash
# Bật các file .bat
start_fast.bat      # Chạy Auth + 3 Game Nodes
start_monitor.bat   # Chạy Monitor Dashboard
# Bật nginx.exe thủ công
```

---

## 📊 Kiến Trúc

```
                    ┌─────────────┐
                    │   Nginx     │  (Port 80)
                    │Load Balancer│
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼────┐      ┌─────▼──────┐    ┌─────▼──────┐
   │ Game-1  │      │  Game-2    │    │  Game-3    │
   │Port 6001│      │ Port 6002  │    │ Port 6003  │
   └─────────┘      └────────────┘    └────────────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
                    ┌──────▼──────┐
                    │ Auth Service│  (Port 5000)
                    │  + MongoDB  │
                    └─────────────┘
```

---

## 🔧 Các Lệnh Docker Hữu Ích

```bash
# Rebuild lại một service cụ thể
docker-compose up --build auth-service

# Chạy ở chế độ nền (detached)
docker-compose up -d

# Scale thêm game nodes (nâng cao)
docker-compose up --scale game-service=5

# Xóa tất cả containers, networks, volumes
docker-compose down -v
```

---

**Ngrok/DuckDNS (Cho server online)**:
```bash
node get_link.js    # Xem tên miền
ngrok http 80       # Mở cổng 80 ra internet
```