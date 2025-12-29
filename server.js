const express = require('express');
const http = require('http');
const path = require('path');
const socketIO = require('socket.io');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// --- KẾT NỐI DATABASE (MONGODB) ---
const MONGO_URI = "mongodb+srv://concathu119_db_user:TnfICaLIi059MGlR@long.1vyupsh.mongodb.net/?appName=long";
let useDB = false;

mongoose.connect(process.env.MONGO_URI || MONGO_URI)
  .then(() => { console.log(" Đã kết nối MongoDB!"); useDB = true; })
  .catch(err => console.log(" Không kết nối được DB, dùng RAM tạm thời."));

// Schema người dùng (Chương 7: Sao lưu)
const UserSchema = new mongoose.Schema({
  username: String,
  password: { type: String, required: true }, // Thêm password
  money: { type: Number, default: 0 },
  skins: { type: [String], default: ['tank'] },
  currentSkin: { type: String, default: 'tank' }
});
const UserModel = mongoose.model('User', UserSchema);

app.set('port', 5000);
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// --- CẤU HÌNH MAP  ---
const TILE_SIZE = 20; const COLS = 40; const ROWS = 30;
// BẢN ĐỒ CỐ ĐỊNH (FIXED MAP)
const MAP = [];
for (let r = 0; r < ROWS; r++) {
  let row = [];
  for (let c = 0; c < COLS; c++) {
    if (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1) row.push(1);
    else if (r % 6 === 0 && c % 6 === 0) row.push(1);
    else if (r % 6 === 0 && (c - 1) % 6 === 0) row.push(1);
    else if ((r - 1) % 6 === 0 && c % 6 === 0) row.push(1);
    else if ((r - 1) % 6 === 0 && (c - 1) % 6 === 0) row.push(1);
    else row.push(0);
  }
  MAP.push(row);
}
// Clean Zone
const clearZone = (r1, c1, r2, c2) => {
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      if (r > 0 && r < ROWS - 1 && c > 0 && c < COLS - 1) MAP[r][c] = 0;
    }
  }
};
clearZone(1, 1, 5, 5); clearZone(1, 34, 5, 38); clearZone(24, 1, 28, 5); clearZone(24, 34, 28, 38); clearZone(12, 17, 17, 22);

function checkWallCollision(x, y) {
  const RADIUS = 22;
  const minGridX = Math.floor((x - RADIUS) / TILE_SIZE);
  const maxGridX = Math.floor((x + RADIUS) / TILE_SIZE);
  const minGridY = Math.floor((y - RADIUS) / TILE_SIZE);
  const maxGridY = Math.floor((y + RADIUS) / TILE_SIZE);
  for (let r = minGridY; r <= maxGridY; r++) {
    for (let c = minGridX; c <= maxGridX; c++) {
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return true;
      if (MAP[r][c] === 1) return true;
    }
  }
  return false;
}

function checkTankCollision(id, x, y) {
  const TANK_RADIUS = 22; const MIN_DIST = TANK_RADIUS * 2;
  for (let otherId in players) {
    if (otherId === id) continue;
    let other = players[otherId];
    if (Math.sqrt((x - other.x) ** 2 + (y - other.y) ** 2) < MIN_DIST) return true;
  }
  return false;
}

const TANK_CONFIG = {
  'tank': { name: "M4 Sherman", price: 0, speed: 3, hp: 100, damage: 10, recoil: 5, reloadTime: 500 },
  'tank1': { name: "T-34 Legend", price: 100, speed: 3.5, hp: 110, damage: 12, recoil: 5, reloadTime: 450 },
  'tank2': { name: "M18 Hellcat", price: 300, speed: 5.5, hp: 70, damage: 8, recoil: 3, reloadTime: 150 },
  'tank3': { name: "Tiger I", price: 600, speed: 2, hp: 200, damage: 20, recoil: 2, reloadTime: 900 },
  'tank4': { name: "IS-2 Soviet", price: 1200, speed: 3.5, hp: 100, damage: 45, recoil: 45, reloadTime: 1800 },
  'tank5': { name: "Maus Tank", price: 2500, speed: 3, hp: 300, damage: 35, recoil: 10, reloadTime: 700 }
};

