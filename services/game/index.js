const { Server } = require("socket.io");
const mongoose = require('mongoose');

const PORT = process.env.PORT || 6000;

// Socket.io Server (Standalone)
const io = new Server(PORT, {
    cors: {
        origin: "*", // Adjust in production
        methods: ["GET", "POST"]
    }
});

console.log(`🚀 [Game Service] Socket.io running on port ${PORT}`);

// --- DATABASE CONNECTION ---
// Needed to update money on kill
const MONGO_URI = process.env.MONGO_URI || process.env.Mongo_url || "mongodb+srv://concathu119_db_user:TnfICaLIi059MGlR@long.1vyupsh.mongodb.net/?appName=long";
let useDB = false;

mongoose.connect(MONGO_URI)
    .then(() => { console.log("✅ [Game] Connected to MongoDB"); useDB = true; })
    .catch(err => console.log("❌ [Game] DB Error:", err));

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

function checkTankCollision(id, x, y) {
    const TANK_RADIUS = 22; const MIN_DIST = TANK_RADIUS * 2;
    for (let otherId in players) {
        if (otherId === id) continue;
        let other = players[otherId];
        if (Math.sqrt((x - other.x) ** 2 + (y - other.y) ** 2) < MIN_DIST) return true;
    }
    return false;
}

// STATE
let players = {};
let bullets = [];

io.on('connection', (socket) => {
    // Note: In a real architecture, we would verify a JWT token here passed in handshake
    // For now, we trust the client 'join_game' event with their username/skin config

    socket.on('join_game', (data) => {
        // data = { username, skin } (Sent from client after HTTP Login)
        if (!data || !data.username) return;

        // Validate skin?
        let skinName = data.skin || 'tank';
        // (Optional: Could duplicate skin ownership check here by calling DB, but skipping for perf)

        let stats = TANK_CONFIG[skinName] || TANK_CONFIG['tank'];

        // Spawn Logic
        let spawnX, spawnY, attempts = 0;
        do { spawnX = Math.random() * 700 + 50; spawnY = Math.random() * 500 + 50; attempts++; }
        while ((checkWallCollision(spawnX, spawnY) || checkTankCollision(socket.id, spawnX, spawnY)) && attempts < 200);

        players[socket.id] = {
            username: data.username,
            x: spawnX, y: spawnY, angle: 0, skin: skinName,
            hp: stats.hp, maxHp: stats.hp, speed: stats.speed, damage: stats.damage,
            recoil: stats.recoil, reloadTime: stats.reloadTime, lastShotTime: 0
        };

        // Emit init config (Map/TileSize) just in case client needs it? 
        // Client already got it from Auth, but good to be safe.
    });

    socket.on('disconnect', () => delete players[socket.id]);

    socket.on('movement', (data) => {
        let p = players[socket.id];
        if (!p) return;
        let rotateSpeed = 0.08;
        if (data.left) p.angle -= rotateSpeed;
        if (data.right) p.angle += rotateSpeed;
        let moveStep = 0;
        if (data.up) moveStep = p.speed;
        if (data.down) moveStep = -p.speed;

        if (moveStep !== 0) {
            let dx = Math.cos(p.angle) * moveStep;
            let dy = Math.sin(p.angle) * moveStep;
            if (!checkWallCollision(p.x + dx, p.y) && !checkTankCollision(socket.id, p.x + dx, p.y)) p.x += dx;
            if (!checkWallCollision(p.x, p.y + dy) && !checkTankCollision(socket.id, p.x, p.y + dy)) p.y += dy;
        }
    });

    socket.on('shoot', () => {
        let p = players[socket.id];
        if (!p) return;
        let now = Date.now();
        if (now - p.lastShotTime < p.reloadTime) return;
        p.lastShotTime = now;
        bullets.push({
            x: p.x + Math.cos(p.angle) * 35, y: p.y + Math.sin(p.angle) * 35,
            speedX: Math.cos(p.angle) * 15, speedY: Math.sin(p.angle) * 15,
            damage: p.damage, ownerId: socket.id
        });
        let recoilX = p.x - Math.cos(p.angle) * p.recoil;
        let recoilY = p.y - Math.sin(p.angle) * p.recoil;
        if (!checkWallCollision(recoilX, recoilY) && !checkTankCollision(socket.id, recoilX, recoilY)) {
            p.x = recoilX; p.y = recoilY;
        }
    });
});

// GAME LOOP (24 FPS)
setInterval(async () => {
    for (let i = 0; i < bullets.length; i++) {
        bullets[i].x += bullets[i].speedX; bullets[i].y += bullets[i].speedY;
        let gridX = Math.floor(bullets[i].x / TILE_SIZE);
        let gridY = Math.floor(bullets[i].y / TILE_SIZE);
        if (gridY < 0 || gridY >= ROWS || gridX < 0 || gridX >= COLS || MAP[gridY][gridX] === 1) {
            bullets.splice(i, 1); i--; continue;
        }
        let hit = false;
        for (let id in players) {
            if (id === bullets[i].ownerId) continue;
            let p = players[id];
            if (Math.sqrt((bullets[i].x - p.x) ** 2 + (bullets[i].y - p.y) ** 2) < 25) {
                p.hp -= bullets[i].damage; hit = true;

                if (p.hp <= 0) {
                    // KILL!
                    let killerSocketId = bullets[i].ownerId;
                    let killerName = players[killerSocketId]?.username;

                    if (killerName) {
                        // Update Money in DB
                        await addMoney(killerName, 100);
                        // We can't easily notify Auth Service to update client UI via socket unless we used Redis.
                        // For now, client won't see money update instantly until they re-login or use Shop API.
                        // OR proper way: Game sends message to Auth? Or Game emits 'money_update' to client directly (but game service doesn't store money).
                        // Simpler: Game Service emits 'kill_reward' {amount: 100} to client, client UI updates (Optimistic).
                        if (io.sockets.sockets.get(killerSocketId)) {
                            io.to(killerSocketId).emit('kill_reward', 100);
                        }
                    }

                    // Respawn
                    let attempts = 0;
                    do { p.x = Math.random() * 700 + 50; p.y = Math.random() * 500 + 50; attempts++; }
                    while ((checkWallCollision(p.x, p.y) || checkTankCollision(id, p.x, p.y)) && attempts < 200);

                    // Get maxHp if possible (or default)
                    let stats = TANK_CONFIG[p.skin] || TANK_CONFIG['tank'];
                    p.hp = stats.hp;
                }
                break;
            }
        }
        if (bullets[i].x < 0 || bullets[i].x > 800 || bullets[i].y < 0 || bullets[i].y > 600 || hit) {
            bullets.splice(i, 1); i--;
        }
    }
    io.sockets.emit('state', { players, bullets, serverTime: Date.now() });
}, 1000 / 24);
