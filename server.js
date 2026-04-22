const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 8000;

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Game state
let gameState = {
  gameStarted: false,
  target: 3,
  raceCounter: 1,
  raceName: '',
  bets: {},
  revealed: false,
  history: [],
  ejectedPlayers: []
};

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// 新增：在线人数计数器
let onlineCount = 0;

io.on('connection', (socket) => {
  // 新增：连接时增加人数
  onlineCount++;
  io.emit('onlineCount', onlineCount); // 广播给所有人
  
  // Send current state to new connections
  const submittedNames = Object.keys(gameState.bets).map(name => ({
    name: name,
    time: gameState.bets[name].time
  }));
  
  socket.emit('state', {
    gameStarted: gameState.gameStarted,
    target: gameState.target,
    raceCounter: gameState.raceCounter,
    raceName: gameState.raceName,
    bets: gameState.bets,
    revealed: gameState.revealed,
    history: gameState.history,
    betCount: Object.keys(gameState.bets).length,
    submittedNames: submittedNames,
    ejectedPlayers: gameState.ejectedPlayers
  });

  socket.on('disconnect', () => {
    // 新增：断开时减少人数
    onlineCount--;
    io.emit('onlineCount', onlineCount); // 广播给所有人
  });

  // ... 原有的其他事件处理代码保持不变 ...
});
