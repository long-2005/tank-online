const os = require('os');

// System Config
const PORT = process.env.PORT || 3000;
const SERVICE_ID = process.env.SERVICE_ID || `SRV_${os.hostname()}_${Math.floor(Math.random() * 1000)}`;
const MONGO_URI = process.env.MONGO_URI || process.env.Mongo_url || "mongodb+srv://concathu119_db_user:TnfICaLIi059MGlR@long.1vyupsh.mongodb.net/?appName=long";
const REDIS_URL = process.env.REDIS_URL || "redis://tank-redis:6379";
const QUEUE_NAME = "tank:queue:matchmaking";

// Game Constants
const TILE_SIZE = 20;
const COLS = 100;
const ROWS = 75;
const MAX_PLAYERS = 10;
const MIN_PLAYERS = 2; // Minimum 2 players required to start a match

// Tank Stats
const TANK_CONFIG = {
    'tank': { speed: 3, hp: 100, damage: 10, reloadTime: 500 },
    'tank5': { speed: 3, hp: 300, damage: 35, reloadTime: 700 }
};

// Map Generation (Walls at borders)
const MAP = Array.from({ length: ROWS }, (_, r) =>
    Array.from({ length: COLS }, (_, c) => (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1 ? 1 : 0))
);

module.exports = {
    PORT, SERVICE_ID, MONGO_URI, REDIS_URL, QUEUE_NAME,
    TILE_SIZE, COLS, ROWS, MAX_PLAYERS, MIN_PLAYERS,
    TANK_CONFIG, MAP
};
