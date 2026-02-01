const { checkWallCollision } = require('../utils');

const rooms = {}; // Shared rooms object managed by main index or passed around

module.exports = (io, socket, rooms) => {

    // --- MATCHMAKING ---
    const matchmakingService = require('../services/matchmaking');

    socket.on('join_matchmaking', async (data) => {
        await matchmakingService.addToQueue({
            socketId: socket.id,
            username: data.username,
            skin: data.skin
        });
        socket.emit('matchmaking_status', { status: 'searching' });
    });

    socket.on('leave_matchmaking', async () => {
        await matchmakingService.removeFromQueue(socket.id);
        console.log(`[MATCHMAKING] Player ${socket.id} left queue`);
    });

    // [ADDED] Claim Spot (For Redirect Reconnection)
    socket.on('claim_spot', (data) => {
        const roomId = data.roomId;
        if (!roomId || !rooms[roomId]) return;

        // Find player by username (since socket ID changed)
        // Or we should have passed the old socket ID?
        // Let's iterate players
        const room = rooms[roomId];
        let oldSocketId = null;
        for (const sid in room.players) {
            if (room.players[sid].username === data.username) {
                oldSocketId = sid;
                break;
            }
        }

        if (oldSocketId) {
            console.log(`[RECONNECT] Player ${data.username} rejoined with new socket ${socket.id}`);
            // Update player key
            const p = room.players[oldSocketId];
            delete room.players[oldSocketId];
            room.players[socket.id] = p;

            // Update socket in rooms?
            // room.addPlayer(socket, ...) was done.
            // We need to join socket room
            socket.join(roomId);
            socket.currentRoomId = roomId;

            socket.emit('join_success', { roomId: roomId, map: require('../config').MAP });
        }
    });

    // --- GAMEPLAY ---
    socket.on('movement', (data) => {
        const roomId = socket.currentRoomId;
        if (!roomId || !rooms[roomId]) return;

        const p = rooms[roomId].players[socket.id];
        if (!p || p.dead) return;

        // Rotation
        if (data.left) p.angle -= 0.08;
        if (data.right) p.angle += 0.08;

        // Movement
        const step = data.up ? p.speed : (data.down ? -p.speed : 0);
        if (step !== 0) {
            const nextX = p.x + Math.cos(p.angle) * step;
            const nextY = p.y + Math.sin(p.angle) * step;
            if (!checkWallCollision(nextX, nextY)) {
                p.x = nextX;
                p.y = nextY;
            }
        }
        p.lastActive = Date.now();
    });

    socket.on('shoot', () => {
        const roomId = socket.currentRoomId;
        if (!roomId || !rooms[roomId]) return;

        const p = rooms[roomId].players[socket.id];
        if (!p || p.dead) return;

        const now = Date.now();
        if (now - p.lastShotTime < p.reloadTime) return;

        p.lastShotTime = now;

        rooms[roomId].bullets.push({
            x: p.x + Math.cos(p.angle) * 30, y: p.y + Math.sin(p.angle) * 30,
            speedX: Math.cos(p.angle) * 12, speedY: Math.sin(p.angle) * 12,
            damage: p.damage,
            ownerId: socket.id,
            type: p.currentAmmoType
        });
    });

    // [TEMPORARILY DISABLED] Item functionality commented out to prevent crashes
    // TODO: Re-enable after debugging item system
    /*
    socket.on('use_item', (itemType) => {
        const roomId = socket.currentRoomId;
        if (!roomId || !rooms[roomId]) return;

        const p = rooms[roomId].players[socket.id];
        if (!p || p.dead || !p.items[itemType] || p.items[itemType] <= 0) return;

        if (itemType === 'healthKit' && p.hp < p.maxHp) {
            p.hp = Math.min(p.hp + 50, p.maxHp);
            p.items.healthKit--;
        } else if (itemType === 'smokeBomb') {
            rooms[roomId].smokeEffects.push({
                x: p.x, y: p.y,
                createdAt: Date.now(),
                duration: 8000
            });
            p.items.smokeBomb--;
        } else if (itemType === 'armorKit') {
            p.armor = Math.min(p.armor + 1, p.maxArmor);
            p.items.armorKit--;
        }
    });
    */

    socket.on('switch_ammo', () => {
        const roomId = socket.currentRoomId;
        if (!roomId || !rooms[roomId]) return;
        const p = rooms[roomId].players[socket.id];
        if (!p || p.dead) return;

        if (p.currentAmmoType === 'normal') p.currentAmmoType = 'explosive';
        else if (p.currentAmmoType === 'explosive') p.currentAmmoType = 'armorPiercing';
        else p.currentAmmoType = 'normal';
    });

    // --- LEAVE GAME (Voluntary Quit) ---
    socket.on('leave_game', async () => {
        // Remove from matchmaking queue
        await matchmakingService.removeFromQueue(socket.id);

        // Remove from active game room
        const rId = socket.currentRoomId;
        if (rId && rooms[rId]) {
            rooms[rId].removePlayer(socket.id);
            console.log(`[QUIT] Player ${socket.id} left room ${rId}`);

            if (rooms[rId].isEmpty()) {
                delete rooms[rId];
                console.log(`[ROOM] Room ${rId} deleted (empty after quit)`);
            }
        }

        // Clear room reference
        socket.currentRoomId = null;
    });

    // --- DISCONNECT ---
    socket.on('disconnect', async () => {
        // Remove from Queue if queued
        await matchmakingService.removeFromQueue(socket.id);

        // Remove from Room if playing
        const rId = socket.currentRoomId;
        if (rId && rooms[rId]) {
            rooms[rId].removePlayer(socket.id);
            if (rooms[rId].isEmpty()) {
                delete rooms[rId];
                // console.log(`Room ${rId} deleted (empty)`);
            }
        }
    });

    // Ping Check
    socket.on('ping_check', (cb) => {
        if (typeof cb === 'function') cb();
    });
};
