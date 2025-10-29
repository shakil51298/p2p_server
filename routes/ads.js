const express = require('express');
const db = require('../config/database');
const router = express.Router();

// GET ALL ACTIVE ADS
router.get('/marketplace', async (req, res) => {
  try {
    console.log('🟡 Fetching marketplace ads...');
    
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

    console.log('🟢 Found ads:', ads.length);

    // Parse payment_methods from JSON string to array
    const adsWithParsedMethods = ads.map(ad => ({
      ...ad,
      payment_methods: JSON.parse(ad.payment_methods || '[]')
    }));

    res.json(adsWithParsedMethods);
  } catch (error) {
    console.error('🔴 Error fetching ads:', error);
    res.status(500).json({ 
      message: 'Error fetching marketplace ads: ' + error.message,
      error: error.toString()
    });
  }
});

// Get user's ads - FIXED: using p2p_ads table
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log('🟡 Fetching ads for user ID:', userId);
    
    const ads = await db.allAsync(`
      SELECT 
        pa.*,
        u.name as seller_name
      FROM p2p_ads pa
      JOIN users u ON pa.user_id = u.id
      WHERE pa.user_id = ? 
      ORDER BY pa.created_at DESC
    `, [userId]);

    console.log('🟢 Found user ads:', ads.length);

    // Parse payment_methods and map field names
    const formattedAds = ads.map(ad => ({
      id: ad.id,
      user_id: ad.user_id,
      title: `${ad.type === 'buy' ? 'Buy' : 'Sell'} ${ad.currency_from} for ${ad.currency_to}`,
      trade_type: ad.type,
      status: ad.status || 'active',
      currency_from: ad.currency_from,
      currency_to: ad.currency_to,
      price: ad.exchange_rate,
      available_amount: ad.amount_available,
      min_amount: ad.min_amount,
      max_amount: ad.max_amount,
      payment_methods: ad.payment_methods,
      terms: ad.terms,
      total_trades: ad.total_trades || 0,
      success_rate: ad.success_rate || 100,
      response_time: ad.response_time || 15,
      views: ad.views || 0,
      inquiries: ad.inquiries || 0,
      completed_trades: ad.completed_trades || 0,
      created_at: ad.created_at,
      updated_at: ad.updated_at
    }));

    res.json(formattedAds);
  } catch (error) {
    console.error('🔴 Error fetching user ads:', error);
    res.status(500).json({ 
      error: 'Failed to fetch user ads',
      details: error.message 
    });
  }
});

// Update ad status - FIXED: using p2p_ads table
router.patch('/:adId', async (req, res) => {
  try {
    const { adId } = req.params;
    const { status } = req.body;
    
    console.log('🟡 Updating ad status:', adId, status);
    
    const result = await db.runAsync(
      'UPDATE p2p_ads SET status = ?, updated_at = datetime("now") WHERE id = ?',
      [status, adId]
    );
    
    console.log('✅ Ad status updated');
    
    // Get the updated ad
    const updatedAd = await db.getAsync('SELECT * FROM p2p_ads WHERE id = ?', [adId]);
    res.json(updatedAd);
    
  } catch (error) {
    console.error('🔴 Error updating ad:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete ad - FIXED: using p2p_ads table
router.delete('/:adId', async (req, res) => {
  try {
    const { adId } = req.params;
    console.log('🟡 Deleting ad:', adId);
    
    await db.runAsync('DELETE FROM p2p_ads WHERE id = ?', [adId]);
    
    console.log('✅ Ad deleted successfully');
    res.json({ message: 'Ad deleted successfully' });
    
  } catch (error) {
    console.error('🔴 Error deleting ad:', error);
    res.status(500).json({ error: error.message });
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

    console.log('🟡 AD CREATE: Received request', req.body);

    // Validate required fields
    if (!type || !currency_from || !currency_to || !exchange_rate || !amount_available || !payment_methods || !user_id) {
      return res.status(400).json({ 
        message: 'All fields are required',
        received: {
          type: !!type,
          currency_from: !!currency_from,
          currency_to: !!currency_to,
          exchange_rate: !!exchange_rate,
          amount_available: !!amount_available,
          payment_methods: !!payment_methods,
          user_id: !!user_id
        }
      });
    }

    console.log('🟡 Creating ad for user:', user_id);

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

    console.log('🟢 Ad created successfully with ID:', result.lastID);

    res.status(201).json({
      message: 'Ad created successfully!',
      adId: result.lastID
    });

  } catch (error) {
    console.error('🔴 AD CREATE ERROR:', error);
    res.status(500).json({ 
      message: 'Error creating ad: ' + error.message,
      error: error.toString(),
      stack: error.stack
    });
  }
});

module.exports = router;