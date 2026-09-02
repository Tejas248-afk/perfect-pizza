const {
  MIN_AMOUNT_FOR_REWARD,
  COINS_PER_ORDER,
  COINS_PER_RUPEE_DISCOUNT
} = require('../services/rewardService');

// GET /api/rewards/balance
exports.getBalance = async (req, res) => {
  const coins = Number(req.user.rewardCoins || 0);
  const rupeeValue = coins / COINS_PER_RUPEE_DISCOUNT;

  return res.json({
    coins,
    rupeeValue,
    rules: {
      minAmountForReward: MIN_AMOUNT_FOR_REWARD,
      coinsPerOrder: COINS_PER_ORDER,
      coinsPerRupeeDiscount: COINS_PER_RUPEE_DISCOUNT
    }
  });
};