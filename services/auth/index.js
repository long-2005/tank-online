const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files

// --- KẾT NỐI DATABASE (MONGODB) ---
const MONGO_URI = process.env.MONGO_URI || process.env.Mongo_url || "mongodb+srv://concathu119_db_user:TnfICaLIi059MGlR@long.1vyupsh.mongodb.net/?appName=long";
let useDB = false;

mongoose.connect(MONGO_URI)
    .then(() => { console.log("✅ [Auth] Connected to MongoDB"); useDB = true; })
    .catch(err => console.log("❌ [Auth] DB Error:", err));

// --- USER MODEL ---
const UserSchema = new mongoose.Schema({
    username: String,
    password: { type: String, required: true },
    money: { type: Number, default: 0 },
    skins: { type: [String], default: ['tank'] },
    currentSkin: { type: String, default: 'tank' }
});
const UserModel = mongoose.model('User', UserSchema);

// --- STATIC ASSETS (Frontend) ---
// Auth service will serve the website files
app.use(express.static(path.join(__dirname, '../../public')));
// Note: We moved public folder inside auth service for simpler deployment

// --- DATABASE HELPERS ---
async function findUser(username) {
    if (useDB) return await UserModel.findOne({ username });
    return null;
}

// --- API ENDPOINTS ---

// 1. REGISTER
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing info' });

    try {
        let existing = await findUser(username);
        if (existing) return res.status(400).json({ error: 'Username exists' });

        const newUser = new UserModel({ username, password });
        await newUser.save();
        res.json({ message: 'Register success' });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// 2. LOGIN
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        let user = await findUser(username);
        if (!user) return res.status(400).json({ error: 'User not found' });
        if (user.password !== password) return res.status(400).json({ error: 'Wrong password' });

        // Return user data sans password
        let userData = user.toObject();
        delete userData.password;

        // Return TANK_CONFIG & MAP for client initialization
        // Note: Ideally Game Service provides this, but Auth can send static config.
        const TANK_CONFIG = {
            'tank': { name: "M4 Sherman", price: 0, speed: 3, hp: 100, damage: 10, recoil: 5, reloadTime: 500 },
            'tank1': { name: "T-34 Legend", price: 100, speed: 3.5, hp: 110, damage: 12, recoil: 5, reloadTime: 450 },
            'tank2': { name: "M18 Hellcat", price: 300, speed: 5.5, hp: 70, damage: 8, recoil: 3, reloadTime: 150 },
            'tank3': { name: "Tiger I", price: 600, speed: 2, hp: 200, damage: 20, recoil: 2, reloadTime: 900 },
            'tank4': { name: "IS-2 Soviet", price: 1200, speed: 3.5, hp: 100, damage: 45, recoil: 45, reloadTime: 1800 },
            'tank5': { name: "Maus Tank", price: 2500, speed: 3, hp: 300, damage: 35, recoil: 10, reloadTime: 700 }
        };

        // Docker environment: return empty to use same origin (nginx proxy)
        // Local development: return localhost:3000
        const urlToSend = process.env.GAME_SERVER_URL || "";
        console.log(`[AUTH] Sending gameServerUrl to client: ${urlToSend || '(same origin)'}`);

        res.json({
            user: userData,
            config: TANK_CONFIG,
            gameServerUrl: urlToSend
        });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// 3. SHOP (Buy Skin)
app.post('/api/shop/buy', async (req, res) => {
    const { username, skinName } = req.body;
    // Note: In a real app, use JWT. Here we trust username for simplicity as before.

    // Config duped for now
    const TANK_CONFIG = {
        'tank': { price: 0 }, 'tank1': { price: 100 }, 'tank2': { price: 300 },
        'tank3': { price: 600 }, 'tank4': { price: 1200 }, 'tank5': { price: 2500 }
    };

    try {
        let user = await findUser(username);
        if (!user) return res.status(404).json({ error: 'User not found' });

        let info = TANK_CONFIG[skinName];
        if (info && user.money >= info.price && !user.skins.includes(skinName)) {
            user.money -= info.price;
            user.skins.push(skinName);
            await user.save();

            let uObj = user.toObject(); delete uObj.password;
            res.json({ user: uObj });
        } else {
            res.status(400).json({ error: 'Cannot buy' });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 4. SHOP (Select Skin)
app.post('/api/shop/select', async (req, res) => {
    const { username, skinName } = req.body;
    try {
        let user = await findUser(username);
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (user.skins.includes(skinName)) {
            user.currentSkin = skinName;
            await user.save();
            let uObj = user.toObject(); delete uObj.password;
            res.json({ user: uObj });
        } else {
            res.status(400).json({ error: 'Skin not owned' });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 5. LEADERBOARD (Get Top Players)
app.get('/api/leaderboard', async (req, res) => {
    try {
        if (!useDB) {
            return res.status(503).json({ error: 'Database not ready' });
        }

        // Fetch top 10 users sorted by money (descending)
        const topUsers = await UserModel
            .find()
            .select('username money skins currentSkin -_id') // Exclude password and _id
            .sort({ money: -1 })
            .limit(10);

        res.json(topUsers);
    } catch (e) {
        console.error('[Leaderboard] Error:', e);
        res.status(500).json({ error: 'Failed to load leaderboard' });
    }
});

// Root: Serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../../index.html'));
    // Note: We need to ensure index.html can be found relative to here
});

// Health Check
app.get('/health', (req, res) => {
    res.json({
        status: 'UP',
        service: 'Auth Service',
        uptime: process.uptime()
    });
});

// Prometheus Metrics Endpoint
app.get('/metrics', async (req, res) => {
    const { register } = require('./lib/prometheus');
    try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
    } catch (err) {
        res.status(500).end(err);
    }
});

app.listen(PORT, () => {
    console.log(`[Auth Service] running on port ${PORT}`);
});
