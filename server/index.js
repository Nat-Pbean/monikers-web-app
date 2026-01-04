/**
 * 🃏 MONIKERS MOBILE 🃏
 * * Game Concept:
 * Based on the board game "Monikers" created by Alex Hague and Justin Vickers.
 * Inspired by the public domain game "Celebrity." 
 * Please support the original creators at: https://www.monikersgame.com/
 * * Technical Implementation:
 * Developed by Nathanael Panggabean
 * Built using React, Node.js, and Socket.io.
 * * Description: 
 * A web-based multiplayer implementation designed for mobile play, 
 * featuring real-time card drafting, team scoring, and synced game states.
 */

const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const rooms = {}; 

const broadcastRoomUpdate = (roomCode) => {
    const room = rooms[roomCode];
    if (!room) return;

    const roomDataForClient = { ...room };
    delete roomDataForClient.timerInterval; 

    io.to(roomCode).emit('room_update', roomDataForClient);
};

const endTurn = (roomCode) => {
    const room = rooms[roomCode];
    if (!room) return;

    clearInterval(room.timerInterval);
    room.timerActive = false;
    room.activePlayerId = null; // Clear active player so no one sees a card
    
    if(room.currentCard) {
        room.deck.unshift(room.currentCard); 
        room.currentCard = null;
    }

    const previousTeam = room.turnTeam;
    room.turnTeam = room.turnTeam === 1 ? 2 : 1;

    if (previousTeam === 2) {
        room.turnIndex++;
    }

    const nextTeamPlayers = room.players.filter(p => p.team === room.turnTeam);
    if (nextTeamPlayers.length === 0) {
        room.turnTeam = previousTeam;
    }
    
    broadcastRoomUpdate(roomCode);
};

