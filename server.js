// naseej-socket-server/server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:5000',
      'https://naseej-system.vercel.app',
      'https://mgzon-naseej-backend.hf.space'
    ],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// تخزين المستخدمين المتصلين
const onlineUsers = new Map(); // userId -> socketId
const userSockets = new Map(); // userId -> [socketIds]
const userConversations = new Map(); // userId -> conversationId

console.log('🚀 Socket.IO Server Starting...');

// Middleware 
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    console.log('🔐 Authenticating with token:', token ? 'Token provided' : 'No token');
    
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }
    
    const response = await axios.get(`${process.env.BACKEND_URL}/api/auth/verify`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    socket.userId = response.data.userId;
    socket.username = response.data.username;
    console.log(`✅ User authenticated: ${socket.username} (${socket.userId})`);
    next();
  } catch (error) {
    console.error('❌ Auth error:', error.response?.data || error.message);
    next(new Error('Authentication error: Invalid token'));
  }
});

io.on('connection', (socket) => {
  console.log(`🟢 User connected: ${socket.username} (${socket.userId})`);
  
  onlineUsers.set(socket.userId, socket.id);
  if (!userSockets.has(socket.userId)) {
    userSockets.set(socket.userId, []);
  }
  userSockets.get(socket.userId).push(socket.id);
  
  socket.broadcast.emit('user_online', { 
    userId: socket.userId, 
    username: socket.username 
  });
  
  socket.join(`user_${socket.userId}`);
  
  
  socket.on('join_conversation', (conversationId) => {
    socket.join(`conv_${conversationId}`);
    userConversations.set(socket.userId, conversationId);
    console.log(`📢 ${socket.username} joined conversation ${conversationId}`);
  });
  
  socket.on('leave_conversation', (conversationId) => {
    socket.leave(`conv_${conversationId}`);
    userConversations.delete(socket.userId);
    console.log(`📢 ${socket.username} left conversation ${conversationId}`);
  });
  
  socket.on('send_message', async (data, callback) => {
    const { conversationId, receiverId, text, type, mediaUrl, replyTo, duration } = data;
    
    console.log(`📨 ${socket.username} sending message to ${receiverId}`);
    
    try {
      const response = await axios.post(`${process.env.BACKEND_URL}/api/chat/messages`, {
        conversationId,
        receiverId,
        text: text || '🎤 Voice message',
        type: type || 'text',
        mediaUrl: mediaUrl || '',
        replyTo: replyTo || null,
        duration: duration || null
      }, {
        headers: { Authorization: `Bearer ${socket.handshake.auth.token}` }
      });
      
      const newMessage = response.data.message;
      console.log(`✅ Message saved: ${newMessage._id}`);
      
      io.to(`conv_${conversationId}`).emit('new_message', newMessage);
      
      if (callback) callback({ success: true, message: newMessage });
      
    } catch (error) {
      console.error('❌ Send message error:', error.response?.data || error.message);
      if (callback) callback({ success: false, error: error.message });
    }
  });
  
  socket.on('typing', ({ conversationId, isTyping }) => {
    socket.to(`conv_${conversationId}`).emit('user_typing', {
      userId: socket.userId,
      username: socket.username,
      isTyping,
      conversationId
    });
  });
  
  //  (Reaction)
  socket.on('add_reaction', async ({ messageId, reaction, receiverId }) => {
    try {
      await axios.post(`${process.env.BACKEND_URL}/api/chat/messages/${messageId}/reaction`, {
        reaction
      }, {
        headers: { Authorization: `Bearer ${socket.handshake.auth.token}` }
      });
      
      socket.to(`user_${receiverId}`).emit('new_reaction', {
        messageId,
        reaction,
        userId: socket.userId,
        username: socket.username
      });
      
    } catch (error) {
      console.error('❌ Reaction error:', error.message);
    }
  });
  
  socket.on('message_read', ({ messageId, conversationId, senderId }) => {
    socket.to(`user_${senderId}`).emit('message_read', {
      messageId,
      conversationId,
      readerId: socket.userId,
      readerName: socket.username
    });
  });
  
  socket.on('disconnect', () => {
    console.log(`🔴 User disconnected: ${socket.username} (${socket.userId})`);
    
    onlineUsers.delete(socket.userId);
    
    const sockets = userSockets.get(socket.userId);
    if (sockets) {
      const newSockets = sockets.filter(id => id !== socket.id);
      if (newSockets.length === 0) {
        userSockets.delete(socket.userId);
        userConversations.delete(socket.userId);
        socket.broadcast.emit('user_offline', { userId: socket.userId });
      } else {
        userSockets.set(socket.userId, newSockets);
      }
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    connections: onlineUsers.size,
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Socket.IO server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
});