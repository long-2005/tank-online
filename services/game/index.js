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
        let activePlayers = 0;
        if (typeof rooms !== 'undefined') {
            for (let r in rooms) {
                if (rooms[r].players) activePlayers += Object.keys(rooms[r].players).length;
            }
        }

        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({
            status: 'UP',
            service: 'Game Service',
            uptime: process.uptime(),
            activePlayers: activePlayers,
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
    addLog(`Game Service started on port ${PORT}`);
    console.log(`[Game Service] HTTP & Socket.io running on port ${PORT}`);
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
    currentSkin: { type: String },
    isOnline: { type: Boolean, default: false },
    lastHeartbeat: { type: Date, default: Date.now },
    currentSessionId: { type: String, default: '' }
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
const TILE_SIZE = 20;
const COLS = 100;  // Battle Royale: Increased from 40
const ROWS = 75;   // Battle Royale: Increased from 30
const TANK_CONFIG = {
    'tank': { name: "M4 Sherman", price: 0, speed: 3, hp: 100, damage: 10, recoil: 5, reloadTime: 500 },
    'tank1': { name: "T-34 Legend", price: 100, speed: 3.5, hp: 110, damage: 12, recoil: 5, reloadTime: 450 },
    'tank2': { name: "M18 Hellcat", price: 300, speed: 5.5, hp: 70, damage: 8, recoil: 3, reloadTime: 150 },
    'tank3': { name: "Tiger I", price: 600, speed: 2, hp: 200, damage: 20, recoil: 2, reloadTime: 900 },
    'tank4': { name: "IS-2 Soviet", price: 1200, speed: 3.5, hp: 100, damage: 45, recoil: 45, reloadTime: 1800 },
    'tank5': { name: "Maus Tank", price: 2500, speed: 3, hp: 300, damage: 35, recoil: 10, reloadTime: 700 }
};

// MAP GENERATION (Battle Royale Larger Map)
const MAP = [];
for (let r = 0; r < ROWS; r++) {
    let row = [];
    for (let c = 0; c < COLS; c++) {
        // Border walls
        if (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1) row.push(1);
        // Internal obstacles (less dense for BR)
        else if (r % 8 === 0 && c % 8 === 0) row.push(1);
        else if (r % 8 === 0 && (c - 1) % 8 === 0) row.push(1);
        else if ((r - 1) % 8 === 0 && c % 8 === 0) row.push(1);
        else if ((r - 1) % 8 === 0 && (c - 1) % 8 === 0) row.push(1);
        else row.push(0);
    }
    MAP.push(row);
}

// Clear Spawn Zones (8 corners + center for BR)
const clearZone = (r1, c1, r2, c2) => {
    for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
            if (r > 0 && r < ROWS - 1 && c > 0 && c < COLS - 1) MAP[r][c] = 0;
        }
    }
};
// 8 Corner spawns + Center
clearZone(1, 1, 8, 8);           // Top-left
clearZone(1, 91, 8, 98);         // Top-right
clearZone(66, 1, 73, 8);         // Bottom-left
clearZone(66, 91, 73, 98);       // Bottom-right
clearZone(1, 45, 8, 54);         // Top-center
clearZone(66, 45, 73, 54);       // Bottom-center
clearZone(33, 1, 41, 8);         // Mid-left
clearZone(33, 91, 41, 98);       // Mid-right
clearZone(33, 45, 41, 54);       // Center


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

        // Battle Royale: Supply Crates instead of single shield
        this.supplyCrates = [];
        this.nextCrateSpawn = Date.now() + 30000; // 30s

        this.maxPlayers = 20; // Battle Royale: 4 -> 20 players
        this.map = MAP;
    }

    addPlayer(socket, userData) {
        if (Object.keys(this.players).length >= this.maxPlayers) return false;

        // Battle Royale: Larger spawn area
        let spawnX, spawnY, attempts = 0;
        do { spawnX = Math.random() * 1900 + 50; spawnY = Math.random() * 1400 + 50; attempts++; }
        while ((checkWallCollision(spawnX, spawnY) || this.checkTankCollision(socket.id, spawnX, spawnY)) && attempts < 200);

        let skin = (userData.skin) ? userData.skin : 'tank';
        let stats = TANK_CONFIG[skin] || TANK_CONFIG['tank'];

        this.players[socket.id] = {
            username: userData.username,
            x: spawnX, y: spawnY, angle: 0, skin: skin,
            hp: stats.hp, maxHp: stats.hp, speed: stats.speed, damage: stats.damage,
            recoil: stats.recoil, reloadTime: stats.reloadTime, lastShotTime: 0,
            lastActive: Date.now(),
            invincibleUntil: 0,

            // Battle Royale: Armor System
            armor: 0,
            maxArmor: 3,

            // Battle Royale: Ammo System
            ammo: {
                normal: 30,
                explosive: 5,
                armorPiercing: 10
            },
            currentAmmoType: 'normal'
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

        // Battle Royale: Supply Crate Spawning (TODO: implement spawn logic)
        // Placeholder for now

        // Bullets
        for (let i = 0; i < this.bullets.length; i++) {
            let b = this.bullets[i];
            b.x += b.speedX; b.y += b.speedY;
            let gridX = Math.floor(b.x / TILE_SIZE);
            let gridY = Math.floor(b.y / TILE_SIZE);

            // Wall collision
            if (gridY < 0 || gridY >= ROWS || gridX < 0 || gridX >= COLS || MAP[gridY][gridX] === 1) {
                // Explosive ammo: explode on wall hit
                if (b.type === 'explosive') {
                    this.handleExplosion(b.x, b.y, b.damage, b.ownerId, now);
                }
                this.bullets.splice(i, 1); i--; continue;
            }

            let hit = false;

            // Direct hit check
            for (let id in this.players) {
                if (id === b.ownerId) continue;
                let p = this.players[id];
                if (p.invincibleUntil && now < p.invincibleUntil) continue;

                if (Math.sqrt((b.x - p.x) ** 2 + (b.y - p.y) ** 2) < 25) {
                    // Battle Royale: Apply damage with armor system
                    this.applyDamage(p, b.damage, b.type, b.ownerId, now);

                    // Explosive: AOE damage
                    if (b.type === 'explosive') {
                        this.handleExplosion(b.x, b.y, b.damage, b.ownerId, now);
                    }

                    hit = true;
                    break;
                }
            }

            // Remove bullet if hit or out of bounds
            if (b.x < 0 || b.x > COLS * TILE_SIZE || b.y < 0 || b.y > ROWS * TILE_SIZE || hit) {
                this.bullets.splice(i, 1); i--;
            }
        }

        return {
            players: this.players,
            bullets: this.bullets,
            supplyCrates: this.supplyCrates
        };
    }

    // Battle Royale: Damage calculation with armor
    applyDamage(player, baseDamage, ammoType, attackerId, now) {
        let damage = baseDamage;

        // Armor-piercing bonus if target has armor
        if (ammoType === 'armorPiercing' && player.armor > 0) {
            damage *= 1.5;
        }

        // Armor absorbs hits
        if (player.armor > 0) {
            player.armor--;
            // Armor blocks damage completely (1 hit = 1 armor segment)
            return;
        }

        // No armor: damage HP
        player.hp -= damage;

        // Battle Royale: NO RESPAWN, player dies permanently
        if (player.hp <= 0) {
            player.hp = 0;
            player.dead = true;

            // Get killer info
            let killer = this.players[attackerId];
            let killerName = killer ? killer.username : 'Unknown';

            // Find victim's socket and notify
            for (let socketId in this.players) {
                if (this.players[socketId] === player) {
                    if (io.sockets.sockets.get(socketId)) {
                        io.to(socketId).emit('you_died', {
                            killerName: killerName,
                            rank: this.getAliveCount() // How many players left
                        });
                    }
                    break;
                }
            }

            // Reward killer
            if (io.sockets.sockets.get(attackerId)) {
                io.to(attackerId).emit('kill_reward', 100);
            }
        }
    }

    // Count alive players
    getAliveCount() {
        let count = 0;
        for (let id in this.players) {
            if (!this.players[id].dead) count++;
        }
        return count;
    }

    // Battle Royale: Explosive AOE damage
    handleExplosion(x, y, baseDamage, ownerId, now) {
        const RADIUS = 80;
        for (let id in this.players) {
            if (id === ownerId) continue;
            let p = this.players[id];
            if (p.invincibleUntil && now < p.invincibleUntil) continue;

            let dist = Math.sqrt((p.x - x) ** 2 + (p.y - y) ** 2);
            if (dist < RADIUS) {
                // Damage decreases with distance
                let damage = baseDamage * (1 - dist / RADIUS);
                this.applyDamage(p, damage, 'explosive', ownerId, now);
            }
        }
    }

    // Old shield spawn (removed for BR)
    spawnShield() {
        // Legacy code, not used in Battle Royale
    }
}

