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

// Get user's ads
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
      created_at: ad.created_at
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

// Pause ad endpoint - FIXED: removed updated_at
router.post('/:adId/pause', async (req, res) => {
  try {
    const { adId } = req.params;
    console.log('🟡 Pausing ad:', adId);
    
    const result = await db.runAsync(
      'UPDATE p2p_ads SET status = "paused" WHERE id = ?',
      [adId]
    );
    
    console.log('✅ Ad paused. Changes:', result.changes);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Ad not found' });
    }
    
    res.json({
      success: true,
      message: 'Ad paused successfully'
    });
    
  } catch (error) {
    console.error('🔴 Error pausing ad:', error);
    res.status(500).json({ error: error.message });
  }
});

// Resume ad endpoint - FIXED: removed updated_at
router.post('/:adId/resume', async (req, res) => {
  try {
    const { adId } = req.params;
    console.log('🟡 Resuming ad:', adId);
    
    const result = await db.runAsync(
      'UPDATE p2p_ads SET status = "active" WHERE id = ?',
      [adId]
    );
    
    console.log('✅ Ad resumed. Changes:', result.changes);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Ad not found' });
    }
    
    res.json({
      success: true,
      message: 'Ad resumed successfully'
    });
    
  } catch (error) {
    console.error('🔴 Error resuming ad:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update ad details - FIXED: removed updated_at
router.post('/:adId/update', async (req, res) => {
  try {
    const { adId } = req.params;
    const {
      title,
      exchange_rate,
      amount_available,
      min_amount,
      max_amount,
      payment_methods,
      terms
    } = req.body;

    console.log('🟡 UPDATING AD:', adId);
    console.log('🟡 UPDATE DATA:', req.body);

    // Check if ad exists
    const existingAd = await db.getAsync('SELECT * FROM p2p_ads WHERE id = ?', [adId]);
    if (!existingAd) {
      return res.status(404).json({ error: 'Ad not found' });
    }

    // Update the ad
    const result = await db.runAsync(
      `UPDATE p2p_ads SET 
        title = ?,
        exchange_rate = ?,
        amount_available = ?,
        min_amount = ?,
        max_amount = ?,
        payment_methods = ?,
        terms = ?
      WHERE id = ?`,
      [
        title || existingAd.title,
        parseFloat(exchange_rate),
        parseFloat(amount_available),
        parseFloat(min_amount),
        parseFloat(max_amount),
        JSON.stringify(payment_methods || []),
        terms || '',
        adId
      ]
    );

    console.log('✅ Ad updated. Changes:', result.changes);

    res.json({
      success: true,
      message: 'Ad updated successfully'
    });

  } catch (error) {
    console.error('🔴 Error updating ad:', error);
    res.status(500).json({
      error: 'Failed to update ad',
      details: error.message
    });
  }
});

// Delete ad
router.delete('/:adId', async (req, res) => {
  try {
    const { adId } = req.params;
    console.log('🟡 Deleting ad:', adId);
    
    const result = await db.runAsync('DELETE FROM p2p_ads WHERE id = ?', [adId]);
    
    console.log('✅ Ad deleted. Changes:', result.changes);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Ad not found' });
    }
    
    res.json({ 
      success: true,
      message: 'Ad deleted successfully' 
    });
    
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

// Get single ad by ID
router.get('/:adId', async (req, res) => {
  try {
    const { adId } = req.params;
    console.log('🟡 Fetching ad:', adId);
    
    const ad = await db.getAsync(`
      SELECT 
        pa.*,
        u.name as seller_name,
        u.kyc_status as seller_kyc_status
      FROM p2p_ads pa
      JOIN users u ON pa.user_id = u.id
      WHERE pa.id = ?
    `, [adId]);

    if (!ad) {
      return res.status(404).json({ error: 'Ad not found' });
    }

    // Parse payment_methods
    ad.payment_methods = JSON.parse(ad.payment_methods || '[]');

    res.json(ad);
  } catch (error) {
    console.error('🔴 Error fetching ad:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;