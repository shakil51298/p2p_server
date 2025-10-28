const express = require('express');
const db = require('../config/database');
const router = express.Router();

// GET CHAT MESSAGES FOR AN ORDER
router.get('/messages/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    const messages = await db.allAsync(`
      SELECT 
        cm.*,
        u.name as sender_name
      FROM chat_messages cm
      JOIN users u ON cm.sender_id = u.id
      WHERE cm.order_id = ?
      ORDER BY cm.created_at ASC
    `, [orderId]);

    res.json(messages);
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    res.status(500).json({ message: 'Error fetching chat messages' });
  }
});

// GET ORDER DETAILS FOR CHAT
router.get('/order/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await db.getAsync(`
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
      WHERE o.id = ?
    `, [orderId]);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).json({ message: 'Error fetching order details' });
  }
});

module.exports = router;