// Global Rooms
const rooms = {};
// Bỏ phòng mặc định (room1, room2) theo yêu cầu Matchmaking
// rooms['room1'] = new GameRoom('room1', 'room 1', null);
// rooms['room2'] = new GameRoom('room2', 'room 2', null);

// --- MATCHMAKING SYSTEM ---
let matchmakingQueue = [];

function checkMatchmakingQueue() {
    if (matchmakingQueue.length >= 2) {
        // Lấy tối đa 4 người
        let members = matchmakingQueue.splice(0, 4);

        let roomId = 'match_' + Date.now();
        let room = new GameRoom(roomId, 'Ranked Match', 'system');
        rooms[roomId] = room;

        console.log(`[MATCHMAKING] Created room ${roomId} with ${members.length} players.`);

        members.forEach(m => {
            // Add player to room logic
            let socket = io.sockets.sockets.get(m.socketId);
            if (socket) {
                // Tự động join room
                if (room.addPlayer(socket, m.userData)) {
                    socket.join(roomId);
                    socket.emit('match_found', { roomId: roomId, map: room.map });
                }
            }
        });
    }
}
setInterval(checkMatchmakingQueue, 3000); // Check every 3 seconds

io.on('connection', (socket) => {
    let currentRoomId = null;

    socket.on('get_rooms', () => {
        // Chỉ trả về custom rooms hoặc rank mode status (optional)
        let list = Object.values(rooms)
            .filter(r => r.id.startsWith('room_')) // Chỉ hiện phòng Custom
            .map(r => ({
                id: r.id, name: r.name, count: Object.keys(r.players).length, max: r.maxPlayers
            }));
        socket.emit('room_list', list);
    });

    socket.on('join_matchmaking', (userData) => {
        // Check if already in queue
        if (matchmakingQueue.find(m => m.socketId === socket.id)) return;

        matchmakingQueue.push({ socketId: socket.id, userData });
        socket.emit('matchmaking_update', { count: matchmakingQueue.length });
        // Notify others? Maybe not necessary for simple logic, but good for UX
    });

    socket.on('leave_matchmaking', () => {
        matchmakingQueue = matchmakingQueue.filter(m => m.socketId !== socket.id);
    });

    socket.on('create_room', (roomName) => {
        let id = 'room_' + Date.now();
        rooms[id] = new GameRoom(id, roomName || 'Custom Room', socket.id);
        socket.emit('create_room_success', id);
    });

    socket.on('join_room', async (data) => {
        const { roomId, username, skin } = data;

        // SINGLE SESSION CHECK (KICK STRATEGY)
        if (useDB) {
            try {
                // Kick Old Session Logic:
                // Just overwrite the session ID in DB. The old session will detect this via Heartbeat and disconnect itself.
                await UserModel.updateOne(
                    { username },
                    { isOnline: true, lastHeartbeat: Date.now(), currentSessionId: socket.id }
                );
            } catch (e) {
                console.error("Session update error:", e);
            }
        }

        let room = rooms[roomId];
        if (room && room.addPlayer(socket, { username, skin })) {
            currentRoomId = roomId;
            socket.join(roomId);
            socket.emit('join_success', { roomId: roomId, map: room.map });
        } else {
            socket.emit('join_error', 'Phòng đầy hoặc không tồn tại!');
        }
    });

    socket.on('leave_room', () => {
        if (currentRoomId && rooms[currentRoomId]) {
            rooms[currentRoomId].removePlayer(socket.id);
            socket.leave(currentRoomId);
            currentRoomId = null;
        }
    });

    socket.on('disconnect', async () => {
        if (currentRoomId && rooms[currentRoomId]) {
            const p = rooms[currentRoomId].players[socket.id];
            if (p && useDB) {
                try {
                    // Only mark offline if I AM the current session
                    await UserModel.updateOne(
                        { username: p.username, currentSessionId: socket.id },
                        { isOnline: false }
                    );
                } catch (e) { console.error("Disconnect update error", e); }
            }

            rooms[currentRoomId].removePlayer(socket.id);
            if (Object.keys(rooms[currentRoomId].players).length === 0 && (rooms[currentRoomId].id.startsWith('room_') || rooms[currentRoomId].id.startsWith('match_'))) {
                delete rooms[currentRoomId];
            }
        }
        // Remove from Queue if disconnecting
        matchmakingQueue = matchmakingQueue.filter(m => m.socketId !== socket.id);
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

        // Battle Royale: Check ammo
        let ammoType = p.currentAmmoType;
        if (p.ammo[ammoType] <= 0) return; // No ammo!

        p.lastShotTime = now;
        p.ammo[ammoType]--; // Consume ammo

        rooms[currentRoomId].bullets.push({
            x: p.x + Math.cos(p.angle) * 35, y: p.y + Math.sin(p.angle) * 35,
            speedX: Math.cos(p.angle) * 15, speedY: Math.sin(p.angle) * 15,
            damage: p.damage,
            ownerId: socket.id,
            type: ammoType, // Battle Royale: Bullet type
            explosionRadius: ammoType === 'explosive' ? 80 : 0
        });
    });

    // Battle Royale: Switch Ammo Type (Q key)
    socket.on('switch_ammo', () => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        let p = rooms[currentRoomId].players[socket.id];
        if (!p) return;

        // Cycle: normal -> explosive -> armorPiercing -> normal
        if (p.currentAmmoType === 'normal') p.currentAmmoType = 'explosive';
        else if (p.currentAmmoType === 'explosive') p.currentAmmoType = 'armorPiercing';
        else p.currentAmmoType = 'normal';

        socket.emit('ammo_switched', p.currentAmmoType);
    });

    socket.on('ping_check', async (cb) => {
        if (typeof cb === 'function') cb();

        // Update Heartbeat
        if (useDB && currentRoomId && rooms[currentRoomId] && rooms[currentRoomId].players[socket.id]) {
            const p = rooms[currentRoomId].players[socket.id];
            try {
                // Conditional Update: Only update if currentSessionId matches my socket.id
                const res = await UserModel.updateOne(
                    { username: p.username, currentSessionId: socket.id },
                    { lastHeartbeat: Date.now() }
                );

                // If matchedCount is 0, it means session ID has changed (someone else logged in)
                if (res.matchedCount === 0) {
                    socket.emit('force_disconnect', 'Tài khoản của bạn đã được đăng nhập ở nơi khác!');
                    socket.disconnect();
                }
            } catch (e) { }
        }
    });
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
