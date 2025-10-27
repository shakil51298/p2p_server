const express = require('express');
const db = require('../config/database');
const router = express.Router();

// CREATE NEW ORDER
router.post('/create', async (req, res) => {
  try {
    const {
      ad_id,
      amount
    } = req.body;

    console.log('Creating order for ad:', ad_id, 'amount:', amount);

    // Get ad details
    const ad = await db.getAsync(
      'SELECT * FROM p2p_ads WHERE id = ? AND status = "active"',
      [ad_id]
    );

    if (!ad) {
      return res.status(404).json({ message: 'Ad not found or not active' });
    }

    // Check if amount is within limits
    if (amount < ad.min_amount || amount > ad.max_amount) {
      return res.status(400).json({ 
        message: `Amount must be between ${ad.min_amount} and ${ad.max_amount}` 
      });
    }

    // Check if enough amount is available
    if (amount > ad.amount_available) {
      return res.status(400).json({ 
        message: `Only ${ad.amount_available} available` 
      });
    }

    // Calculate total price
    const total_price = amount * ad.exchange_rate;
    
    // Set countdown (30 minutes from now)
    const countdown_end = new Date(Date.now() + 30 * 60 * 1000);

    // For development, use user ID 1 as buyer
    const buyer_id = 1;

    // Create order
    const result = await db.runAsync(
      `INSERT INTO orders (ad_id, buyer_id, amount, total_price, status, countdown_end) 
       VALUES (?, ?, ?, ?, 'pending', ?)`,
      [ad_id, buyer_id, amount, total_price, countdown_end.toISOString()]
    );

    // Update available amount in ad
    const new_available = ad.amount_available - amount;
    await db.runAsync(
      'UPDATE p2p_ads SET amount_available = ? WHERE id = ?',
      [new_available, ad_id]
    );

    // If ad is fully taken, mark as completed
    if (new_available <= 0) {
      await db.runAsync(
        'UPDATE p2p_ads SET status = "completed" WHERE id = ?',
        [ad_id]
      );
    }

    console.log('Order created successfully with ID:', result.lastID);

    res.status(201).json({
      message: 'Order created successfully!',
      order: {
        id: result.lastID,
        ad_id,
        amount,
        total_price,
        status: 'pending',
        countdown_end,
        currency_from: ad.currency_from,
        currency_to: ad.currency_to
      }
    });

  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ 
      message: 'Error creating order: ' + error.message
    });
  }
});

// GET USER'S ORDERS
router.get('/my-orders', async (req, res) => {
  try {
    const user_id = 1; // Demo user ID

    const orders = await db.allAsync(`
      SELECT 
        o.*,
        pa.currency_from,
        pa.currency_to,
        pa.exchange_rate,
        seller.name as seller_name,
        buyer.name as buyer_name
      FROM orders o
      JOIN p2p_ads pa ON o.ad_id = pa.id
      JOIN users seller ON pa.user_id = seller.id
      JOIN users buyer ON o.buyer_id = buyer.id
      WHERE o.buyer_id = ? OR pa.user_id = ?
      ORDER BY o.created_at DESC
    `, [user_id, user_id]);

    res.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ message: 'Error fetching orders' });
  }
});

module.exports = router;