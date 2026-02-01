// load-generator.js
// Script để giả lập nhiều players join matchmaking queue
// Usage: node load-generator.js [number_of_players]

const io = require('socket.io-client');

// Config
const NUM_FAKE_PLAYERS = parseInt(process.argv[2]) || 15;
const GAME_URL = 'http://localhost:6000'; // Direct connection to game service
const CONNECT_DELAY = 200; // ms giữa mỗi connection

console.log(`\n╗`);
console.log(`        TANK ONLINE - LOAD GENERATOR            `);
console.log(`╝\n`);

console.log(`  Configuration:`);
console.log(`   Target:         ${GAME_URL}`);
console.log(`   Fake Players:   ${NUM_FAKE_PLAYERS}`);
console.log(`   Connect Delay:  ${CONNECT_DELAY}ms\n`);

const sockets = [];
let connectedCount = 0;
let matchedCount = 0;

// Tạo fake players
async function createFakePlayers() {
    for (let i = 1; i <= NUM_FAKE_PLAYERS; i++) {
        await new Promise(resolve => setTimeout(resolve, CONNECT_DELAY));

        const socket = io(GAME_URL, {
            transports: ['websocket'],
            reconnection: false
        });

        const username = `TestPlayer${i}`;

        socket.on('connect', () => {
            connectedCount++;
            console.log(` [${connectedCount}/${NUM_FAKE_PLAYERS}] ${username} connected (${socket.id})`);

            // Join matchmaking queue
            socket.emit('join_matchmaking', {
                username: username,
                socketId: socket.id
            });
        });

        socket.on('match_found', (data) => {
            matchedCount++;
            console.log(` ${username} matched! Room: ${data.roomId} (${matchedCount} total matches)`);

            // Có thể join room hoặc để yên
            if (data.redirectUrl) {
                console.log(`   → Redirect to: ${data.redirectUrl}`);
            } else {
                // Join room locally
                socket.emit('claim_spot', { roomId: data.roomId });
            }
        });

        socket.on('join_success', (data) => {
            console.log(` ${username} joined game room: ${data.roomId}`);
        });

        socket.on('queue_update', (data) => {
            // Silent - quá nhiều updates
        });

        socket.on('disconnect', (reason) => {
            console.log(` ${username} disconnected: ${reason}`);
        });

        socket.on('connect_error', (error) => {
            console.error(`  ${username} connection error:`, error.message);
        });

        sockets.push(socket);
    }

    console.log(`\n All ${NUM_FAKE_PLAYERS} players spawned!\n`);
    showStatus();
}

function showStatus() {
    console.log(`\n Current Status:`);
    console.log(`   Connected: ${connectedCount}/${NUM_FAKE_PLAYERS}`);
    console.log(`   Matched:   ${matchedCount}`);
    console.log(`   In Queue:  ${connectedCount - matchedCount}`);
}

// Cleanup function
function cleanup() {
    console.log(`\n\n Cleaning up...`);
    sockets.forEach(socket => {
        try {
            socket.disconnect();
        } catch (e) {
            // Ignore
        }
    });
    console.log(` All connections closed.\n`);
    process.exit(0);
}

// Handle Ctrl+C
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Auto cleanup after 5 minutes
setTimeout(() => {
    console.log(`\n 5 minutes elapsed. Auto-cleanup...`);
    cleanup();
}, 300000);

// Status updates every 10 seconds
setInterval(() => {
    showStatus();
}, 10000);

// Start
console.log(` Starting load generation...\n`);
createFakePlayers().catch(error => {
    console.error(` Error:`, error);
    cleanup();
});

console.log(`\n Tips:`);
console.log(`   - Press Ctrl+C to stop`);
console.log(`   - Auto-cleanup after 5 minutes`);
console.log(`   - Watch autoscaler: node autoscaler.js`);
console.log(`   - Monitor status: node monitor-status.js --watch\n`);