// --- SOCKET CONNECTION ---
io.on('connection', (socket) => {
  console.log(`User Connected: ${socket.id}`);

  socket.on('join_room', ({ roomCode, name, playerId }) => {
    socket.join(roomCode);
    socket.currentRoom = roomCode;
    socket.myPlayerId = playerId; // Store on socket for easier disconnect handling

    if (!rooms[roomCode]) {
        rooms[roomCode] = {
            players: [],
            deck: [],
            allCards: [],
            phase: 'LOBBY',
            scores: { team1: 0, team2: 0 },
            currentCard: null,
            round: 1,
            timer: 60,
            timerActive: false,
            turnTeam: Math.random() < 0.5 ? 1 : 2,
            turnIndex: 0,
            submittedPlayers: [],
            activePlayerId: null // FIX: Track who is currently giving clues
        };
    }

    const room = rooms[roomCode];
    let player = room.players.find(p => p.playerId === playerId);

    if (player) {
        // SUCCESSFUL RECONNECTION: Keep same team/data
        player.id = socket.id;
        player.name = name;
        console.log(`Player ${name} reconnected to team ${player.team}`);
    } else {
        // NEW PLAYER
        const team1Count = room.players.filter(p => p.team === 1).length;
        const team2Count = room.players.filter(p => p.team === 2).length;
        const team = team1Count <= team2Count ? 1 : 2;

        player = { id: socket.id, playerId, name, team };
        room.players.push(player);
    }
    
    broadcastRoomUpdate(roomCode);
  });

  socket.on('switch_team', ({ roomCode }) => {
    const room = rooms[roomCode];
    const player = room?.players.find(p => p.id === socket.id);
    if (player) {
      player.team = player.team === 1 ? 2 : 1;
      broadcastRoomUpdate(roomCode);
    }
  });

  socket.on("start_drafting", ({ roomCode }) => {
    const room = rooms[roomCode];
    if (room && room.players.length >= 2) {
      room.phase = 'DRAFTING';
      broadcastRoomUpdate(roomCode);
    }
  });

  socket.on('submit_draft', ({ roomCode, selectedCards }) => {
    const room = rooms[roomCode];
    if (!room) return;

    if (!room.submittedPlayers.includes(socket.myPlayerId)) {
        room.submittedPlayers.push(socket.myPlayerId);
    }

    if (Array.isArray(selectedCards)) {
        const existingIds = new Set(room.deck.map(c => c.id));
        selectedCards.forEach(card => {
            if (card?.id && !existingIds.has(card.id)) {
                room.deck.push(card);
            }
        });
    }

    if (room.submittedPlayers.length >= room.players.length && room.deck.length > 0) {
        room.allCards = [...room.deck];
        room.phase = 'GAME';
        room.deck.sort(() => 0.5 - Math.random());
    }

    broadcastRoomUpdate(roomCode);
  });

  socket.on('start_turn', ({ roomCode }) => {
    const room = rooms[roomCode];
    if(!room || room.timerActive) return;

    // FIX: Calculate and save the activePlayerId
    const teamPlayers = room.players.filter(p => p.team === room.turnTeam);
    const activePlayer = teamPlayers[room.turnIndex % teamPlayers.length];
    
    if (!activePlayer || socket.id !== activePlayer.id) return;

    room.activePlayerId = activePlayer.playerId; // Now the client knows who to show the card to
    room.timerActive = true;
    room.timer = 60; 

    if(room.timerInterval) clearInterval(room.timerInterval);

    room.timerInterval = setInterval(() => {
      if (room.timer > 0) {
        room.timer -= 1;
        io.to(roomCode).emit('timer_update', room.timer);
      } else {
        endTurn(roomCode);
      }
    }, 1000);

    broadcastRoomUpdate(roomCode);
  });

  socket.on('draw_card', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (room && room.deck.length > 0 && !room.currentCard) {
        room.currentCard = room.deck.pop();
        broadcastRoomUpdate(roomCode);
    }
  });

  socket.on('score_card', ({ roomCode, team }) => {
    const room = rooms[roomCode];
    if (!room || room.phase !== 'GAME' || !room.currentCard) return;

    room.scores[`team${team}`] += 1;
    room.currentCard = null;

    if (room.deck.length === 0) {
        clearInterval(room.timerInterval);
        room.timerActive = false;
        room.activePlayerId = null;

        if (room.round < 3) {
            room.round += 1;
            room.deck = [...room.allCards].sort(() => 0.5 - Math.random());
            const t1 = room.scores.team1;
            const t2 = room.scores.team2;
            room.turnTeam = t1 > t2 ? 2 : (t2 > t1 ? 1 : Math.random() < 0.5 ? 1 : 2);
            room.turnIndex = 0;
        } else {
            room.phase = 'GAME_OVER';
        }
    }
    broadcastRoomUpdate(roomCode);
  });

  socket.on('pass_card', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (room?.currentCard) {
      room.deck.unshift(room.currentCard);
      room.currentCard = null;
      broadcastRoomUpdate(roomCode);
    }
  });

  const handleDisconnect = () => {
      const roomCode = socket.currentRoom;
      if (roomCode && rooms[roomCode]) {
        // PERSISTENCE FIX: Don't remove players from room.players.
        // Just broadcast that a player's socket disconnected.
        const room = rooms[roomCode];
        
        // Only delete the room if actually NO ONE is left (including disconnected entries)
        // Or if you prefer, set a 'connected' flag on the player object.
        const stillInRoom = room.players.some(p => io.sockets.adapter.rooms.get(roomCode)?.has(p.id));
        
        if (!stillInRoom) {
           // Optional: delete room after a timeout if no one reconnects
           // delete rooms[roomCode]; 
        }
        broadcastRoomUpdate(roomCode);
      }
    }

  socket.on('leave_room', () => {
      // If they explicitly leave, we CAN remove them
      const roomCode = socket.currentRoom;
      if (roomCode && rooms[roomCode]) {
          rooms[roomCode].players = rooms[roomCode].players.filter(p => p.id !== socket.id);
          broadcastRoomUpdate(roomCode);
      }
  });
  
  socket.on('disconnect', handleDisconnect);
});

server.listen(3001, "0.0.0.0", () => {
  console.log("SERVER RUNNING ON 3001");
});