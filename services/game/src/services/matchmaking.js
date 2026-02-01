const redis = require('../../lib/redis'); // Use existing lib/redis
const { QUEUE_NAME } = require('../config');

// Wrapper for Redis Queue Operations
async function addToQueue(data) {
    try {
        await redis.rPush(QUEUE_NAME, JSON.stringify(data));
    } catch (e) { console.error("Redis Error:", e); }
}

async function getQueueSize() {
    try {
        return await redis.lLen(QUEUE_NAME);
    } catch (e) { return 0; }
}

async function getPlayersFromQueue(n) {
    const players = [];
    try {
        for (let i = 0; i < n; i++) {
            const p = await redis.lPop(QUEUE_NAME);
            if (p) players.push(JSON.parse(p));
        }
    } catch (e) { console.error("Redis Error:", e); }
    return players;
}

async function removeFromQueue(socketId) {
    try {
        // Warning: This operation is O(N) and can be slow for large queues
        const all = await redis.lRange(QUEUE_NAME, 0, -1);
        for (const item of all) {
            if (JSON.parse(item).socketId === socketId) {
                await redis.lRem(QUEUE_NAME, 1, item);
            }
        }
    } catch (e) { console.error("Redis Error:", e); }
}

module.exports = {
    addToQueue,
    getQueueSize,
    getPlayersFromQueue,
    removeFromQueue
};
