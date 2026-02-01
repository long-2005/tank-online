// ==========================================
// PROMETHEUS METRICS - Game Service
// ==========================================
// Thu thập metrics về players, rooms, queue
// để Prometheus scrape qua endpoint /metrics

const promClient = require('prom-client');

// Registry cho metrics
const register = new promClient.Registry();

// Default metrics (CPU, memory, event loop lag, etc)
promClient.collectDefaultMetrics({ register });

// ==========================================
// CUSTOM METRICS
// ==========================================

// 1. Active Players - Số người đang chơi
const playersGauge = new promClient.Gauge({
    name: 'game_active_players_total',
    help: 'Tổng số người đang active trong game',
    registers: [register]
});

// 2. Active Rooms - Số phòng đang chạy
const roomsGauge = new promClient.Gauge({
    name: 'game_active_rooms_total',
    help: 'Tổng số phòng game đang hoạt động',
    registers: [register]
});

// 3. Matchmaking Queue - Số người chờ
const queueGauge = new promClient.Gauge({
    name: 'matchmaking_queue_size',
    help: 'Số players đang chờ trong matchmaking queue',
    registers: [register]
});

// 4. Bullets Active - Số viên đạn đang bay
const bulletsGauge = new promClient.Gauge({
    name: 'game_active_bullets_total',
    help: 'Tổng số viên đạn đang active',
    registers: [register]
});

module.exports = {
    register,
    playersGauge,
    roomsGauge,
    queueGauge,
    bulletsGauge
};
