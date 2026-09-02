// Reward rules:
// - Agar final order amount (subtotal + deliveryFee - discount) >= 100
//   to 20 coins earn milenge
// - 2 coins = ₹1 discount  => Reward Discount = coinsUsed / 2

const MIN_AMOUNT_FOR_REWARD = 100;
const COINS_PER_ORDER = 20;
const COINS_PER_RUPEE_DISCOUNT = 2; // 2 coins -> 1 rupee

function calculateRewardUsage({ user, baseAmount, requestedCoins }) {
  const safeBase = Number(baseAmount) || 0;

  // Agar order amount hi 0 ya negative hai to na discount na reward
  if (safeBase <= 0) {
    return {
      coinsUsed: 0,
      discount: 0,
      remainingCoins: Number(user?.rewardCoins || 0),
      rewardCoinsEarned: 0
    };
  }

  const availableCoins = Math.max(0, Number(user?.rewardCoins || 0));

  let coinsToUse = Math.max(0, Number(requestedCoins || 0));

  // ── Discount part (sirf tab jab kuch coins actually use karne ki try ki ho) ──
  if (coinsToUse > 0 && availableCoins > 0) {
    // 1) user ke balance se zyada nahi
    coinsToUse = Math.min(coinsToUse, availableCoins);

    // 2) amount ke hisaab se zyada nahi (jitna discount ho sakta hai)
    const maxCoinsByAmount = Math.floor(
      safeBase * COINS_PER_RUPEE_DISCOUNT
    );
    coinsToUse = Math.min(coinsToUse, maxCoinsByAmount);

    // 3) coins even hone chahiye (2 coins = ₹1)
    if (coinsToUse % 2 === 1) {
      coinsToUse -= 1;
    }

    if (coinsToUse < 0) coinsToUse = 0;
  } else {
    coinsToUse = 0;
  }

  const discount = coinsToUse / COINS_PER_RUPEE_DISCOUNT;

  // Final amount discount ke baad
  const finalAmount = safeBase - discount;

  // ── Earning part (availableCoins se koi lena dena nahi) ──
  const rewardCoinsEarned =
    finalAmount >= MIN_AMOUNT_FOR_REWARD ? COINS_PER_ORDER : 0;

  const remainingCoins = availableCoins - coinsToUse;

  return {
    coinsUsed: coinsToUse,
    discount,
    remainingCoins,
    rewardCoinsEarned
  };
}

module.exports = {
  MIN_AMOUNT_FOR_REWARD,
  COINS_PER_ORDER,
  COINS_PER_RUPEE_DISCOUNT,
  calculateRewardUsage
};