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
  history: []
};

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

io.on('connection', (socket) => {
  // Send current state to new connections
  socket.emit('state', {
    ...gameState,
    betCount: Object.keys(gameState.bets).length
  });

  socket.on('setPlayers', (num) => {
    gameState.target = parseInt(num) || 3;
    gameState.gameStarted = true;
    gameState.raceCounter = 1;
    gameState.history = [];
    io.emit('nameRound', { raceCounter: gameState.raceCounter });
  });

  socket.on('setRaceName', (name) => {
    gameState.raceName = name;
    gameState.bets = {};
    gameState.revealed = false;
    io.emit('roundStart', { raceName: name, target: gameState.target });
  });

  socket.on('placeBet', ({ name, bet }) => {
    if (gameState.revealed) return;
    gameState.bets[name] = bet;
    const count = Object.keys(gameState.bets).length;
    io.emit('betUpdate', { count, target: gameState.target });
    
    if (count >= gameState.target) {
      gameState.revealed = true;
      gameState.history.push({
        raceName: gameState.raceName,
        bets: { ...gameState.bets }
      });
      io.emit('reveal', {
        raceName: gameState.raceName,
        bets: gameState.bets,
        history: gameState.history
      });
    }
  });

  socket.on('newRound', () => {
    gameState.raceCounter++;
    gameState.raceName = '';
    gameState.bets = {};
    gameState.revealed = false;
    io.emit('nameRound', { raceCounter: gameState.raceCounter });
  });

  socket.on('newRacingDay', (password) => {
    if (password === ADMIN_PASSWORD) {
      gameState = {
        gameStarted: false,
        target: 3,
        raceCounter: 1,
        raceName: '',
        bets: {},
        revealed: false,
        history: []
      };
      io.emit('resetAll');
    } else {
      socket.emit('authError', 'Incorrect password');
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
