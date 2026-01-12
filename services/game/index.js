const { Server } = require("socket.io");
const mongoose = require('mongoose');
const http = require('http');
const fs = require('fs');

const PORT = process.env.PORT || 6000;

// --- HTTP SERVER (Native Node.js for Health Check & Logging) ---
// Chương 8: Log Management - Log request vào console
// Chương 8: Health Monitoring - Endpoint /health
const logBuffer = [];
function addLog(msg) {
    const logEntry = `[${new Date().toISOString()}] ${msg}`;
    logBuffer.push(logEntry);
    if (logBuffer.length > 50) logBuffer.shift(); // Keep last 50 logs
    console.log(logEntry);
}
const httpServer = http.createServer((req, res) => {
    // Logging
    // console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`); // Removed direct log

    if (req.url !== '/api/logs' && req.url !== '/health') {
        addLog(`${req.method} ${req.url}`);
    }

    // Health Check
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({
            status: 'UP',
            service: 'Game Service',
            uptime: process.uptime(),
            timestamp: Date.now(),
            dbConnection: useDB ? 'Connected' : 'Disconnected (RAM Mode)'
        }));
        return;
    }

    // Log API
    if (req.url === '/api/logs') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(logBuffer));
        return;
    }

    res.writeHead(404);
    res.end();
});

// Socket.io Server (Attached to HTTP Server)
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

httpServer.listen(PORT, () => {
    console.log(`🚀 [Game Service] HTTP & Socket.io running on port ${PORT}`);
});

// --- BACKUP AUTOMATION (Chương 7: Sao lưu) ---
// Tự động sao lưu dữ liệu RAM
function backupData() {
    try {
        if (typeof rooms === 'undefined') return;

        let allPlayers = {};
        for (let roomId in rooms) {
            Object.assign(allPlayers, rooms[roomId].players);
        }

        if (Object.keys(allPlayers).length > 0) {
            fs.writeFileSync('backup_gamestate.json', JSON.stringify(allPlayers, null, 2));
            console.log(`[BACKUP] Saved ${Object.keys(allPlayers).length} players state.`);
        }
    } catch (e) {
        console.error("[BACKUP ERROR]", e);
    }
}
setInterval(backupData, 10 * 60 * 1000); // 10 mins

// --- GRACEFUL SHUTDOWN (Chương 3: Quản lý tiến trình) ---
process.on('SIGINT', async () => {
    console.log('\n[GAME SERVICE] Shutting down gracefully...');
    backupData();
    if (useDB) await mongoose.connection.close();
    process.exit(0);
});

// Remove old console log line since we listen inside callback now

// --- DATABASE CONNECTION ---
// Needed to update money on kill
const MONGO_URI = process.env.MONGO_URI || process.env.Mongo_url || "mongodb+srv://concathu119_db_user:TnfICaLIi059MGlR@long.1vyupsh.mongodb.net/?appName=long";
let useDB = false;

mongoose.connect(MONGO_URI)
    .then(() => { console.log(" [Game] Connected to MongoDB"); useDB = true; })
    .catch(err => console.log(" [Game] DB Error:", err));

const UserSchema = new mongoose.Schema({
    username: String,
    password: { type: String },
    money: { type: Number, default: 0 },
    skins: { type: [String] },
    currentSkin: { type: String }
});
const UserModel = mongoose.model('User', UserSchema);

async function addMoney(username, amount) {
    if (!useDB) return; // In-memory fallback not implemented for game service split
    try {
        await UserModel.updateOne({ username }, { $inc: { money: amount } });
    } catch (e) {
        console.error("Money update failed", e);
    }
}

// --- GAME LOGIC (Copied from server.js) ---

