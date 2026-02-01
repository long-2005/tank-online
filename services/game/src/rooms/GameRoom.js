const { TANK_CONFIG, COLS, ROWS, TILE_SIZE } = require('../config');
const { addLog, checkWallCollision } = require('../utils');

class GameRoom {
    constructor(id, name, maxPlayers, io) {
        this.id = id;
        this.name = name;
        this.players = {};
        this.bullets = [];
        this.smokeEffects = [];
        this.maxPlayers = maxPlayers;
        this.io = io; // Socket IO instance for events

        // Safe Zone Logic
        this.safeZone = { x: (COLS * TILE_SIZE) / 2, y: (ROWS * TILE_SIZE) / 2, radius: (COLS * TILE_SIZE) / 2 };

        addLog(`Created Room ${id} (${name}) for ${maxPlayers} players`);
    }

    addPlayer(socket, userData) {
        if (Object.keys(this.players).length >= this.maxPlayers) return false;

        const skin = userData.skin || 'tank';
        const stats = TANK_CONFIG[skin] || TANK_CONFIG['tank'];

        // Spawn Location Randomizer (Simple)
        const x = Math.random() * ((COLS - 4) * TILE_SIZE) + (2 * TILE_SIZE);
        const y = Math.random() * ((ROWS - 4) * TILE_SIZE) + (2 * TILE_SIZE);

        this.players[socket.id] = {
            username: userData.username,
            x: x, y: y, angle: 0,
            hp: stats.hp, maxHp: stats.hp,
            armor: 0, maxArmor: 3,
            speed: stats.speed,
            damage: stats.damage, reloadTime: stats.reloadTime, lastShotTime: 0,
            dead: false, lastActive: Date.now(),
            ammo: { normal: 30, explosive: 5, armorPiercing: 10 },
            items: { healthKit: 1, armorKit: 1, smokeBomb: 1 },
            currentAmmoType: 'normal'
        };
        return true;
    }

    removePlayer(socketId) {
        if (this.players[socketId]) {
            delete this.players[socketId];
            return true;
        }
        return false;
    }

    isEmpty() {
        return Object.keys(this.players).length === 0;
    }

    update() {
        const now = Date.now();

        // Update Smoke
        this.smokeEffects = this.smokeEffects.filter(s => now - s.createdAt < s.duration);

        // Update Bullets
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            let b = this.bullets[i];
            b.x += b.speedX; b.y += b.speedY;

            // Wall Collision
            if (checkWallCollision(b.x, b.y)) {
                this.bullets.splice(i, 1); continue;
            }

            // Out of bounds
            if (b.x < 0 || b.x > COLS * TILE_SIZE || b.y < 0 || b.y > ROWS * TILE_SIZE) {
                this.bullets.splice(i, 1); continue;
            }

            // Player Collision
            for (let id in this.players) {
                let p = this.players[id];
                if (id !== b.ownerId && !p.dead && Math.hypot(b.x - p.x, b.y - p.y) < 25) {
                    this.applyDamage(p, b.damage, b.type, b.ownerId);
                    this.bullets.splice(i, 1);
                    break; // One bullet hits one player
                }
            }
        }
    }

    applyDamage(p, dmg, type, attackerId) {
        if (p.armor > 0) p.armor--;
        else p.hp -= (type === 'armorPiercing' ? dmg * 1.5 : dmg);

        if (p.hp <= 0) {
            p.hp = 0; p.dead = true;
            // Notify death
            // Find socket ID of the dead player? We have it in 'p' parent loop or we can find key
            // Ideally we should pass socketId to this function or store it in player object
            // Workaround:
            const victimSocketId = Object.keys(this.players).find(key => this.players[key] === p);
            if (victimSocketId && this.io) {
                this.io.to(victimSocketId).emit('you_died', { killer: attackerId });
            }
        }
    }
}

module.exports = GameRoom;
