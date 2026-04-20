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

io.on('connection', (socket) => {
  // Send current state to new connections
  socket.emit('state', {
    ...gameState,
    betCount: Object.keys(gameState.bets).length,
    submittedNames: Object.keys(gameState.bets)
  });

  socket.on('setPlayers', (num) => {
    gameState.target = parseInt(num) || 3;
    gameState.gameStarted = true;
    gameState.raceCounter = 1;
    gameState.history = [];
    gameState.ejectedPlayers = [];
    io.emit('nameRound', { raceCounter: gameState.raceCounter });
  });

  socket.on('setRaceName', (name) => {
    gameState.raceName = name;
    gameState.bets = {};
    gameState.revealed = false;
    gameState.ejectedPlayers = [];
    io.emit('roundStart', { raceName: name, target: gameState.target });
  });

  socket.on('placeBet', ({ name, bet }) => {
    if (gameState.revealed) return;
    gameState.bets[name] = bet;
    const count = Object.keys(gameState.bets).length;
    const submittedNames = Object.keys(gameState.bets);
    io.emit('betUpdate', { count, target: gameState.target, submittedNames });
    
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

  socket.on('ejectRace', () => {
    if (gameState.revealed || !gameState.raceName) return;
    
    // Find players who haven't submitted
    const submittedPlayers = Object.keys(gameState.bets);
    const ejectedPlayers = [];
    
    // Create placeholder entries for non-submitted players
    // We'll mark them with a special value
    for (let i = submittedPlayers.length + 1; i <= gameState.target; i++) {
      const ejectedName = `Player ${i} (not submitted)`;
      gameState.bets[ejectedName] = '(No bet submitted)';
      ejectedPlayers.push(ejectedName);
    }
    
    gameState.revealed = true;
    gameState.ejectedPlayers = ejectedPlayers;
    
    gameState.history.push({
      raceName: gameState.raceName,
      bets: { ...gameState.bets },
      ejectedPlayers: ejectedPlayers
    });
    
    // Notify all clients that the race was ejected
    io.emit('raceEjected', { ejectedPlayers });
    
    io.emit('reveal', {
      raceName: gameState.raceName,
      bets: gameState.bets,
      history: gameState.history,
      ejectedPlayers: ejectedPlayers
    });
  });

  socket.on('newRound', () => {
    gameState.raceCounter++;
    gameState.raceName = '';
    gameState.bets = {};
    gameState.revealed = false;
    gameState.ejectedPlayers = [];
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
        history: [],
        ejectedPlayers: []
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
