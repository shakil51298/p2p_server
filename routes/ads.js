const express = require('express');
const db = require('../config/database');
const router = express.Router();

// GET ALL ACTIVE ADS
router.get('/marketplace', async (req, res) => {
  try {
    const ads = await db.allAsync(`
      SELECT 
        pa.*,
        u.name as seller_name,
        u.kyc_status as seller_kyc_status
      FROM p2p_ads pa
      JOIN users u ON pa.user_id = u.id
      WHERE pa.status = 'active'
      ORDER BY pa.created_at DESC
    `);

    // Parse payment_methods from JSON string to array
    const adsWithParsedMethods = ads.map(ad => ({
      ...ad,
      payment_methods: JSON.parse(ad.payment_methods || '[]')
    }));

    res.json(adsWithParsedMethods);
  } catch (error) {
    console.error('Error fetching ads:', error);
    res.status(500).json({ message: 'Error fetching marketplace ads' });
  }
});

// CREATE NEW AD
router.post('/create', async (req, res) => {
  try {
    const {
      type,
      currency_from,
      currency_to,
      exchange_rate,
      amount_available,
      min_amount,
      max_amount,
      payment_methods,
      terms,
      user_id
    } = req.body;

    console.log('🟡 AD CREATE: Received request from user:', user_id);

    // Validate required fields
    if (!type || !currency_from || !currency_to || !exchange_rate || !amount_available || !payment_methods || !usert_id) {
      return res.status(400).json({ 
        message: 'All fields including user_id required',
        received: req.body 
      });
    }

  

    // Insert new ad
    const result = await db.runAsync(
      `INSERT INTO p2p_ads (
        user_id, type, currency_from, currency_to, exchange_rate,
        amount_available, min_amount, max_amount, payment_methods, terms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user_id,
        type,
        currency_from,
        currency_to,
        parseFloat(exchange_rate),
        parseFloat(amount_available),
        parseFloat(min_amount) || 10,
        parseFloat(max_amount) || 1000,
        JSON.stringify(payment_methods),
        terms || ''
      ]
    );

    console.log('🟢 Ad created successfully for user:', user_id, 'Ad ID:', result.lastID);

    res.status(201).json({
      message: 'Ad created successfully!',
      adId: result.lastID
    });

  } catch (error) {
    console.error('Error creating ad:', error);
    res.status(500).json({ 
      message: 'Error creating ad: ' + error.message,
      error: error.toString()
    });
  }
});

// GET USER'S ADS
router.get('/my-ads', async (req, res) => {
  try {
    const user_id = 1; // Demo user ID

    const ads = await db.allAsync(`
      SELECT * FROM p2p_ads 
      WHERE user_id = ? 
      ORDER BY created_at DESC
    `, [user_id]);

    // Parse payment_methods
    const adsWithParsedMethods = ads.map(ad => ({
      ...ad,
      payment_methods: JSON.parse(ad.payment_methods || '[]')
    }));

    res.json(adsWithParsedMethods);
  } catch (error) {
    console.error('Error fetching user ads:', error);
    res.status(500).json({ message: 'Error fetching your ads' });
  }
});

module.exports = router;