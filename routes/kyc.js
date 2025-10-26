const express = require('express');
const db = require('../config/database');
const router = express.Router();

// Mark user as KYC verified (for development)
router.post('/verify-user', async (req, res) => {
  try {
    const { userId } = req.body;
    console.log('KYC verification request for user:', userId);
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const result = await db.runAsync(
      'UPDATE users SET kyc_status = ? WHERE id = ?',
      ['verified', userId]
    );

    console.log('KYC update result:', result);

    res.json({ 
      message: 'User marked as KYC verified!',
      user: {
        id: userId,
        kycStatus: 'verified'
      }
    });
  } catch (error) {
    console.error('KYC verification error:', error);
    res.status(500).json({ message: 'Error verifying user: ' + error.message });
  }
});

// Get KYC status
router.get('/status/:userId', async (req, res) => {
  try {
    const user = await db.getAsync(
      'SELECT id, name, kyc_status FROM users WHERE id = ?',
      [req.params.userId]
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ kycStatus: user.kyc_status });
  } catch (error) {
    console.error('KYC status error:', error);
    res.status(500).json({ message: 'Error fetching KYC status' });
  }
});

// Test route
router.get('/test', (req, res) => {
  res.json({ message: 'KYC routes are working!' });
});

module.exports = router;