let usersDatabase = {}; // RAM Database (Fallback)
let players = {};
let bullets = [];

// --- DATABASE HELPER FUNCTIONS ---
async function findUser(username) {
  if (useDB) return await UserModel.findOne({ username });
  return usersDatabase[username];
}

async function createUser(username, password) {
  if (useDB) {
    const newUser = new UserModel({ username, password });
    return await newUser.save();
  } else {
    const newUser = { username, password, money: 0, skins: ['tank'], currentSkin: 'tank' };
    usersDatabase[username] = newUser;
    return newUser;
  }
}

async function saveUser(user) {
  if (useDB) {
    if (user instanceof UserModel) await user.save(); // Mongoose save
  } else {
    usersDatabase[user.username] = user; // RAM save
  }
}

io.on('connection', (socket) => {
  let currentUser = null;
  let userData = null; // Lưu object user hiện tại

  // --- XỬ LÝ ĐĂNG KÝ ---
  socket.on('register', async (data) => {
    let { username, password } = data;
    if (!username || !password) return socket.emit('register_error', 'Thiếu thông tin!');

    let existing = await findUser(username);
    if (existing) {
      socket.emit('register_error', 'Tên đã tồn tại!');
    } else {
      await createUser(username, password);
      socket.emit('register_success', 'Tạo tài khoản thành công! Hãy đăng nhập.');
    }
  });

  // --- XỬ LÝ ĐĂNG NHẬP ---
  socket.on('login', async (data) => {
    let { username, password } = data;
    let user = await findUser(username);

    if (!user) return socket.emit('login_error', 'Tài khoản không tồn tại!');
    if (user.password !== password) return socket.emit('login_error', 'Sai mật khẩu!');

    currentUser = username;
    userData = user;

    // Convert Mongoose doc to Object nếu cần
    let clientData = useDB ? userData.toObject() : userData;
    // Xóa password trước khi gửi về client bảo mật
    delete clientData.password;

    socket.emit('login_success', {
      user: clientData,
      config: TANK_CONFIG,
      map: MAP,
      tileSize: TILE_SIZE
    });
  });

  socket.on('buy_skin', async (skinName) => {
    if (!userData) return;
    let info = TANK_CONFIG[skinName];
    if (info && userData.money >= info.price && !userData.skins.includes(skinName)) {
      userData.money -= info.price;
      userData.skins.push(skinName);
      await saveUser(userData); // Lưu lại
      socket.emit('update_user_data', useDB ? userData.toObject() : userData);
    }
  });

  socket.on('select_skin', async (skinName) => {
    if (!userData) return;
    if (userData.skins.includes(skinName)) {
      userData.currentSkin = skinName;
      await saveUser(userData); // Lưu lại
      socket.emit('update_user_data', useDB ? userData.toObject() : userData);
    }
  });

  socket.on('join_game', () => {
    if (!userData) return;
    let skin = userData.currentSkin;
    let stats = TANK_CONFIG[skin];
    // Respawn logic ...
    let spawnX, spawnY, attempts = 0;
    do { spawnX = Math.random() * 700 + 50; spawnY = Math.random() * 500 + 50; attempts++; }
    while ((checkWallCollision(spawnX, spawnY) || checkTankCollision(socket.id, spawnX, spawnY)) && attempts < 200);

    players[socket.id] = {
      username: currentUser,
      x: spawnX, y: spawnY, angle: 0, skin: skin,
      hp: stats.hp, maxHp: stats.hp, speed: stats.speed, damage: stats.damage,
      recoil: stats.recoil, reloadTime: stats.reloadTime, lastShotTime: 0
    };
  });

  socket.on('leave_game', () => { delete players[socket.id]; });

  socket.on('movement', (data) => {
    let p = players[socket.id];
    if (!p) return;
    let rotateSpeed = 0.08;
    if (data.left) p.angle -= rotateSpeed;
    if (data.right) p.angle += rotateSpeed;
    let moveStep = 0;
    if (data.up) moveStep = p.speed;
    if (data.down) moveStep = -p.speed;

    if (moveStep !== 0) {
      let dx = Math.cos(p.angle) * moveStep;
      let dy = Math.sin(p.angle) * moveStep;
      if (!checkWallCollision(p.x + dx, p.y) && !checkTankCollision(socket.id, p.x + dx, p.y)) p.x += dx;
      if (!checkWallCollision(p.x, p.y + dy) && !checkTankCollision(socket.id, p.x, p.y + dy)) p.y += dy;
    }
  });

  socket.on('shoot', () => {
    let p = players[socket.id];
    if (!p) return;
    let now = Date.now();
    if (now - p.lastShotTime < p.reloadTime) return;
    p.lastShotTime = now;
    bullets.push({
      x: p.x + Math.cos(p.angle) * 35, y: p.y + Math.sin(p.angle) * 35,
      speedX: Math.cos(p.angle) * 15, speedY: Math.sin(p.angle) * 15,
      damage: p.damage, ownerId: socket.id
    });
    let recoilX = p.x - Math.cos(p.angle) * p.recoil;
    let recoilY = p.y - Math.sin(p.angle) * p.recoil;
    if (!checkWallCollision(recoilX, recoilY) && !checkTankCollision(socket.id, recoilX, recoilY)) {
      p.x = recoilX; p.y = recoilY;
    }
  });

  socket.on('disconnect', () => delete players[socket.id]);
});

