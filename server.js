const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const adsRoutes = require('./routes/ads');
const ordersRoutes = require('./routes/orders');
const chatRoutes = require('./routes/chat');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors({
  origin: "http://localhost:3000",
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/ads', adsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/chat', chatRoutes);

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('🔵 User connected:', socket.id);

  // Join a specific order room
  socket.on('join_order', (orderId) => {
    socket.join(`order_${orderId}`);
    console.log(`🔵 User ${socket.id} joined order room: order_${orderId}`);
  });

  // Handle chat messages
  socket.on('send_message', async (data) => {
    try {
      console.log('💬 Message received from user:', data.senderId, data.senderName);
      console.log('💬 Message data:', data);
      
      // Save message to database
      const db = require('./config/database');
      const result = await db.runAsync(
        'INSERT INTO chat_messages (order_id, sender_id, message, message_type) VALUES (?, ?, ?, ?)',
        [data.orderId, data.senderId, data.message, data.messageType || 'text']
      );

      // Get sender name from database to ensure consistency
      const sender = await db.getAsync('SELECT name FROM users WHERE id = ?', [data.senderId]);
      const senderName = sender ? sender.name : data.senderName;

      // Add message ID and timestamp to the data
      const messageData = {
        ...data,
        id: result.lastID,
        sender_name: senderName,
        sender_id: data.senderId,
        created_at: new Date().toISOString()
      };

      console.log(`💬 Broadcasting message to order_${data.orderId}:`, messageData);

      // Broadcast to all users in the order room
      io.to(`order_${data.orderId}`).emit('receive_message', messageData);
      console.log(`💬 Message sent to order_${data.orderId}`);

    } catch (error) {
      console.error('🔴 Error saving message:', error);
      socket.emit('message_error', { error: 'Failed to send message' });
    }
  });

  // Handle user typing
  socket.on('typing', (data) => {
    console.log(`⌨️ User ${data.userName} typing in order_${data.orderId}`);
    socket.to(`order_${data.orderId}`).emit('user_typing', {
      userId: data.userId,
      userName: data.userName
    });
  });

  // Handle stop typing
  socket.on('stop_typing', (data) => {
    console.log(`⌨️ User stopped typing in order_${data.orderId}`);
    socket.to(`order_${data.orderId}`).emit('user_stop_typing', {
      userId: data.userId
    });
  });

  socket.on('disconnect', () => {
    console.log('🔴 User disconnected:', socket.id);
  });
});

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is working! Hello from backend!' });
});

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running smoothly',
    database: 'SQLite (File-based - No setup required!)',
    timestamp: new Date().toISOString()
  });
});

// Socket.io test endpoint
app.get('/socket-test', (req, res) => {
  res.json({ message: 'Socket.io endpoint is reachable' });
});

const PORT = process.env.PORT || 50000;

server.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
  console.log(`🔵 Socket.io is ready for real-time communication`);
  console.log(`📊 Database: SQLite (no setup required)`);
  console.log(`💾 Database file: server/p2p_exchange.db`);
});