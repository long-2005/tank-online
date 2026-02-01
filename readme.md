# 🎮 Tank Online - Multiplayer Battle Royale Game

Một game bắn tank multiplayer với chế độ Battle Royale, auto-scaling, load balancing, và monitoring hoàn chỉnh.

---

## 🚀 Quick Start (Dành cho người mới)

### 1️⃣ Khởi động nhanh nhất

```powershell
# Bước 1: Start Docker Desktop (manual)
# Bước 2: Chạy script tự động
.\scripts\start-all.ps1
```

Script sẽ tự động:
- ✅ Check Docker
- ✅ Stop old containers
- ✅ Start all services
- ✅ Show URLs để truy cập

### 2️⃣ Truy cập game

Sau khi start xong, mở browser:

| Service | URL | Credentials |
|---------|-----|-------------|
| 🎮 **Game** | http://localhost | - |
| 📊 **Grafana Dashboard** | http://localhost:3000 | admin / admin |
| 📈 **Prometheus** | http://localhost:9090 | - |
| 🖥️ **Monitor** | http://localhost/monitor | - |

---

## 📚 Hướng dẫn chi tiết

### Grafana không hiển thị dashboard?
👉 Đọc: [GRAFANA-GUIDE.md](./docs/GRAFANA-GUIDE.md)

### Auto-scaling là gì? Cách dùng?
👉 Đọc: [AUTO-SCALING.md](./docs/AUTO-SCALING.md)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│                   NGINX (Port 80)               │
│            Load Balancer + Reverse Proxy        │
└─────┬──────────────────────────────┬────────────┘
      │                              │
      ▼                              ▼
┌──────────┐                 ┌────────────────────┐
│   Auth   │                 │   Game Services    │
│ Service  │                 │  (Auto-scalable)   │
│ Port 5000│                 │   Port 6000+       │
└──────────┘                 └─────────┬──────────┘
                                       │
                     ┌─────────────────┼─────────────┐
                     ▼                 ▼             ▼
              ┌───────────┐    ┌──────────┐  ┌────────────┐
              │   Redis   │    │Prometheus│  │  Grafana   │
              │ (Queue)   │    │(Metrics) │  │(Dashboard) │
              └───────────┘    └──────────┘  └────────────┘
```

### Thành phần chính:

- **Auth Service**: Login, register, static files (HTML/CSS/JS)
- **Game Service**: Game logic, WebSocket, matchmaking (có thể scale 1-10 instances)
- **Nginx**: Load balancing, routing
- **Redis**: Shared matchmaking queue (global across all nodes)
- **Prometheus**: Metrics collection
- **Grafana**: Dashboard visualization
- **Auto-scaler**: Tự động scale game service dựa trên CPU/Queue

---

## 🎮 Features

### Game Features
- ✅ Multiplayer real-time combat
- ✅ Battle Royale matchmaking (2-4 players/room)
- ✅ Global matchmaking queue (cross-server)
- ✅ Responsive controls (WASD + Mouse)
- ✅ Collision detection
- ✅ Health system
- ✅ Leaderboard

### Infrastructure Features
- ✅ **Auto-scaling**: Tự động tăng/giảm game servers dựa trên load
- ✅ **Load Balancing**: Nginx phân phối traffic đều
- ✅ **Monitoring**: Prometheus + Grafana dashboard
- ✅ **Health Checks**: Tự động kiểm tra service health
- ✅ **Graceful Degradation**: System vẫn hoạt động khi 1 node down

---

## ⚙️ Tech Stack

### Backend
- **Node.js** + Express
- **Socket.IO** - Real-time communication
- **MongoDB** - User data, game history
- **Redis** - Matchmaking queue, session store

### Frontend
- **HTML5 Canvas** - Game rendering
- **Vanilla JavaScript** - Game logic
- **Responsive CSS** - UI design

### DevOps
- **Docker** + Docker Compose
- **Nginx** - Reverse proxy + load balancer
- **Prometheus** - Metrics collection
- **Grafana** - Visualization
- **Custom Auto-scaler** - Dynamic scaling

---

## 📂 Project Structure

> 📑 **Full file index**: See [docs/INDEX.md](./docs/INDEX.md) for complete navigation guide

```
tank-onlline/
├── docs/                  # 📚 All documentation
│   ├── INDEX.md           # Navigation guide
│   ├── AUTO-SCALING.md    # Auto-scaling guide
│   ├── GRAFANA-GUIDE.md   # Grafana troubleshooting
│   ├── QUICK-TEST.md      # Quick test reference
│   └── test-autoscale.md  # Detailed test scenarios
├── scripts/               # 🔧 All scripts & tools
│   ├── autoscaler.js      # Auto-scaling engine
│   ├── scale-helper.js    # Manual scaling utility
│   ├── load-generator.js  # Load testing tool
│   ├── start-all.ps1      # Start all services
│   └── quick-test.ps1     # Quick test setup
├── services/              # 🎮 Game services
│   ├── auth/              # Authentication + Static files
│   │   ├── public/        # Game client (HTML/CSS/JS)
│   │   └── index.js       # Auth server
│   ├── game/              # Game server (scalable)
│   │   ├── src/
│   │   │   ├── rooms/     # Game room logic
│   │   │   ├── workers/   # Game loop + matchmaking
│   │   │   ├── handlers/  # Socket event handlers
│   │   │   └── services/  # Matchmaking, metrics
│   │   └── index.js
│   └── monitoring/        # Monitoring stack
│       ├── prometheus/    # Prometheus config
│       └── grafana/       # Grafana dashboards
├── docker/                # 🐳 Docker configs
│   └── nginx/             # Nginx config
├── docker-compose.yml     # Service orchestration
├── README.md              # This file
└── .env                   # Environment variables
```

---

## 🛠️ Development

### Prerequisites
- Docker Desktop
- Node.js 16+
- MongoDB Atlas account (hoặc local MongoDB)

### Environment Variables

Tạo file `.env`:
```env
MONGO_URI=mongodb+srv://your-connection-string
PORT=5000
```

### Manual Development (without Docker)

```bash
# Terminal 1: Auth Service
cd services/auth
npm install
npm start

