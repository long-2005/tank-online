console.log("[SYSTEM] STARTING GAME SERVICE...");
const { Server } = require("socket.io");
const http = require('http');
const mongoose = require('mongoose');

// Imports
const Config = require('./src/config');
const { addLog, getLogs } = require('./src/utils');
const registerSocketHandlers = require('./src/handlers/socketHandler');
const startWorkers = require('./src/workers');
const { register } = require('./lib/prometheus'); // Import Prometheus register

// Note: Redis client is initialized in lib/redis.js and imported in services

// --- SERVER SETUP ---
const httpServer = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');

    // API Endpoints
    if (req.url === '/health') {
        let activePlayers = 0;
        Object.values(rooms).forEach(r => activePlayers += Object.keys(r.players).length);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
            status: 'UP',
            id: Config.SERVICE_ID,
            activePlayers,
            rooms: Object.keys(rooms).length
        }));
    }

    if (req.url === '/api/logs') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(getLogs()));
    }

    // Prometheus Metrics
    if (req.url === '/metrics') {
        try {
            res.writeHead(200, { 'Content-Type': register.contentType });
            return res.end(await register.metrics());
        } catch (e) {
            res.writeHead(500);
            return res.end(e.message);
        }
    }

    res.writeHead(404);
    res.end();
});

// Socket.IO Server (create first)
const io = new Server(httpServer, { cors: { origin: "*", methods: ["GET", "POST"] } });

// [RESTORED] Redis Adapter for Global Scaling (setup after io is created)
const { createAdapter } = require("@socket.io/redis-adapter");
const { createClient } = require("redis");
const pubClient = createClient({ url: Config.REDIS_URL });
const subClient = pubClient.duplicate();

Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
    io.adapter(createAdapter(pubClient, subClient));
    addLog(`[SYSTEM] Redis Adapter Configured on Node ${Config.NODE_ID || '?'}`);
}).catch(err => {
    console.error("Redis connection error:", err);
});

// --- SHARED STATE ---
const rooms = {}; // In-memory rooms for this node

// --- DB CONNECTION ---
mongoose.connect(Config.MONGO_URI)
    .then(() => addLog("Connected to MongoDB"))
    .catch(err => addLog("DB Error: " + err.message));

// --- SOCKET CONFIG ---
io.on('connection', (socket) => {
    // Register handlers for this socket
    registerSocketHandlers(io, socket, rooms);

    addLog(`New connection: ${socket.id}`);
});

// --- START WORKERS ---
// Start Game Loop & Matchmaking
startWorkers(io, rooms);

// --- START SERVER ---
httpServer.listen(Config.PORT, () => {
    addLog(`[SERVER] Running on port ${Config.PORT}`);
    console.log(`Game Service started on port ${Config.PORT}`);
});
