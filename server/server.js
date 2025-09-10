// Simple Monopoly Online Server (2-6 người)
// Chạy: node server/server.js
const express = require("express");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

// ====== BÀN CỜ / CƠ HỘI (đồng bộ với client để render) ======
const TILES = [
  { type: "start", name: "Xuất phát" },
  { type: "property", name: "Phố A", price: 120, rent: 35, color: "#ef4444" },
  { type: "chance", name: "Cơ hội" },
  { type: "property", name: "Phố B", price: 140, rent: 40, color: "#f97316" },
  { type: "tax", name: "Thuế $100", amount: 100 },
  { type: "property", name: "Phố C", price: 160, rent: 45, color: "#f59e0b" },
  { type: "chance", name: "Cơ hội" },
  { type: "property", name: "Phố D", price: 180, rent: 50, color: "#10b981" },
  { type: "jail", name: "Nhà tù (mất 1 lượt)" },
  { type: "property", name: "Phố E", price: 200, rent: 60, color: "#14b8a6" },
  { type: "chance", name: "Cơ hội" },
  { type: "property", name: "Phố F", price: 220, rent: 70, color: "#06b6d4" },
  { type: "tax", name: "Thuế $100", amount: 100 },
  { type: "property", name: "Phố G", price: 240, rent: 80, color: "#60a5fa" },
  { type: "chance", name: "Cơ hội" },
  { type: "property", name: "Phố H", price: 260, rent: 90, color: "#818cf8" },
  { type: "free", name: "Bãi đỗ miễn phí" },
  { type: "property", name: "Phố I", price: 280, rent: 100, color: "#a78bfa" },
  { type: "chance", name: "Cơ hội" },
  { type: "property", name: "Phố J", price: 300, rent: 110, color: "#f472b6" },
];

const CHANCE = [
  (s) => msg(s, "Nhận thưởng dự án +$200") || (s.players[s.turn].money += 200),
  (s) =>
    msg(s, "Đóng phạt giao thông -$150") || (s.players[s.turn].money -= 150),
  (s) => {
    msg(s, "Tiến lên 3 ô");
    moveBy(s, 3);
  },
  (s) => {
    msg(s, "Lùi 2 ô");
    moveBy(s, -2);
  },
  (s) => {
    msg(s, "Về Xuất phát và nhận +$200");
    goTo(s, 0, true);
  },
  (s) => {
    msg(s, "Vào Nhà tù (mất 1 lượt)");
    s.players[s.turn].pos = 8;
    s.players[s.turn].skip = 1;
  },
];

// ====== QUẢN LÝ PHÒNG ======
const rooms = new Map(); // roomId -> state
const MAX_PLAYERS = 6;

function makeRoomId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "";
  for (let i = 0; i < 4; i++)
    id += chars[Math.floor(Math.random() * chars.length)];
  return rooms.has(id) ? makeRoomId() : id;
}

function defaultPlayer(name, id) {
  return { id, name, pos: 0, money: 1500, skip: 0, bankrupt: false, owned: [] };
}

function defaultState() {
  return {
    tiles: TILES,
    players: [], // [{id,name,pos,money,skip,bankrupt,owned:[]}]
    owner: {}, // tileIdx -> playerId
    turn: 0, // chỉ số người chơi đang đi
    lastRoll: null,
    pendingBuy: null, // {tileIdx}
    laps: 0,
    log: [],
    started: false,
  };
}

function snapshot(state) {
  // gửi cho client
  return state;
}

function broadcast(roomId) {
  const s = rooms.get(roomId);
  io.to(roomId).emit("state", snapshot(s));
}

function say(s, text) {
  s.log.unshift(text);
  if (s.log.length > 200) s.log.pop();
}
const msg = say;

// ====== LUẬT ======
function moveBy(s, steps) {
  const N = s.tiles.length;
  const p = s.players[s.turn];
  let old = p.pos;
  let next = (old + steps) % N;
  if (next < 0) next += N;
  if (steps > 0 && old + steps >= N) {
    s.laps++;
    p.money += 200;
    say(s, `${p.name} qua Xuất phát: +$200`);
  }
  p.pos = next;
  handleLanding(s);
}

function goTo(s, idx, rewardStart = false) {
  const p = s.players[s.turn];
  if (rewardStart && idx === 0) {
    s.laps++;
    p.money += 200;
    say(s, `${p.name} về Xuất phát: +$200`);
  }
  p.pos = idx;
  handleLanding(s);
}

function handleLanding(s) {
  const p = s.players[s.turn];
  const tile = s.tiles[p.pos];

  switch (tile.type) {
    case "start":
      say(s, `${p.name} ở ô Xuất phát.`);
      break;
    case "property":
      if (s.owner[p.pos] === p.id) {
        say(s, `${p.name} đã sở hữu ${tile.name}.`);
      } else if (s.owner[p.pos]) {
        // trả tiền thuê
        const ownerId = s.owner[p.pos];
        const owner = s.players.find((x) => x.id === ownerId);
        p.money -= tile.rent;
        if (owner) owner.money += tile.rent;
        say(
          s,
          `${p.name} trả tiền thuê $${tile.rent} cho ${
            owner ? owner.name : "ngân hàng"
          }.`
        );
      } else {
        s.pendingBuy = { tileIdx: p.pos };
        say(s, `${p.name} có thể mua ${tile.name} với $${tile.price}.`);
      }
      break;
    case "chance": {
      const card = CHANCE[Math.floor(Math.random() * CHANCE.length)];
      card(s); // có thể di chuyển/tiền/nhà tù
      break;
    }
    case "tax":
      p.money -= tile.amount || 100;
      say(s, `${p.name} nộp thuế $${tile.amount || 100}.`);
      break;
    case "jail":
      p.skip = 1;
      say(s, `${p.name} vào Nhà tù: mất 1 lượt.`);
      break;
    case "free":
      say(s, `${p.name} ở Bãi đỗ miễn phí.`);
      break;
  }

  if (p.money < 0) {
    p.bankrupt = true;
    say(s, `💥 ${p.name} phá sản!`);
  }
}

