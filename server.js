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

  // 处理设置玩家数量
  socket.on('setPlayers', (num) => {
    gameState.target = parseInt(num) || 3;
    gameState.gameStarted = true;
    gameState.raceCounter = 1;
    gameState.history = [];
    gameState.ejectedPlayers = [];
    io.emit('nameRound', { raceCounter: gameState.raceCounter });
  });

  // 处理设置比赛名称
  socket.on('setRaceName', (name) => {
    gameState.raceName = name;
    gameState.bets = {};
    gameState.revealed = false;
    gameState.ejectedPlayers = [];
    io.emit('roundStart', { raceName: name, target: gameState.target });
  });

  // 处理下注
  socket.on('placeBet', ({ name, bet }) => {
    if (gameState.revealed) return;
    
    // Store bet with timestamp
    gameState.bets[name] = {
      bet: bet,
      time: new Date().toISOString()
    };
    
    const count = Object.keys(gameState.bets).length;
    const submittedNames = Object.keys(gameState.bets).map(playerName => ({
      name: playerName,
      time: gameState.bets[playerName].time
    }));
    
    io.emit('betUpdate', { 
      count: count, 
      target: gameState.target, 
      submittedNames: submittedNames 
    });
    
    if (count >= gameState.target) {
      gameState.revealed = true;
      gameState.history.push({
        raceName: gameState.raceName,
        bets: { ...gameState.bets },
        ejectedPlayers: []
      });
      io.emit('reveal', {
        raceName: gameState.raceName,
        bets: gameState.bets,
        history: gameState.history,
        ejectedPlayers: []
      });
    }
  });

  // 处理强制结束比赛
  socket.on('ejectRace', () => {
    if (gameState.revealed || !gameState.raceName) return;
    
    // Find players who haven't submitted
    const submittedPlayers = Object.keys(gameState.bets);
    const ejectedPlayers = [];
    
    // Create placeholder entries for non-submitted players
    for (let i = submittedPlayers.length + 1; i <= gameState.target; i++) {
      const ejectedName = `Player ${i} (not submitted)`;
      gameState.bets[ejectedName] = {
        bet: '(No bet submitted)',
        time: new Date().toISOString() // Time when ejected
      };
      ejectedPlayers.push(ejectedName);
    }
    
    gameState.revealed = true;
    gameState.ejectedPlayers = ejectedPlayers;
    
    gameState.history.push({
      raceName: gameState.raceName,
      bets: { ...gameState.bets },
      ejectedPlayers: ejectedPlayers
    });
    
    io.emit('reveal', {
      raceName: gameState.raceName,
      bets: gameState.bets,
      history: gameState.history,
      ejectedPlayers: ejectedPlayers
    });
  });

  // 处理下一轮
  socket.on('newRound', () => {
    gameState.raceCounter++;
    gameState.raceName = '';
    gameState.bets = {};
    gameState.revealed = false;
    gameState.ejectedPlayers = [];
    io.emit('nameRound', { raceCounter: gameState.raceCounter });
  });

  // 处理新的一天（重置游戏）
  socket.on('newRacingDay', (password) => {
    if (password === ADMIN_PASSWORD) {
      gameState = {
        gameStarted: false,
        target: 3,
        raceCounter: 1,
        raceName: '',
        bets: {},
        revealed: false,
        history: [],
        ejectedPlayers: []
      };
      io.emit('resetAll');
    } else {
      socket.emit('authError', 'Incorrect password');
    }
  });

  socket.on('disconnect', () => {
    // 新增：断开时减少人数
    onlineCount--;
    io.emit('onlineCount', onlineCount); // 广播给所有人
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Online count tracking enabled`);
});
