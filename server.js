const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
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

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Create unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'application/pdf': 'pdf',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'text/plain': 'txt'
    };
    
    if (allowedTypes[file.mimetype]) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/ads', adsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/chat', chatRoutes);

// File upload endpoint
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    console.log('📁 File uploaded:', req.file);

    res.json({
      message: 'File uploaded successfully',
      file: {
        filename: req.file.filename,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        path: `/uploads/${req.file.filename}`
      }
    });
  } catch (error) {
    console.error('🔴 File upload error:', error);
    res.status(500).json({ message: 'Error uploading file' });
  }
});

// Serve uploaded files statically
app.use('/uploads', express.static('uploads'));

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
      
      let fileData = null;
      if (data.messageType === 'file' && data.file) {
        fileData = JSON.stringify(data.file);
      }

      const result = await db.runAsync(
        'INSERT INTO chat_messages (order_id, sender_id, message, message_type, file_data) VALUES (?, ?, ?, ?, ?)',
        [data.orderId, data.senderId, data.message, data.messageType || 'text', fileData]
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
        created_at: new Date().toISOString(),
        file_data: fileData
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
  console.log(`📁 File uploads enabled - Max 10MB`);
  console.log(`📊 Database: SQLite (no setup required)`);
  console.log(`💾 Database file: server/p2p_exchange.db`);
  console.log(`📁 Uploads directory: server/uploads/`);
});