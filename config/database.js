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

async function initializeDatabase() {
  try {
    // Create users table
    await db.runAsync(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      kyc_status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    console.log('✅ Users table ready');

    // Create p2p_ads table
    await db.runAsync(`CREATE TABLE IF NOT EXISTS p2p_ads (
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
    )`);
    console.log('✅ Ads table ready');

    // Create orders table
    await db.runAsync(`CREATE TABLE IF NOT EXISTS orders (
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
    )`);
    console.log('✅ Orders table ready');

    // Check if chat_messages table exists and needs migration
    const chatTableExists = await db.tableExistsAsync('chat_messages');
    
    if (chatTableExists) {
      console.log('🔄 Chat messages table exists, checking structure...');
      
      // Check if file_data column exists
      const tableInfo = await db.allAsync("PRAGMA table_info(chat_messages)");
      const hasFileData = tableInfo.some(column => column.name === 'file_data');
      const hasMessageNullable = tableInfo.some(column => column.name === 'message' && column.notnull === 0);
      
      if (!hasFileData || !hasMessageNullable) {
        console.log('🔄 Migrating chat_messages table to support files...');
        await migrateChatMessagesTable();
      } else {
        console.log('✅ Chat messages table already has file support');
      }
    } else {
      // Create new chat_messages table with file support
      await db.runAsync(`CREATE TABLE chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        sender_id INTEGER NOT NULL,
        message TEXT,
        message_type TEXT DEFAULT 'text' CHECK(message_type IN ('text', 'system', 'payment', 'dispute', 'file')),
        file_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders (id),
        FOREIGN KEY (sender_id) REFERENCES users (id)
      )`);
      console.log('✅ Chat messages table created with file support');
    }

    // Create admin_settings table for future use
    await db.runAsync(`CREATE TABLE IF NOT EXISTS admin_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      setting_key TEXT UNIQUE NOT NULL,
      setting_value TEXT NOT NULL,
      description TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    console.log('✅ Admin settings table ready');
    
    // Insert default settings
    const defaultSettings = [
      ['max_file_size', '10485760', 'Maximum file size in bytes (10MB)'],
      ['allowed_file_types', 'jpg,jpeg,png,gif,pdf,doc,docx,txt', 'Allowed file types for upload'],
      ['order_timeout_minutes', '30', 'Order completion timeout in minutes'],
      ['trade_fee_percentage', '0.5', 'Platform trade fee percentage']
    ];
    
    for (const setting of defaultSettings) {
      await db.runAsync(`INSERT OR IGNORE INTO admin_settings (setting_key, setting_value, description) VALUES (?, ?, ?)`, setting);
    }

    // Create disputes table for future use
    await db.runAsync(`CREATE TABLE IF NOT EXISTS disputes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      raised_by INTEGER NOT NULL,
      reason TEXT NOT NULL,
      status TEXT DEFAULT 'open' CHECK(status IN ('open', 'resolved', 'cancelled')),
      resolution TEXT,
      resolved_by INTEGER,
      resolved_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders (id),
      FOREIGN KEY (raised_by) REFERENCES users (id),
      FOREIGN KEY (resolved_by) REFERENCES users (id)
    )`);
    console.log('✅ Disputes table ready');

    // Create notifications table for future use
    await db.runAsync(`CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'info' CHECK(type IN ('info', 'success', 'warning', 'error')),
      is_read INTEGER DEFAULT 0,
      related_order_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id),
      FOREIGN KEY (related_order_id) REFERENCES orders (id)
    )`);
    console.log('✅ Notifications table ready');

    // Create user_verification table for enhanced KYC
    await db.runAsync(`CREATE TABLE IF NOT EXISTS user_verification (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      document_type TEXT NOT NULL,
      document_front TEXT,
      document_back TEXT,
      selfie_photo TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'verified', 'rejected')),
      verified_by INTEGER,
      verified_at DATETIME,
      rejection_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id),
      FOREIGN KEY (verified_by) REFERENCES users (id)
    )`);
    console.log('✅ User verification table ready');

    // Create trade_statistics table for analytics
    await db.runAsync(`CREATE TABLE IF NOT EXISTS trade_statistics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      total_trades INTEGER DEFAULT 0,
      completed_trades INTEGER DEFAULT 0,
      total_volume REAL DEFAULT 0,
      positive_reviews INTEGER DEFAULT 0,
      negative_reviews INTEGER DEFAULT 0,
      average_rating REAL DEFAULT 0,
      last_trade_date DATETIME,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )`);
    console.log('✅ Trade statistics table ready');

    // Create user_reviews table
    await db.runAsync(`CREATE TABLE IF NOT EXISTS user_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      reviewer_id INTEGER NOT NULL,
      reviewed_user_id INTEGER NOT NULL,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders (id),
      FOREIGN KEY (reviewer_id) REFERENCES users (id),
      FOREIGN KEY (reviewed_user_id) REFERENCES users (id),
      UNIQUE(order_id, reviewer_id)
    )`);
    console.log('✅ User reviews table ready');

    console.log('🎉 All database tables initialized successfully!');

  } catch (error) {
    console.error('🔴 Database initialization error:', error);
  }
}

// Function to migrate the chat_messages table
async function migrateChatMessagesTable() {
  try {
    // Create a temporary table with the new structure
    await db.runAsync(`CREATE TABLE chat_messages_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      sender_id INTEGER NOT NULL,
      message TEXT,
      message_type TEXT DEFAULT 'text' CHECK(message_type IN ('text', 'system', 'payment', 'dispute', 'file')),
      file_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders (id),
      FOREIGN KEY (sender_id) REFERENCES users (id)
    )`);

    // Copy data from old table to new table
    await db.runAsync(`
      INSERT INTO chat_messages_new (id, order_id, sender_id, message, message_type, created_at)
      SELECT id, order_id, sender_id, message, message_type, created_at 
      FROM chat_messages
    `);

    // Drop the old table
    await db.runAsync(`DROP TABLE chat_messages`);

    // Rename new table to original name
    await db.runAsync(`ALTER TABLE chat_messages_new RENAME TO chat_messages`);

    console.log('✅ Chat messages table migrated successfully with file support');
  } catch (error) {
    console.error('🔴 Error migrating chat_messages table:', error);
    throw error;
  }
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

// Add transaction support
db.transaction = function (callback) {
  return new Promise((resolve, reject) => {
    this.serialize(() => {
      this.run('BEGIN TRANSACTION');
      callback(this)
        .then(result => {
          this.run('COMMIT', (err) => {
            if (err) reject(err);
            else resolve(result);
          });
        })
        .catch(error => {
          this.run('ROLLBACK', () => {
            reject(error);
          });
        });
    });
  });
};

// Add utility method for checking if table exists
db.tableExistsAsync = function (tableName) {
  return new Promise((resolve, reject) => {
    this.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
      [tableName],
      (err, row) => {
        if (err) reject(err);
        else resolve(!!row);
      }
    );
  });
};

// Add method to get table structure
db.getTableInfoAsync = function (tableName) {
  return new Promise((resolve, reject) => {
    this.all(
      `PRAGMA table_info(${tableName})`,
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
};

// Add backup method
db.backupAsync = function (backupPath) {
  return new Promise((resolve, reject) => {
    const backupDb = new sqlite3.Database(backupPath);
    this.backup(backupDb, {
      progress: (p) => {
        console.log(`Backup progress: ${p.totalPages > 0 ? Math.round((p.remainingPages / p.totalPages) * 100) : 0}%`);
      }
    }, (err) => {
      backupDb.close();
      if (err) reject(err);
      else resolve();
    });
  });
};

module.exports = db;