// CONFIG
const TILE_SIZE = 20; const COLS = 40; const ROWS = 30;
const TANK_CONFIG = {
    'tank': { name: "M4 Sherman", price: 0, speed: 3, hp: 100, damage: 10, recoil: 5, reloadTime: 500 },
    'tank1': { name: "T-34 Legend", price: 100, speed: 3.5, hp: 110, damage: 12, recoil: 5, reloadTime: 450 },
    'tank2': { name: "M18 Hellcat", price: 300, speed: 5.5, hp: 70, damage: 8, recoil: 3, reloadTime: 150 },
    'tank3': { name: "Tiger I", price: 600, speed: 2, hp: 200, damage: 20, recoil: 2, reloadTime: 900 },
    'tank4': { name: "IS-2 Soviet", price: 1200, speed: 3.5, hp: 100, damage: 45, recoil: 45, reloadTime: 1800 },
    'tank5': { name: "Maus Tank", price: 2500, speed: 3, hp: 300, damage: 35, recoil: 10, reloadTime: 700 }
};

// MAP GENERATION
const MAP = [];
for (let r = 0; r < ROWS; r++) {
    let row = [];
    for (let c = 0; c < COLS; c++) {
        if (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1) row.push(1);
        else if (r % 6 === 0 && c % 6 === 0) row.push(1);
        else if (r % 6 === 0 && (c - 1) % 6 === 0) row.push(1);
        else if ((r - 1) % 6 === 0 && c % 6 === 0) row.push(1);
        else if ((r - 1) % 6 === 0 && (c - 1) % 6 === 0) row.push(1);
        else row.push(0);
    }
    MAP.push(row);
}
// Clean Zone
const clearZone = (r1, c1, r2, c2) => {
    for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
            if (r > 0 && r < ROWS - 1 && c > 0 && c < COLS - 1) MAP[r][c] = 0;
        }
    }
};
clearZone(1, 1, 5, 5); clearZone(1, 34, 5, 38); clearZone(24, 1, 28, 5); clearZone(24, 34, 28, 38); clearZone(12, 17, 17, 22);

// COLLISION UTILS
function checkWallCollision(x, y) {
    const RADIUS = 22;
    const minGridX = Math.floor((x - RADIUS) / TILE_SIZE);
    const maxGridX = Math.floor((x + RADIUS) / TILE_SIZE);
    const minGridY = Math.floor((y - RADIUS) / TILE_SIZE);
    const maxGridY = Math.floor((y + RADIUS) / TILE_SIZE);
    for (let r = minGridY; r <= maxGridY; r++) {
        for (let c = minGridX; c <= maxGridX; c++) {
            if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return true;
            if (MAP[r][c] === 1) return true;
        }
    }
    return false;
}

// --- ROOM SYSTEM ---
class GameRoom {
    constructor(id, name, ownerId) {
        this.id = id;
        this.name = name;
        this.ownerId = ownerId;
        this.players = {};
        this.bullets = [];
        this.shieldItem = { x: -100, y: -100, active: false, nextSpawnTime: Date.now() };
        this.maxPlayers = 4;
        this.map = MAP;
    }

    addPlayer(socket, userData) {
        if (Object.keys(this.players).length >= this.maxPlayers) return false;

        let spawnX, spawnY, attempts = 0;
        do { spawnX = Math.random() * 700 + 50; spawnY = Math.random() * 500 + 50; attempts++; }
        while ((checkWallCollision(spawnX, spawnY) || this.checkTankCollision(socket.id, spawnX, spawnY)) && attempts < 200);

        let skin = (userData.skin) ? userData.skin : 'tank';
        let stats = TANK_CONFIG[skin] || TANK_CONFIG['tank'];

        this.players[socket.id] = {
            username: userData.username,
            x: spawnX, y: spawnY, angle: 0, skin: skin,
            hp: stats.hp, maxHp: stats.hp, speed: stats.speed, damage: stats.damage,
            recoil: stats.recoil, reloadTime: stats.reloadTime, lastShotTime: 0,
            lastActive: Date.now(),
            invincibleUntil: 0
        };
        return true;
    }

    removePlayer(socketId) {
        delete this.players[socketId];
    }

