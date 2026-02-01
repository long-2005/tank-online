const { SERVICE_ID, TILE_SIZE, ROWS, COLS, MAP } = require('./config');

const logBuffer = [];

function addLog(msg) {
    const logEntry = `[${new Date().toISOString()}] [${SERVICE_ID}] ${msg}`;
    logBuffer.push(logEntry);
    if (logBuffer.length > 50) logBuffer.shift();
    console.log(logEntry);
}

function getLogs() {
    return logBuffer;
}

function checkWallCollision(x, y) {
    const RADIUS = 22;
    const minX = Math.floor((x - RADIUS) / TILE_SIZE), maxX = Math.floor((x + RADIUS) / TILE_SIZE);
    const minY = Math.floor((y - RADIUS) / TILE_SIZE), maxY = Math.floor((y + RADIUS) / TILE_SIZE);

    for (let r = minY; r <= maxY; r++) {
        for (let c = minX; c <= maxX; c++) {
            if (r < 0 || r >= ROWS || c < 0 || c >= COLS || MAP[r][c] === 1) return true;
        }
    }
    return false;
}

module.exports = { addLog, getLogs, checkWallCollision };