# Terminal 2: Game Service
cd services/game
npm install
npm start

# Terminal 3: Redis (Docker)
docker run -p 6379:6379 redis:alpine
```

---

## 🧪 Testing

### Test Auto-Scaling

```bash
# Terminal 1: Auto-scaler
node scripts/autoscaler.js

# Terminal 2: Generate load  
node scripts/load-generator.js 15

# Monitor via Grafana
# Open: http://localhost:3000
```

### Manual Scaling

```bash
# Scale to 3 instances
node scripts/scale-helper.js set 3

# Scale up +1
node scripts/scale-helper.js up

# Scale down -1
node scripts/scale-helper.js down

# Check status
node scripts/scale-helper.js status
```

---

## 📊 Monitoring

### Grafana Dashboard

Dashboard "Tank Online Monitor" hiển thị:
- Active Players (time series)
- Matchmaking Queue Size (gauge)
- CPU Usage per node (time series)
- Memory Usage per node (time series)

### Prometheus Queries

Useful queries:
```promql
# Total players across all nodes
sum(game_active_players_total)

# Average queue size over 5 minutes
avg_over_time(matchmaking_queue_size[5m])

# CPU usage per instance
rate(process_cpu_user_seconds_total[1m]) * 100

# Memory per player
sum(process_resident_memory_bytes) / sum(game_active_players_total)
```

---

## 🚀 Deployment

### Local (Development)
```bash
docker-compose up -d
```

### Production (Recommended: Kubernetes)

Để production scale lớn, nên migrate sang:
1. **Docker Swarm** (mid-scale)
2. **Kubernetes** (large-scale) với Horizontal Pod Autoscaler

---

## 📝 Common Commands

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f game-service

# Scale game service
docker-compose up -d --scale game-service=5

# Restart a service
docker-compose restart nginx

# Check service health
docker-compose ps
```

---

## 🐛 Troubleshooting

### Docker Desktop not running
```
Error: cannot connect to docker daemon
```
**Solution**: Start Docker Desktop and wait for it to be ready.

### Grafana dashboard empty
**Solution**: Xem [GRAFANA-GUIDE.md](./GRAFANA-GUIDE.md)

### Auto-scaler không scale
**Solution**: 
1. Check Docker đang chạy
2. Check Prometheus có data
3. Xem logs: `node autoscaler.js`

### Game không connect
**Solution**:
1. Check Nginx: `docker-compose ps nginx`
2. Check game-service: `docker-compose ps game-service`
3. Check browser console for errors

---

## 🤝 Contributing

Pull requests are welcome! Để contribute:

1. Fork the repo
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

---

## 📄 License

MIT License - feel free to use for learning/projects

---

## 🎯 Roadmap

- [x] Basic multiplayer game
- [x] Battle Royale matchmaking
- [x] Docker containerization
- [x] Load balancing
- [x] Auto-scaling
- [x] Monitoring (Prometheus + Grafana)
- [ ] Mobile-responsive UI
- [ ] Power-ups and items
- [ ] Different tank types
- [ ] Replay system
- [ ] Tournament mode
- [ ] Leaderboard persistence
- [ ] Social features (friends, teams)

---

## 📧 Contact

Có questions? Tạo issue trên GitHub hoặc liên hệ qua email.

---

**Happy Gaming! 🎮🚀**
