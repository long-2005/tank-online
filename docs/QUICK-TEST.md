# 🚀 Auto-Scale Testing - Quick Reference

## ⚡ Super Quick Start (1 command)

```powershell
.\quick-test.ps1
```

Sẽ tự động:
1. ✅ Check Docker
2. ✅ Start services (nếu chưa chạy)
3. ✅ Mở 2 windows: Autoscaler, Logs
4. ✅ Hỏi bạn muốn generate load

---

## 📋 Manual Steps (Nếu muốn control từng bước)

### Bước 1: Start Services
```powershell
docker-compose up -d
```

### Bước 2: Open Monitoring

**Grafana Dashboard:**
```
Open: http://localhost:3000
Login: admin / admin
Dashboard: "Tank Online Monitor"
```

### Bước 3: Start Autoscaler

**Terminal 1: Autoscaler**
```powershell
node scripts/autoscaler.js
```

**Terminal 2: Load Generator**
```powershell
# Option A: Fake players
node scripts/load-generator.js 15

# Option B: Real browser tabs
1..12 | ForEach-Object { start http://localhost }
```

---

## 🎯 What to Watch

### Grafana Dashboard (http://localhost:3000)
- **Active Players** graph - Shows player count
- **Queue Size** gauge - Shows matchmaking queue
- **CPU Usage** - Per-node CPU metrics
- **Memory Usage** - Per-node memory

### Autoscaler Terminal
```
 HIGH LOAD detected! Triggering SCALE UP...
 From: 1 → To: 2 containers
 Scale up successful!
```

### Browser (If using real tabs)
- Login with different usernames
- Click "Find Match"
- Keep at waiting screen

---

## ⏱️ Timeline

| Time | Event | What happens |
|------|-------|--------------|
| 0:00 | Start autoscaler | Begin monitoring |
| 0:15 | Generate load (12+ players) | Queue fills up |
| 0:30 | Prometheus scrapes metrics | Queue size = 12 |
| 0:45 | Autoscaler detects | "HIGH LOAD" message |
| 1:00 | Scale command executes | Docker creates 2nd container |
| 1:15 | New container ready | Load balanced across 2 nodes |

---

## 🧪 Test Scenarios

### Scenario 1: Scale UP
1. Start với 1 node
2. Generate 12+ players
3. Wait for scale to 2 nodes
4. ✅ Success if autoscaler shows "Scale up successful"

### Scenario 2: Scale DOWN  
1. Close all tabs / Stop load generator
2. Wait 60 seconds (cooldown)
3. Should scale back to 1 node
4. ✅ Success if autoscaler shows "Scale down successful"

### Scenario 3: Multiple Scale UPs
1. Keep adding more players
2. Should scale: 1 → 2 → 3 → 4 → 5
3. Stop at MAX_NODES (5)

---

## 🐛 Quick Troubleshooting

| Problem | Quick Fix |
|---------|-----------|
| Autoscaler not scaling | Check Prometheus: `curl localhost:9090/api/v1/query?query=matchmaking_queue_size` |
| Queue size always 0 | Check players clicked "Find Match" |
| Docker error | `docker-compose down && docker-compose up -d` |
| Load generator fails | Install socket.io-client: `npm install socket.io-client` |

---

## ✅ Success Checklist

- [ ] Started Docker Desktop
- [ ] All services running (`docker-compose ps`)
- [ ] Grafana dashboard accessible (localhost:3000)
- [ ] Autoscaler running without errors
- [ ] Generate load (queue > 10)
- [ ] Autoscaler detects and scales up (1 → 2)
- [ ] Grafana shows 2 nodes active
- [ ] Stop load
- [ ] After 60s, autoscaler scales down (2 → 1)

---

## 📸 Expected Output

### Before Load
```
Current Nodes: 1/5
Queue: 0 players
✅ System stable. No scaling needed.
```

### During Load (Queue > 10)
```
Current Nodes: 1/5
Queue: 12 players
🔥 HIGH LOAD detected! Triggering SCALE UP...
📈 ═══ SCALE UP ═══
   From: 1 → To: 2 containers
✅ Scale up successful!
```

### After Scale Up
```
Current Nodes: 2/5
Queue: 5 players  (being matched)
✅ System stable. No scaling needed.
```

### Cooldown Period
```
⏰ Cooldown active (45s remaining), skipping scale down
```

### Final Scale Down
```
Current Nodes: 2/5
Queue: 0 players
😴 LOW LOAD detected. Triggering SCALE DOWN...
📉 ═══ SCALE DOWN ═══
   From: 2 → To: 1 containers
✅ Scale down successful!
```

---

## 🎓 Pro Tips

1. **Watch Grafana**: http://localhost:3000 - Visual graphs!
2. **Adjust Thresholds**: Edit `autoscaler.js` line 9-16
3. **Faster Testing**: Reduce `SCALE_UP_THRESHOLD_QUEUE` to 5
4. **Skip Cooldown** (testing only): Set `COOLDOWN_PERIOD` to 10000 (10s)
5. **More Nodes**: Change `MAX_NODES` to 10

---

## 📚 Full Documentation

- Detailed guide: [test-autoscale.md](./test-autoscale.md)
- Auto-scaling setup: [AUTO-SCALING.md](./AUTO-SCALING.md)
- Main README: [README.md](./README.md)

---

**Made with ❤️ for easy testing! 🧪**