    checkTankCollision(id, x, y) {
        const TANK_RADIUS = 22; const MIN_DIST = TANK_RADIUS * 2;
        for (let otherId in this.players) {
            if (otherId === id) continue;
            let other = this.players[otherId];
            if (!other) continue;
            if (Math.sqrt((x - other.x) ** 2 + (y - other.y) ** 2) < MIN_DIST) return true;
        }
        return false;
    }

    update() {
        let now = Date.now();
        // Shield
        if (!this.shieldItem.active && now >= this.shieldItem.nextSpawnTime) this.spawnShield();
        if (this.shieldItem.active) {
            for (let id in this.players) {
                let p = this.players[id];
                if (Math.sqrt((p.x - this.shieldItem.x) ** 2 + (p.y - this.shieldItem.y) ** 2) < 40) {
                    this.shieldItem.active = false;
                    this.shieldItem.nextSpawnTime = now + 60000;
                    p.invincibleUntil = now + 3000;
                    break;
                }
            }
        }
        // Bullets
        for (let i = 0; i < this.bullets.length; i++) {
            let b = this.bullets[i];
            b.x += b.speedX; b.y += b.speedY;
            let gridX = Math.floor(b.x / TILE_SIZE);
            let gridY = Math.floor(b.y / TILE_SIZE);
            if (gridY < 0 || gridY >= ROWS || gridX < 0 || gridX >= COLS || MAP[gridY][gridX] === 1) {
                this.bullets.splice(i, 1); i--; continue;
            }
            let hit = false;
            for (let id in this.players) {
                if (id === b.ownerId) continue;
                let p = this.players[id];
                if (p.invincibleUntil && now < p.invincibleUntil) continue;
                if (Math.sqrt((b.x - p.x) ** 2 + (b.y - p.y) ** 2) < 25) {
                    p.hp -= b.damage; hit = true;
                    if (p.hp <= 0) { // Respawn Logic
                        let attempts = 0;
                        do { p.x = Math.random() * 700 + 50; p.y = Math.random() * 500 + 50; attempts++; }
                        while ((checkWallCollision(p.x, p.y) || this.checkTankCollision(id, p.x, p.y)) && attempts < 200);
                        p.hp = TANK_CONFIG[p.skin].hp;
                        p.invincibleUntil = 0;
                        if (io.sockets.sockets.get(b.ownerId)) io.to(b.ownerId).emit('kill_reward', 100);
                    }
                    break;
                }
            }
            if (b.x < 0 || b.x > 800 || b.y < 0 || b.y > 600 || hit) { this.bullets.splice(i, 1); i--; }
        }
        return { players: this.players, bullets: this.bullets, shield: this.shieldItem };
    }

    spawnShield() {
        let attempts = 0, spawnX, spawnY;
        do { spawnX = Math.random() * 700 + 50; spawnY = Math.random() * 500 + 50; attempts++; }
        while (checkWallCollision(spawnX, spawnY) && attempts < 100);
        if (attempts < 100) { this.shieldItem.x = spawnX; this.shieldItem.y = spawnY; this.shieldItem.active = true; }
    }
}

// Global Rooms
const rooms = {};
rooms['room1'] = new GameRoom('room1', 'room 1', null);
rooms['room2'] = new GameRoom('room2', 'room 2', null);

