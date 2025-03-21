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
  },
  transports: ["polling"]  // Use polling for Vercel compatibility
});

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

  socket.on('join-room', (roomId, userId, userType) => {
    socket.join(roomId);
    socket.to(roomId).emit('user-connected', userId, userType);
    
    socket.on('disconnect', () => {
      socket.to(roomId).emit('user-disconnected', userId);
      console.log(`User ${userId} disconnected from room ${roomId}`);
    });
  });

  // WebRTC signaling
  socket.on('offer', (roomId, offer) => {
    socket.to(roomId).emit('offer', offer, socket.id);
  });

  socket.on('answer', (roomId, answer) => {
    socket.to(roomId).emit('answer', answer, socket.id);
  });

  socket.on('ice-candidate', (roomId, candidate) => {
    socket.to(roomId).emit('ice-candidate', candidate, socket.id);
  });
  
  // New events for transcription and malpractice
  socket.on('transcription', (roomId, transcript, userId) => {
    socket.to(roomId).emit('transcription', transcript, userId);
  });
  
  socket.on('malpractice', (roomId, malpracticeType) => {
    socket.to(roomId).emit('malpractice-detected', malpracticeType);
  });
  
  socket.on('tab-switch', (roomId) => {
    socket.to(roomId).emit('tab-switch-detected');
  });

  socket.on('error', (error) => {
    console.error('Socket.IO error:', error);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
