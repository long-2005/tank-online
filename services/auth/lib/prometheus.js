// ==========================================
// PROMETHEUS METRICS - Auth Service
// ==========================================
// Thu thập metrics về login, register, sessions
// để Prometheus scrape qua endpoint /metrics

const promClient = require('prom-client');

// Registry cho metrics
const register = new promClient.Registry();

// Default metrics (CPU, memory, etc)
promClient.collectDefaultMetrics({ register });

// ==========================================
// CUSTOM METRICS
// ==========================================

// 1. Login Attempts - Đếm số lần login
const loginCounter = new promClient.Counter({
    name: 'auth_login_attempts_total',
    help: 'Tổng số lần thử đăng nhập',
    labelNames: ['status'], // 'success' hoặc 'failed'
    registers: [register]
});

// 2. Registration Count - Đếm đăng ký mới
const registerCounter = new promClient.Counter({
    name: 'auth_registrations_total',
    help: 'Tổng số tài khoản đăng ký mới',
    labelNames: ['status'], // 'success' hoặc 'failed'
    registers: [register]
});

// 3. Active Sessions - Số user online
const sessionsGauge = new promClient.Gauge({
    name: 'auth_active_sessions',
    help: 'Số sessions đang active',
    registers: [register]
});

module.exports = {
    register,
    loginCounter,
    registerCounter,
    sessionsGauge
};