function endTurn(s) {
  // bỏ lượt nếu skip>0
  const p = s.players[s.turn];
  if (p.skip > 0) {
    p.skip--;
    say(s, `${p.name} bị giữ, bỏ lượt.`);
  }
  // chuyển người
  do {
    s.turn = (s.turn + 1) % s.players.length;
  } while (s.players[s.turn].bankrupt && s.players.some((pl) => !pl.bankrupt));
}

// ====== SOCKET EVENTS ======
io.on("connection", (socket) => {
  let currentRoom = null;

  socket.on("createRoom", ({ name }) => {
    const roomId = makeRoomId();
    const s = defaultState();
    rooms.set(roomId, s);
    socket.join(roomId);
    currentRoom = roomId;
    s.players.push(defaultPlayer(name || "Player", socket.id));
    say(s, `${name || "Player"} đã tạo phòng ${roomId}.`);
    io.to(socket.id).emit("roomCreated", { roomId });
    broadcast(roomId);
  });

  socket.on("joinRoom", ({ roomId, name }) => {
    const s = rooms.get(roomId);
    if (!s)
      return io.to(socket.id).emit("error", { message: "Phòng không tồn tại" });
    if (s.players.length >= MAX_PLAYERS)
      return io.to(socket.id).emit("error", {
        message: `Phòng đã đủ người (tối đa ${MAX_PLAYERS})`,
      });
    socket.join(roomId);
    currentRoom = roomId;
    s.players.push(defaultPlayer(name || "Player", socket.id));
    say(s, `${name || "Player"} đã tham gia.`);
    broadcast(roomId);
  });

  socket.on("start", () => {
    const s = rooms.get(currentRoom);
    if (!s) return;
    if (s.players.length < 2)
      return io.to(socket.id).emit("error", { message: "Cần ít nhất 2 người" });
    s.started = true;
    say(s, "Trận đấu bắt đầu!");
    broadcast(currentRoom);
  });

  socket.on("roll", () => {
    const s = rooms.get(currentRoom);
    if (!s || !s.started) return;
    if (s.players[s.turn].id !== socket.id) return; // không phải lượt
    const n = Math.floor(Math.random() * 6) + 1;
    s.lastRoll = n;
    say(s, `${s.players[s.turn].name} quay được ${n}.`);
    moveBy(s, n);
    broadcast(currentRoom);
  });

  socket.on("buy", () => {
    const s = rooms.get(currentRoom);
    if (!s || !s.started) return;
    if (s.players[s.turn].id !== socket.id) return;
    const pb = s.pendingBuy;
    if (!pb) return;
    const t = s.tiles[pb.tileIdx];
    const p = s.players[s.turn];
    if (!s.owner[pb.tileIdx] && p.money >= t.price) {
      p.money -= t.price;
      s.owner[pb.tileIdx] = p.id;
      p.owned.push(pb.tileIdx);
      say(s, `${p.name} mua ${t.name} với $${t.price}.`);
      s.pendingBuy = null;
    }
    broadcast(currentRoom);
  });

  socket.on("skipBuy", () => {
    const s = rooms.get(currentRoom);
    if (!s || !s.started) return;
    if (s.players[s.turn].id !== socket.id) return;
    const pb = s.pendingBuy;
    if (!pb) return;
    const t = s.tiles[pb.tileIdx];
    const p = s.players[s.turn];
    p.money -= t.rent;
    say(s, `${p.name} bỏ mua ${t.name} → trả $${t.rent}.`);
    s.pendingBuy = null;
    broadcast(currentRoom);
  });

  socket.on("endTurn", () => {
    const s = rooms.get(currentRoom);
    if (!s || !s.started) return;
    if (s.players[s.turn].id !== socket.id) return;
    endTurn(s);
    broadcast(currentRoom);
  });

  socket.on("reset", () => {
    const s = rooms.get(currentRoom);
    if (!s) return;
    const players = s.players.map((p) => ({ id: p.id, name: p.name }));
    const next = defaultState();
    next.players = players.map((p) => defaultPlayer(p.name, p.id));
    rooms.set(currentRoom, next);
    say(next, "Đã khởi tạo ván mới.");
    broadcast(currentRoom);
  });

  socket.on("disconnect", () => {
    if (!currentRoom) return;
    const s = rooms.get(currentRoom);
    if (!s) return;
    s.players = s.players.filter((p) => p.id !== socket.id);
    if (s.players.length === 0) {
      rooms.delete(currentRoom);
    } else {
      say(s, "Một người chơi đã rời phòng.");
      broadcast(currentRoom);
    }
  });
});
// ====== SERVE REACT BUILD (one-link deploy) ======
const distDir = path.join(__dirname, "..", "dist");
app.use(express.static(distDir));
app.get("*", (req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

// thêm cuối file:
app.get("/healthz", (_req, res) => res.send("ok"));
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log("Server listening on " + PORT));
