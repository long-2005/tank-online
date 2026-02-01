// ===========================================
// REDIS CLIENT - Shared state cho multi-node
// ===========================================
// 
// TẠI SAO CẦN REDIS?
// - Trước đây: Mỗi game node có queue riêng trong RAM
// - Vấn đề: Player ở node 1 không thấy player ở node 2
// - Giải pháp: Dùng Redis làm shared memory cho tất cả nodes
//
// CẤU TRÚC:
// - Redis List: FIFO queue cho matchmaking
// - Key naming: "tank:queue:matchmaking"
// - Auto-reconnect nếu connection bị mất

const redis = require('redis');

// Tạo Redis client với auto-reconnect
const client = redis.createClient({
    url: process.env.REDIS_URL || 'redis://redis:6379',
    socket: {
        reconnectStrategy: (retries) => {
            // Retry mỗi 1 giây, max 10 lần
            if (retries > 10) {
                console.error(' [Redis] Quá nhiều lần retry, bỏ cuộc');
                return new Error('Redis connection failed');
            }
            console.log(` [Redis] Retry lần ${retries}...`);
            return 1000; // 1 second
        }
    }
});

// === EVENT HANDLERS ===

// Khi connect thành công
client.on('connect', () => {
    console.log(' [Redis] Kết nối thành công tới Redis server');
});

// Khi có lỗi
client.on('error', (err) => {
    console.error(' [Redis] Lỗi:', err.message);
});

// Khi đang reconnect
client.on('reconnecting', () => {
    console.log(' [Redis] Đang reconnect...');
});

// Khi mất kết nối
client.on('end', () => {
    console.log(' [Redis] Connection đã đóng');
});

// === AUTO-CONNECT ===
// Connect ngay khi import module này
(async () => {
    try {
        await client.connect();
    } catch (err) {
        console.error(' [Redis] Không thể connect lúc khởi động:', err);
        // Không crash server, sẽ retry sau
    }
})();

module.exports = client;