setInterval(async () => {
  for (let i = 0; i < bullets.length; i++) {
    bullets[i].x += bullets[i].speedX; bullets[i].y += bullets[i].speedY;
    let gridX = Math.floor(bullets[i].x / TILE_SIZE);
    let gridY = Math.floor(bullets[i].y / TILE_SIZE);
    if (gridY < 0 || gridY >= ROWS || gridX < 0 || gridX >= COLS || MAP[gridY][gridX] === 1) {
      bullets.splice(i, 1); i--; continue;
    }
    let hit = false;
    for (let id in players) {
      if (id === bullets[i].ownerId) continue;
      let p = players[id];
      if (Math.sqrt((bullets[i].x - p.x) ** 2 + (bullets[i].y - p.y) ** 2) < 25) {
        p.hp -= bullets[i].damage; hit = true;
        if (p.hp <= 0) {
          // Xử lý cộng tiền khi kill
          let killerSocketId = bullets[i].ownerId;
          let killerName = players[killerSocketId]?.username;
          if (killerName) {
            // Chúng ta cần lấy user từ DB để cộng tiền an toàn
            let killerUser = await findUser(killerName);
            if (killerUser) {
              killerUser.money += 100;
              await saveUser(killerUser);
              io.to(killerSocketId).emit('update_user_data', useDB ? killerUser.toObject() : killerUser);
            }
          }
          // Respawn
          let attempts = 0;
          do { p.x = Math.random() * 700 + 50; p.y = Math.random() * 500 + 50; attempts++; }
          while ((checkWallCollision(p.x, p.y) || checkTankCollision(id, p.x, p.y)) && attempts < 200);
          p.hp = TANK_CONFIG[p.skin].hp;
        }
        break;
      }
    }
    if (bullets[i].x < 0 || bullets[i].x > 800 || bullets[i].y < 0 || bullets[i].y > 600 || hit) {
      bullets.splice(i, 1); i--;
    }
  }
  io.sockets.emit('state', { players, bullets, serverTime: Date.now() });
}, 1000 / 60);

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => console.log(`Server Tank War running on port ${PORT}...`));