const GameRoom = require('../rooms/GameRoom');
const { QUEUE_NAME } = require('../config');
const redis = require('../../lib/redis');
const { MAX_PLAYERS, MIN_PLAYERS, MAP } = require('../config');
const { addLog } = require('../utils');
const matchmakingService = require('../services/matchmaking');
const { queueGauge, roomsGauge, playersGauge } = require('../../lib/prometheus');

// === MATCHMAKING STATE ===
let countdownTimer = null;
let countdownInterval = null; // FIX: Store interval reference
let lastQueueSize = 0;
const COUNTDOWN_DURATION = 10;

function startWorkers(io, rooms) {

    // 1. GAME UPDATE LOOP (24 FPS)
    setInterval(() => {
        try {
            roomsGauge.set(Object.keys(rooms).length);

            // Count total active players across all rooms
            let totalPlayers = 0;
            Object.values(rooms).forEach(room => {
                try {
                    totalPlayers += Object.keys(room.players).length;
                    room.update();
                    io.to(room.id).emit('state', {
                        players: room.players,
                        bullets: room.bullets,
                        serverTime: Date.now()
                    });
                } catch (roomErr) {
                    console.error(`[GAME LOOP] Error in Room ${room.id}:`, roomErr);
                }
            });

            // Update players metric
            playersGauge.set(totalPlayers);
        } catch (loopErr) {
            console.error("[GAME LOOP] Critical Error:", loopErr);
        }
    }, 1000 / 24);

    // 2. MATCHMAKING WORKER WITH COUNTDOWN (1s)
    setInterval(async () => {
        try {
            const allQueueJSON = await redis.lRange(QUEUE_NAME, 0, -1);
            // queueGauge set later after dedup

            if (allQueueJSON.length === 0) {
                // Clear countdown if queue empty
                if (countdownTimer) {
                    clearTimeout(countdownTimer);
                    countdownTimer = null;
                }
                if (countdownInterval) {
                    clearInterval(countdownInterval);
                    countdownInterval = null;
                }
                lastQueueSize = 0;
                return;
            }

            const allQueueRaw = allQueueJSON.map(str => {
                try { return JSON.parse(str); } catch (e) { return null; }
            }).filter(p => p !== null);

            // Deduplicate by username
            const allQueue = [];
            const seenUsers = new Set();
            for (const p of allQueueRaw) {
                if (!seenUsers.has(p.username)) {
                    seenUsers.add(p.username);
                    allQueue.push(p);
                }
            }

            const currentQueueSize = allQueue.length;

            // Update Metrics
            queueGauge.set(currentQueueSize);
            io.emit('queue_update', { count: currentQueueSize });
            console.log(`[WORKER] Queue Check: Raw=${allQueueJSON.length}, Dedup=${currentQueueSize}`);

            // === COUNTDOWN LOGIC ===
            if (currentQueueSize >= MIN_PLAYERS) {
                // Check if queue size changed (new player joined)
                if (currentQueueSize !== lastQueueSize) {
                    // Queue changed - reset countdown
                    if (countdownTimer) {
                        clearTimeout(countdownTimer);
                        countdownTimer = null;
                    }
                    if (countdownInterval) {
                        clearInterval(countdownInterval);
                        countdownInterval = null;
                    }

                    lastQueueSize = currentQueueSize;

                    addLog(`[MATCH] Countdown reset - ${currentQueueSize} players in queue`);

                    // Start countdown - ONLY emit to players in queue
                    let remaining = COUNTDOWN_DURATION;
                    allQueue.forEach(p => {
                        io.to(p.socketId).emit('matchmaking_status', {
                            status: 'countdown',
                            queueSize: currentQueueSize,
                            countdown: remaining
                        });
                    });

                    // FIX: Store interval so we can clear it
                    countdownInterval = setInterval(() => {
                        remaining--;
                        if (remaining >= 0) { // FIX: Only emit if positive
                            allQueue.forEach(p => {
                                io.to(p.socketId).emit('matchmaking_status', {
                                    status: 'countdown',
                                    queueSize: currentQueueSize,
                                    countdown: remaining
                                });
                            });
                        }
                    }, 1000);

                    // Timer to start match after 10s
                    countdownTimer = setTimeout(async () => {
                        if (countdownInterval) {
                            clearInterval(countdownInterval);
                            countdownInterval = null;
                        }
                        countdownTimer = null;
                        lastQueueSize = 0;

                        // Start match
                        await createMatch(io, rooms, allQueue);
                    }, COUNTDOWN_DURATION * 1000);
                }
            } else {
                // Not enough players
                if (countdownTimer) {
                    clearTimeout(countdownTimer);
                    countdownTimer = null;
                }
                if (countdownInterval) {
                    clearInterval(countdownInterval);
                    countdownInterval = null;
                }
                lastQueueSize = 0; // Reset to allow countdown restart when MIN_PLAYERS reached

                // ONLY emit to players in queue
                allQueue.forEach(p => {
                    io.to(p.socketId).emit('matchmaking_status', {
                        status: 'searching',
                        queueSize: currentQueueSize
                    });
                });
            }
        } catch (err) {
            console.error("[MATCHMAKING] Error:", err);
        }
    }, 1000);
}

// Helper: Create match
async function createMatch(io, rooms, allQueue) {
    let countToMatch = 0;
    if (allQueue.length >= MAX_PLAYERS) countToMatch = MAX_PLAYERS;
    else if (allQueue.length >= MIN_PLAYERS) countToMatch = allQueue.length;

    if (countToMatch > 0) {
        const matchPlayers = allQueue.slice(0, countToMatch);
        const rId = `BR_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

        rooms[rId] = new GameRoom(rId, "Battle Royale", matchPlayers.length, io);

        const publicUrl = process.env.PUBLIC_URL;
        let matchedCount = 0;

        for (const p of matchPlayers) {
            await matchmakingService.removeFromQueue(p.socketId);
            const localSocket = io.sockets.sockets.get(p.socketId);

            if (localSocket) {
                // LOCAL PLAYER
                addLog(`[MATCH] Local Player ${p.username} -> Room ${rId}`);
                rooms[rId].addPlayer(localSocket, p);
                localSocket.join(rId);
                localSocket.currentRoomId = rId;
                localSocket.emit('match_found', { roomId: rId, map: MAP });
                localSocket.emit('join_success', { roomId: rId, map: MAP });
                matchedCount++;
            } else {
                // REMOTE PLAYER
                if (!publicUrl) {
                    console.error("[MATCH] No PUBLIC_URL for redirect!");
                    continue;
                }

                addLog(`[MATCH] Remote Player ${p.username} -> Redirect to ${publicUrl}`);
                rooms[rId].addPlayer({ id: p.socketId }, p);

                io.to(p.socketId).emit('match_found', {
                    roomId: rId,
                    map: MAP,
                    redirectUrl: publicUrl
                });
                matchedCount++;
            }
        }

        if (matchedCount === 0) {
            delete rooms[rId];
        } else {
            addLog(`[MATCH] Created Room ${rId} with ${matchedCount} players`);
        }
    }
}

module.exports = startWorkers;
