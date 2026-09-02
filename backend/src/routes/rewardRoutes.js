const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const rewardController = require('../controllers/rewardController');

const router = express.Router();

// saare reward endpoints auth required
router.use(authMiddleware);

router.get('/balance', rewardController.getBalance);

module.exports = router;