io.on('connection', (socket) => {
    let currentRoomId = null;

    socket.on('get_rooms', () => {
        let list = Object.values(rooms).map(r => ({
            id: r.id, name: r.name, count: Object.keys(r.players).length, max: r.maxPlayers
        }));
        socket.emit('room_list', list);
    });

    socket.on('create_room', (roomName) => {
        let id = 'room_' + Date.now();
        rooms[id] = new GameRoom(id, roomName || 'Custom Room', socket.id);
        socket.emit('create_room_success', id);
    });

    socket.on('join_room', (data) => {
        const { roomId, username, skin } = data;
        let room = rooms[roomId];
        if (room && room.addPlayer(socket, { username, skin })) {
            currentRoomId = roomId;
            socket.join(roomId);
            socket.emit('join_success', { roomId: roomId, map: room.map });
        } else {
            socket.emit('join_error', 'Phong day hoac khong ton tai!');
        }
    });

    socket.on('leave_room', () => {
        if (currentRoomId && rooms[currentRoomId]) {
            rooms[currentRoomId].removePlayer(socket.id);
            socket.leave(currentRoomId);
            currentRoomId = null;
        }
    });

    socket.on('disconnect', () => {
        if (currentRoomId && rooms[currentRoomId]) {
            rooms[currentRoomId].removePlayer(socket.id);
            if (Object.keys(rooms[currentRoomId].players).length === 0 && rooms[currentRoomId].id.startsWith('room_')) {
                delete rooms[currentRoomId];
            }
        }
    });

    socket.on('movement', (data) => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        let p = rooms[currentRoomId].players[socket.id];
        if (!p) return;
        let rotateSpeed = 0.08;
        if (data.left) p.angle -= rotateSpeed;
        if (data.right) p.angle += rotateSpeed;
        if (data.up) moveStep(p, p.speed, currentRoomId);
        if (data.down) moveStep(p, -p.speed, currentRoomId);
    });

    function moveStep(p, step, rid) {
        if (step === 0) return;
        let dx = Math.cos(p.angle) * step;
        let dy = Math.sin(p.angle) * step;
        if (!checkWallCollision(p.x + dx, p.y) && !rooms[rid].checkTankCollision(socket.id, p.x + dx, p.y)) p.x += dx;
        if (!checkWallCollision(p.x, p.y + dy) && !rooms[rid].checkTankCollision(socket.id, p.x, p.y + dy)) p.y += dy;
        p.lastActive = Date.now();
    }

    socket.on('shoot', () => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        let p = rooms[currentRoomId].players[socket.id];
        if (!p) return;
        let now = Date.now();
        if (now - p.lastShotTime < p.reloadTime) return;
        p.lastShotTime = now;
        rooms[currentRoomId].bullets.push({
            x: p.x + Math.cos(p.angle) * 35, y: p.y + Math.sin(p.angle) * 35,
            speedX: Math.cos(p.angle) * 15, speedY: Math.sin(p.angle) * 15,
            damage: p.damage, ownerId: socket.id
        });
    });

    socket.on('ping_check', (cb) => { if (typeof cb === 'function') cb(); });
});



// --- GAME LOOP (24 FPS) ---
setInterval(() => {
    try {
        let now = Date.now();
        for (let roomId in rooms) {
            let roomState = rooms[roomId].update();
            io.to(roomId).emit('state', {
                players: roomState.players,
                bullets: roomState.bullets,
                shield: roomState.shield,
                serverTime: now
            });
        }
    } catch (e) { console.error("Game Loop Error:", e); }
}, 1000 / 24);

// --- CLEANING PROCESS (Background Task) ---
function startCleanupProcess() {
    setInterval(() => {
        const now = Date.now();
        const AFK_TIMEOUT = 5 * 60 * 1000;

        for (let roomId in rooms) {
            let r = rooms[roomId];
            // AFK Kick
            for (let pid in r.players) {
                if (now - r.players[pid].lastActive > AFK_TIMEOUT) {
                    if (io.sockets.sockets.get(pid)) io.sockets.sockets.get(pid).disconnect(true);
                    r.removePlayer(pid);
                }
            }
            // Delete Empty Custom Rooms
            if (Object.keys(r.players).length === 0 && roomId.startsWith('room_')) {
                console.log(`[CLEANUP] Deleting empty room: ${r.name}`);
                delete rooms[roomId];
            }
        }
    }, 60000);
    console.log("🧹 [Game] Cleaning Process started...");
}
startCleanupProcess();
