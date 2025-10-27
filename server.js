const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const adsRoutes = require('./routes/ads'); 
const ordersRoutes = require('./routes/orders');



const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/ads', adsRoutes);
app.use('/api/orders', ordersRoutes);

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

const PORT = process.env.PORT || 50000;

app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
  console.log(`📊 Database: SQLite (no setup required)`);
  console.log(`💾 Database file: server/p2p_exchange.db`);
  console.log(`🚀 Ready for user registration and login!`);
});