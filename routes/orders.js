const express = require('express');
const db = require('../config/database');
const router = express.Router();

// CREATE NEW ORDER
router.post('/create', async (req, res) => {
  try {
    const { ad_id, amount, buyer_id } = req.body;
    
    console.log('🟡 ORDER CREATE: Received request', { ad_id, amount, buyer_id });

    // Validate input
    if (!ad_id || !amount || !buyer_id) {
      return res.status(400).json({ 
        message: 'ad_id, amount, and buyer_id are required',
        received: req.body
      });
    }

    // Get ad details
    const ad = await db.getAsync(
      'SELECT * FROM p2p_ads WHERE id = ? AND status = "active"',
      [ad_id]
    );

    console.log('🟡 Found ad:', ad);

    if (!ad) {
      return res.status(404).json({ message: 'Ad not found or not active' });
    }

    // Check if user is trying to trade with themselves
    if (parseInt(buyer_id) === parseInt(ad.user_id)) {
      return res.status(400).json({ 
        message: 'You cannot create an order for your own ad' 
      });
    }

    // Check if amount is within limits
    if (amount < ad.min_amount) {
      return res.status(400).json({ 
        message: `Amount must be at least ${ad.min_amount}` 
      });
    }

    if (amount > ad.max_amount) {
      return res.status(400).json({ 
        message: `Amount cannot exceed ${ad.max_amount}` 
      });
    }

    // Check if enough amount is available
    if (amount > ad.amount_available) {
      return res.status(400).json({ 
        message: `Only ${ad.amount_available} available, requested ${amount}` 
      });
    }

    // Calculate total price
    const total_price = amount * ad.exchange_rate;
    
    // Set countdown (30 minutes from now)
    const countdown_end = new Date(Date.now() + 30 * 60 * 1000);

    // Use the buyer_id from the request (REMOVED the duplicate const buyer_id = 1)
    console.log('🟡 Creating order with buyer_id:', buyer_id);

    // Create order
    const result = await db.runAsync(
      `INSERT INTO orders (ad_id, buyer_id, amount, total_price, status, countdown_end) 
       VALUES (?, ?, ?, ?, 'pending', ?)`,
      [ad_id, buyer_id, amount, total_price, countdown_end.toISOString()]
    );

    console.log('🟢 Order created with ID:', result.lastID);

    // Update available amount in ad
    const new_available = ad.amount_available - amount;
    await db.runAsync(
      'UPDATE p2p_ads SET amount_available = ? WHERE id = ?',
      [new_available, ad_id]
    );

    console.log('🟢 Updated ad available amount to:', new_available);

    // If ad is fully taken, mark as completed
    if (new_available <= 0) {
      await db.runAsync(
        'UPDATE p2p_ads SET status = "completed" WHERE id = ?',
        [ad_id]
      );
      console.log('🟢 Ad marked as completed');
    }

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
    console.error('🔴 ORDER CREATE ERROR:', error);
    res.status(500).json({ 
      message: 'Error creating order: ' + error.message
    });
  }
});

// GET USER'S ORDERS
router.get('/my-orders', async (req, res) => {
  try {
    const user_id = req.query.user_id;

    if (!user_id) {
      return res.status(400).json({ message: 'user_id is required' });
    }

    console.log('🟡 Fetching orders for user:', user_id);

    const orders = await db.allAsync(`
      SELECT 
        o.*,
        pa.currency_from,
        pa.currency_to,
        pa.exchange_rate,
        seller.name as seller_name,
        buyer.name as buyer_name,
        seller.id as seller_id,
        buyer.id as buyer_id
      FROM orders o
      JOIN p2p_ads pa ON o.ad_id = pa.id
      JOIN users seller ON pa.user_id = seller.id
      JOIN users buyer ON o.buyer_id = buyer.id
      WHERE o.buyer_id = ? OR pa.user_id = ?
      ORDER BY o.created_at DESC
    `, [user_id, user_id]);

    console.log(`🟡 Found ${orders.length} orders for user ${user_id}`);
    res.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ message: 'Error fetching orders' });
  }
});

// UPDATE ORDER STATUS
router.put('/:orderId/status', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'paid', 'completed', 'disputed', 'cancelled'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    await db.runAsync(
      'UPDATE orders SET status = ? WHERE id = ?',
      [status, orderId]
    );

    res.json({ 
      message: 'Order status updated successfully',
      orderId,
      status
    });

  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ message: 'Error updating order status' });
  }
});

module.exports = router;