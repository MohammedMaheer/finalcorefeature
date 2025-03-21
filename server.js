const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Enable CORS
app.use(cors({ origin: '*' }));

const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Store connected users and rooms
const rooms = {};

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/interviewer', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'interviewer.html'));
});

app.get('/candidate', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'candidate.html'));
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Handle room joining
  socket.on('join-room', (roomId, userId, userType) => {
    console.log(`User ${userId} (${userType}) joined room ${roomId}`);
    
    // Initialize room if it doesn't exist
    if (!rooms[roomId]) {
      rooms[roomId] = { users: [] };
    }
    
    // Add user to room
    rooms[roomId].users.push({
      id: userId,
      socketId: socket.id,
      type: userType
    });
    
    // Join the socket.io room
    socket.join(roomId);
    
    // Store room info in socket for disconnect handling
    socket.userData = { roomId, userId, userType };
    
    // Notify other users in the room
    socket.to(roomId).emit('user-connected', userId, userType);
    
    // Send current users to the newly joined user
    const otherUsers = rooms[roomId].users.filter(user => user.id !== userId);
    if (otherUsers.length > 0) {
      socket.emit('existing-users', otherUsers);
    }
  });

  // WebRTC signaling
  socket.on('offer', (roomId, offer) => {
    console.log(`Offer received in room ${roomId}`);
    socket.to(roomId).emit('offer', offer, socket.id);
  });

  socket.on('answer', (roomId, answer) => {
    console.log(`Answer received in room ${roomId}`);
    socket.to(roomId).emit('answer', answer, socket.id);
  });

  socket.on('ice-candidate', (roomId, candidate) => {
    socket.to(roomId).emit('ice-candidate', candidate, socket.id);
  });
  
  // Transcription and malpractice events
  socket.on('transcription', (roomId, transcript, userId) => {
    socket.to(roomId).emit('transcription', transcript, userId);
  });
  
  socket.on('malpractice', (roomId, malpracticeData) => {
    socket.to(roomId).emit('malpractice-detected', malpracticeData);
  });
  
  socket.on('tab-switch', (roomId) => {
    socket.to(roomId).emit('tab-switch-detected');
  });

  // Handle reconnection
  socket.on('reconnect-user', (roomId, userId, userType) => {
    console.log(`User ${userId} (${userType}) attempting to reconnect to room ${roomId}`);
    
    // Check if room exists
    if (rooms[roomId]) {
      // Update socket ID if user exists
      const userIndex = rooms[roomId].users.findIndex(user => user.id === userId);
      if (userIndex !== -1) {
        rooms[roomId].users[userIndex].socketId = socket.id;
        socket.join(roomId);
        socket.userData = { roomId, userId, userType };
        socket.to(roomId).emit('user-reconnected', userId, userType);
        console.log(`User ${userId} reconnected to room ${roomId}`);
      } else {
        // If user doesn't exist in room, add them
        rooms[roomId].users.push({
          id: userId,
          socketId: socket.id,
          type: userType
        });
        socket.join(roomId);
        socket.userData = { roomId, userId, userType };
        socket.to(roomId).emit('user-connected', userId, userType);
        console.log(`User ${userId} added to room ${roomId} after reconnection attempt`);
      }
    } else {
      // If room doesn't exist, create it
      rooms[roomId] = { 
        users: [{
          id: userId,
          socketId: socket.id,
          type: userType
        }]
      };
      socket.join(roomId);
      socket.userData = { roomId, userId, userType };
      console.log(`Created new room ${roomId} for reconnecting user ${userId}`);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    if (socket.userData) {
      const { roomId, userId, userType } = socket.userData;
      console.log(`User ${userId} (${userType}) disconnected from room ${roomId}`);
      
      // Remove user from room
      if (rooms[roomId]) {
        rooms[roomId].users = rooms[roomId].users.filter(user => user.socketId !== socket.id);
        
        // Delete room if empty
        if (rooms[roomId].users.length === 0) {
          delete rooms[roomId];
          console.log(`Room ${roomId} deleted (empty)`);
        } else {
          // Notify other users
          socket.to(roomId).emit('user-disconnected', userId, userType);
        }
      }
    }
  });

  socket.on('error', (error) => {
    console.error('Socket.IO error:', error);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});