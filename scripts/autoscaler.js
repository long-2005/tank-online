// autoscaler.js
// Script để monitor metrics từ Prometheus và auto-scale game service
// Usage: node autoscaler.js

const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const PROMETHEUS_URL = 'http://localhost:9090';
const SCALE_UP_THRESHOLD_CPU = 70; // 70% CPU
const SCALE_DOWN_THRESHOLD_CPU = 30; // 30% CPU
const SCALE_UP_THRESHOLD_QUEUE = 10; // 10 người trong queue
const CHECK_INTERVAL = 15000; // Check mỗi 15s
const COOLDOWN_PERIOD = 60000; // 60s cooldown giữa các lần scale
const DOCKER_COMPOSE_PATH = __dirname; // Thư mục chứa docker-compose.yml

let currentNodes = 1; // Bắt đầu với 1 node
const MIN_NODES = 1;
const MAX_NODES = 5;
let lastScaleAction = 0;

// Hàm execute command shell với promise
async function runCommand(cmd, cwd = DOCKER_COMPOSE_PATH) {
    try {
        console.log(` Executing: ${cmd}`);
        const { stdout, stderr } = await execPromise(cmd, { cwd });
        if (stderr && !stderr.includes('WARNING')) {
            console.warn(` stderr: ${stderr}`);
        }
        return { success: true, output: stdout };
    } catch (error) {
        console.error(` Error running command: ${cmd}`, error.message);
        return { success: false, error: error.message };
    }
}

// Lấy số game-service containers đang chạy
async function getCurrentScale() {
    try {
        const result = await runCommand('docker-compose ps -q game-service');
        if (!result.success) return 1;

        // Đếm số dòng (mỗi container = 1 line với container ID)
        const lines = result.output.trim().split('\n').filter(line => line.length > 0);
        const count = lines.length;
        console.log(` Current scale: ${count} container(s) running`);
        return count;
    } catch (err) {
        console.error('Error getting current scale:', err.message);
        return currentNodes; // Fallback to tracked value
    }
}

// Query metric từ Prometheus
async function getMetricValue(query) {
    try {
        const res = await axios.get(`${PROMETHEUS_URL}/api/v1/query`, {
            params: { query: query },
            timeout: 5000
        });

        if (res.data.status === 'success' && res.data.data.result.length > 0) {
            return parseFloat(res.data.data.result[0].value[1]);
        }
    } catch (err) {
        console.error(` Error querying Prometheus (${query}):`, err.message);
    }
    return 0;
}

// Scale UP
async function scaleUp() {
    const now = Date.now();
    if (now - lastScaleAction < COOLDOWN_PERIOD) {
        const remaining = Math.ceil((COOLDOWN_PERIOD - (now - lastScaleAction)) / 1000);
        console.log(` Cooldown active (${remaining}s remaining), skipping scale up`);
        return false;
    }

    const current = await getCurrentScale();
    if (current >= MAX_NODES) {
        console.log(` Already at MAX_NODES (${MAX_NODES}), cannot scale up`);
        return false;
    }

    const target = Math.min(current + 1, MAX_NODES);
    console.log(`\n  SCALE UP `);
    console.log(`   From: ${current} → To: ${target} containers`);

    const result = await runCommand(`docker-compose up -d --scale game-service=${target} --no-recreate`);

    if (result.success) {
        console.log(` Scale up successful!`);
        lastScaleAction = now;
        currentNodes = target;
        return true;
    } else {
        console.error(` Scale up failed!`);
        return false;
    }
}

// Scale DOWN
async function scaleDown() {
    const now = Date.now();
    if (now - lastScaleAction < COOLDOWN_PERIOD) {
        const remaining = Math.ceil((COOLDOWN_PERIOD - (now - lastScaleAction)) / 1000);
        console.log(` Cooldown active (${remaining}s remaining), skipping scale down`);
        return false;
    }

    const current = await getCurrentScale();
    if (current <= MIN_NODES) {
        console.log(`  Already at MIN_NODES (${MIN_NODES}), cannot scale down`);
        return false;
    }

    const target = Math.max(current - 1, MIN_NODES);
    console.log(`\n  SCALE DOWN `);
    console.log(`   From: ${current} → To: ${target} containers`);

    const result = await runCommand(`docker-compose up -d --scale game-service=${target} --no-recreate`);

    if (result.success) {
        console.log(` Scale down successful!`);
        lastScaleAction = now;
        currentNodes = target;
        return true;
    } else {
        console.error(` Scale down failed!`);
        return false;
    }
}

// Main check and scale logic
async function checkAndScale() {
    const now = new Date().toLocaleTimeString('vi-VN');
    console.log(`\n [${now}] `);

    // Sync current scale
    currentNodes = await getCurrentScale();

    // 1. Get Avg CPU across all game nodes
    const avgCpu = await getMetricValue('avg(rate(process_cpu_user_seconds_total{job="game-nodes"}[1m])) * 100');

    // 2. Get Queue Size
    const queueSize = await getMetricValue('matchmaking_queue_size');

    // 3. Get Active Players
    const activePlayers = await getMetricValue('sum(game_active_players_total)');

    console.log(` Metrics:`);
    console.log(`   CPU Avg: ${avgCpu.toFixed(2)}%`);
    console.log(`   Queue: ${queueSize} players`);
    console.log(`   Active Players: ${activePlayers}`);
    console.log(`   Current Nodes: ${currentNodes}/${MAX_NODES}`);

    // --- SCALING LOGIC ---

    // SCALE UP: High CPU OR large queue
    if ((avgCpu > SCALE_UP_THRESHOLD_CPU || queueSize > SCALE_UP_THRESHOLD_QUEUE) && currentNodes < MAX_NODES) {
        console.log(` HIGH LOAD detected! Triggering SCALE UP...`);
        await scaleUp();
    }
    // SCALE DOWN: Low CPU AND empty queue
    else if (avgCpu < SCALE_DOWN_THRESHOLD_CPU && queueSize === 0 && currentNodes > MIN_NODES) {
        console.log(` LOW LOAD detected. Triggering SCALE DOWN...`);
        await scaleDown();
    } else {
        console.log(` System stable. No scaling needed.`);
    }
}

// Khởi động
console.log(`\n╗`);
console.log(`         TANK ONLINE AUTO-SCALER STARTED        `);
console.log(`╝`);
console.log(`\n  Configuration:`);
console.log(`   Prometheus: ${PROMETHEUS_URL}`);
console.log(`   Scale Range: ${MIN_NODES} - ${MAX_NODES} nodes`);
console.log(`   CPU Threshold: ${SCALE_DOWN_THRESHOLD_CPU}% - ${SCALE_UP_THRESHOLD_CPU}%`);
console.log(`   Queue Threshold: ${SCALE_UP_THRESHOLD_QUEUE} players`);
console.log(`   Check Interval: ${CHECK_INTERVAL / 1000}s`);
console.log(`   Cooldown: ${COOLDOWN_PERIOD / 1000}s\n`);

// Initial check để sync state
getCurrentScale().then(scale => {
    currentNodes = scale;
    console.log(` Initial state synced: ${scale} container(s)\n`);

    // Start monitoring loop
    setInterval(checkAndScale, CHECK_INTERVAL);

    // Run first check immediately
    checkAndScale();
});

