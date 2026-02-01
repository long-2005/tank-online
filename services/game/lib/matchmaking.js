// ===========================================
// REDIS MATCHMAKING QUEUE - Helper Functions
// ===========================================
//
// Redis LIST làm FIFO queue:
// - RPUSH: Thêm vào cuối queue (enqueue)
// - LPOP: Lấy từ đầu queue (dequeue)
// - LLEN: Đếm số phần tử trong queue
// - LRANGE: Xem tất cả items (dùng để remove specific player)
//
// Key structure: "tank:queue:matchmaking"

const redisClient = require('./redis');

const QUEUE_KEY = 'tank:queue:matchmaking';

// ===========================================
// 1. THÊM PLAYER VÀO QUEUE
// ===========================================
async function addToQueue(playerData) {
    try {
        // Convert object → JSON string (Redis chỉ lưu string)
        const playerStr = JSON.stringify({
            socketId: playerData.socketId,
            username: playerData.username,
            skin: playerData.skin,
            timestamp: Date.now()  // Track khi nào join queue
        });

        // Push vào cuối queue (RPUSH)
        await redisClient.rPush(QUEUE_KEY, playerStr);

        const size = await getQueueSize();
        console.log(` [QUEUE] ${playerData.username} joined queue (size: ${size})`);

        return true;
    } catch (err) {
        console.error(' [QUEUE] Failed to add player:', err);
        return false;
    }
}

// ===========================================
// 2. LẤY N PLAYERS TỪ QUEUE
// ===========================================
// Dùng để match players (ví dụ: lấy 2 players cho 1v1)
async function getPlayersFromQueue(count = 2) {
    try {
        const players = [];

        // Pop từ đầu queue (LPOP) count lần
        for (let i = 0; i < count; i++) {
            const playerStr = await redisClient.lPop(QUEUE_KEY);
            if (!playerStr) break; // Queue empty

            players.push(JSON.parse(playerStr));
        }

        if (players.length > 0) {
            console.log(` [QUEUE] Matched ${players.length} players`);
        }

        return players;
    } catch (err) {
        console.error(' [QUEUE] Failed to get players:', err);
        return [];
    }
}

// ===========================================
// 3. ĐẾM SỐ NGƯỜI TRONG QUEUE
// ===========================================
async function getQueueSize() {
    try {
        return await redisClient.lLen(QUEUE_KEY);
    } catch (err) {
        console.error(' [QUEUE] Failed to get size:', err);
        return 0;
    }
}

// ===========================================
// 4. XÓA PLAYER KHI DISCONNECT
// ===========================================
// Tìm và xóa player theo socketId
async function removeFromQueue(socketId) {
    try {
        // Lấy tất cả players trong queue
        const queueData = await redisClient.lRange(QUEUE_KEY, 0, -1);

        // Tìm player cần xóa
        for (let i = 0; i < queueData.length; i++) {
            const player = JSON.parse(queueData[i]);

            if (player.socketId === socketId) {
                // LREM: Remove 1 occurrence của exact string
                await redisClient.lRem(QUEUE_KEY, 1, queueData[i]);

                console.log(`[QUEUE] Removed ${player.username} from queue`);
                return true;
            }
        }

        return false;
    } catch (err) {
        console.error(' [QUEUE] Failed to remove player:', err);
        return false;
    }
}

// ===========================================
// 5. CLEAR TOÀN BỘ QUEUE (Admin/Debug)
// ===========================================
async function clearQueue() {
    try {
        await redisClient.del(QUEUE_KEY);
        console.log('  [QUEUE] Queue cleared');
        return true;
    } catch (err) {
        console.error(' [QUEUE] Failed to clear:', err);
        return false;
    }
}

// ===========================================
// 6. XEM NGƯỜI ĐẦU TIÊN TRONG QUEUE (PEEK)
// ===========================================
// Dùng để check timeout (xem người đợi lâu nhất đã đợi bao lâu)
async function peekQueue() {
    try {
        const playerStr = await redisClient.lIndex(QUEUE_KEY, 0); // LIndex 0 = Head
        if (!playerStr) return null;
        return JSON.parse(playerStr);
    } catch (err) {
        console.error(' [QUEUE] Failed to peek:', err);
        return null;
    }
}

// Export các functions
module.exports = {
    addToQueue,
    getPlayersFromQueue,
    getQueueSize,
    removeFromQueue,
    clearQueue,
    peekQueue
};
