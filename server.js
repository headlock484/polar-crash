const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());

// Serve static files from the React app build directory
app.use(express.static(path.join(__dirname, 'build')));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { 
    origin: process.env.FRONTEND_URL || "*", 
    methods: ["GET", "POST"],
    credentials: true
  }
});

let activeGames = new Map(); // Track individual player games

// Game logic for a single player
const runPlayerGame = async (socketId, stake) => {
  let multiplier = 1.0;
  let crashed = false;
  
  // Start the multiplier ticking
  const gameInterval = setInterval(() => {
    if (crashed) {
      clearInterval(gameInterval);
      activeGames.delete(socketId);
      return;
    }
    
    multiplier += 0.01;
    const currentMultiplier = parseFloat(multiplier.toFixed(2));
    
    // Update the stored multiplier in activeGames
    const game = activeGames.get(socketId);
    if (game) {
      game.multiplier = currentMultiplier;
    }
    
    io.to(socketId).emit('tick', currentMultiplier);
    
    // Random crash logic - 96% RTP means higher multipliers are less likely
    // Probability increases as multiplier increases
    const crashProbability = Math.min(0.02 + (multiplier - 1) * 0.01, 0.1);
    if (Math.random() < crashProbability) {
      crashed = true;
      clearInterval(gameInterval);
      activeGames.delete(socketId);
      io.to(socketId).emit('crash', currentMultiplier);
      console.log(`Player ${socketId} crashed at ${currentMultiplier}x`);
    }
  }, 100);
  
  activeGames.set(socketId, { interval: gameInterval, crashed: false, multiplier: 1.0 });
};

io.on('connection', (socket) => {
  console.log('A player connected:', socket.id);

  socket.on('start_game', ({ stake }) => {
    // Server-side validation
    const stakeValue = parseFloat(stake);
    if (!stakeValue || isNaN(stakeValue) || stakeValue <= 0) {
      console.log(`Invalid stake from player ${socket.id}: ${stake}`);
      return;
    }
    
    console.log(`Player ${socket.id} started game with stake ${stakeValue}`);
    // If player already has an active game, don't start a new one
    if (activeGames.has(socket.id)) {
      console.log(`Player ${socket.id} already has an active game`);
      return;
    }
    runPlayerGame(socket.id, stakeValue);
  });

  socket.on('cash_out', () => {
    const game = activeGames.get(socket.id);
    if (game && !game.crashed) {
      // Stop the game interval
      clearInterval(game.interval);
      // Server calculates and validates the cashout multiplier
      const cashOutMultiplier = parseFloat((game.multiplier || 1.0).toFixed(2));
      activeGames.delete(socket.id);
      // Emit success with the server-calculated multiplier
      io.to(socket.id).emit('success', cashOutMultiplier);
      console.log(`Player ${socket.id} cashed out at ${cashOutMultiplier}x`);
    } else {
      console.log(`Player ${socket.id} attempted cash out but no active game or already crashed`);
    }
  });

  socket.on('disconnect', () => {
    console.log('A player disconnected:', socket.id);
    const game = activeGames.get(socket.id);
    if (game) {
      clearInterval(game.interval);
      activeGames.delete(socket.id);
    }
  });
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});