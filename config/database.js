const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database file will be created in server folder
const dbPath = path.join(__dirname, '..', 'p2p_exchange.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
  } else {
    console.log('✅ Connected to SQLite database');
    initializeDatabase();
  }
});

function initializeDatabase() {
  // Create users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    kyc_status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('Error creating users table:', err);
    } else {
      console.log('✅ Users table ready');
    }
  });

  // Create p2p_ads table
  db.run(`CREATE TABLE IF NOT EXISTS p2p_ads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('buy', 'sell')),
    currency_from TEXT NOT NULL,
    currency_to TEXT NOT NULL,
    exchange_rate REAL NOT NULL,
    amount_available REAL NOT NULL,
    min_amount REAL DEFAULT 10,
    max_amount REAL DEFAULT 1000,
    payment_methods TEXT NOT NULL,
    terms TEXT,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'paused', 'completed')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`, (err) => {
    if (err) {
      console.error('Error creating p2p_ads table:', err);
    } else {
      console.log('✅ Ads table ready');
    }
  });

  // Create orders table
  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ad_id INTEGER NOT NULL,
    buyer_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    total_price REAL NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'completed', 'disputed', 'cancelled')),
    countdown_end DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ad_id) REFERENCES p2p_ads (id),
    FOREIGN KEY (buyer_id) REFERENCES users (id)
  )`, (err) => {
    if (err) {
      console.error('Error creating orders table:', err);
    } else {
      console.log('✅ Orders table ready');
    }
  });

  // Create chat_messages table
  db.run(`CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    sender_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    message_type TEXT DEFAULT 'text' CHECK(message_type IN ('text', 'system', 'payment', 'dispute')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders (id),
    FOREIGN KEY (sender_id) REFERENCES users (id)
  )`, (err) => {
    if (err) {
      console.error('Error creating chat_messages table:', err);
    } else {
      console.log('✅ Chat messages table ready');
    }
  });
}

// Promisify db methods for easier use
db.runAsync = function (sql, params = []) {
  return new Promise((resolve, reject) => {
    this.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

db.getAsync = function (sql, params = []) {
  return new Promise((resolve, reject) => {
    this.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

db.allAsync = function (sql, params = []) {
  return new Promise((resolve, reject) => {
    this.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

module.exports = db;