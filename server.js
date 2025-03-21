// server.js - Main server file
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const cors = require('cors');
const { executeCode, runTestCases } = require('./code-execution'); // Import code execution module

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
      rooms[roomId] = { 
        users: [],
        problems: [], // Store problems
        submissions: [] // Store submissions
      };
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

  // Coding environment events
  socket.on('coding-problem', (roomId, problem) => {
    console.log(`Coding problem sent to room ${roomId}`);
    
    // Store the problem in the room
    if (rooms[roomId]) {
      rooms[roomId].problems.push(problem);
    }
    
    socket.to(roomId).emit('coding-problem', problem);
  });

  // Handle code execution requests
  socket.on('run-code', async (roomId, data) => {
    console.log(`Code run request in room ${roomId}`);
    
    try {
      // Execute the code
      const result = await executeCode(data.code, data.language);
      
      // Send result back to the requester
      socket.emit('code-execution-result', result);
      
      // Also send to the interviewer if request came from candidate
      if (socket.userData && socket.userData.userType === 'candidate') {
        // Find interviewer in the room
        const interviewers = rooms[roomId]?.users.filter(user => user.type === 'interviewer') || [];
        
        // Forward the code and result to all interviewers
        interviewers.forEach(interviewer => {
          io.to(interviewer.socketId).emit('run-code', {
            ...data,
            result
          });
        });
      }
    } catch (error) {
      console.error('Error executing code:', error);
      socket.emit('code-execution-result', {
        success: false,
        error: 'Server error while executing code',
        executionTime: 0
      });
    }
  });

  // Handle solution submissions with test cases
  socket.on('submit-solution', async (roomId, data) => {
    console.log(`Solution submitted in room ${roomId}`);
    
    try {
      // Store the submission
      if (rooms[roomId]) {
        // Find the problem
        const problem = rooms[roomId].problems.find(p => p.id === data.problemId);
        
        if (problem && problem.testCases && problem.testCases.length > 0) {
          // Run test cases
          const testResults = await runTestCases(data.code, data.language, problem.testCases);
          
          // Calculate success rate
          const passedTests = testResults.filter(test => test.testPassed).length;
          const totalTests = testResults.length;
          
          const result = {
            success: passedTests === totalTests,
            passedTests,
            totalTests,
            testResults,
            executionTime: testResults.reduce((sum, test) => sum + (test.executionTime || 0), 0)
          };
          
          // Store submission with results
          rooms[roomId].submissions.push({
            userId: data.userId,
            problemId: data.problemId,
            code: data.code,
            language: data.language,
            result,
            timestamp: new Date()
          });
          
          // Send result to the candidate
          socket.emit('code-execution-result', {
            success: result.success,
            output: `Passed ${passedTests}/${totalTests} test cases`,
            testResults: result.testResults,
            executionTime: result.executionTime
          });
          
          // Forward to interviewer
          if (socket.userData && socket.userData.userType === 'candidate') {
            // Find interviewer in the room
            const interviewers = rooms[roomId]?.users.filter(user => user.type === 'interviewer') || [];
            
            // Forward the submission to all interviewers
            interviewers.forEach(interviewer => {
              io.to(interviewer.socketId).emit('submit-solution', {
                ...data,
                result
              });
            });
          }
        } else {
          // If no test cases, just execute the code normally
          const result = await executeCode(data.code, data.language);
          
          // Store submission
          rooms[roomId].submissions.push({
            userId: data.userId,
            problemId: data.problemId,
            code: data.code,
            language: data.language,
            result,
            timestamp: new Date()
          });
          
          // Send result to the candidate
          socket.emit('code-execution-result', result);
          
          // Forward to interviewer
          if (socket.userData && socket.userData.userType === 'candidate') {
            // Find interviewer in the room
            const interviewers = rooms[roomId]?.users.filter(user => user.type === 'interviewer') || [];
            
            // Forward the submission to all interviewers
            interviewers.forEach(interviewer => {
              io.to(interviewer.socketId).emit('submit-solution', {
                ...data,
                result
              });
            });
          }
        }
      } else {
        // Just execute the code and return the result
        const result = await executeCode(data.code, data.language);
        socket.emit('code-execution-result', result);
      }
    } catch (error) {
      console.error('Error processing solution:', error);
      socket.emit('code-execution-result', {
        success: false,
        error: 'Server error while processing solution',
        executionTime: 0
      });
    }
  });

  socket.on('feedback', (roomId, feedback) => {
    console.log(`Feedback sent to room ${roomId}`);
    socket.to(roomId).emit('feedback', feedback);
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
        }],
        problems: [],
        submissions: []
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