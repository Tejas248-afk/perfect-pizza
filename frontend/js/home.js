// frontend/js/home.js
document.addEventListener('DOMContentLoaded', () => {
  if (typeof setupAuthNav === 'function') {
    setupAuthNav();
  }

  showOrHideBogoCard();
  loadActiveCoupons();

  // Optional: time change pe UI update ke liye har minute check
  setInterval(showOrHideBogoCard, 60 * 1000);
});

function getIstNow() {
  const now = new Date();
  return new Date(
    now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
  );
}

function showOrHideBogoCard() {
  const card = document.getElementById('bogo-tuesday-card');
  if (!card) return;

  const istNow = getIstNow();
  const day = istNow.getDay();   // 2 = Tuesday
  const hour = istNow.getHours();

  const isTuesday = day === 2;
  const isWithinTime = hour >= 10 && hour < 23; // 10:00–23:00 IST

  if (isTuesday && isWithinTime) {
    card.style.display = '';
  } else {
    card.style.display = 'none';
  }
}

async function loadActiveCoupons() {
  const container = document.getElementById('coupon-offers');
  if (!container) return;

  container.innerHTML =
    '<p class="text-small" style="color:#555;">Loading offers...</p>';

  try {
    const res = await Api.get('/coupons/active'); // hits /api/coupons/active
    const coupons = res.coupons || [];

    if (!coupons.length) {
      container.innerHTML = `
        <article class="order-card">
          <div class="order-card-main">
            <div>
              <div class="order-id">More offers coming soon</div>
              <div class="order-meta">
                Custom coupons and discounts can be configured from the admin panel.
              </div>
            </div>
          </div>
        </article>
      `;
      return;
    }

    container.innerHTML = coupons
      .map(coupon => {
        let detail = '';
        if (coupon.discountType === 'PERCENT') {
          detail = `${coupon.amount}% off`;
          if (coupon.maxDiscount && coupon.maxDiscount > 0) {
            detail += ` (up to ₹${coupon.maxDiscount})`;
          }
        } else {
          detail = `Flat ₹${coupon.amount} off`;
        }

        const desc = coupon.description || '';

        return `
          <article class="order-card">
            <div class="order-card-main">
              <div>
                <div class="order-id">Use code: ${coupon.code}</div>
                <div class="order-meta">${detail} on online orders</div>
                ${
                  desc
                    ? `<div class="order-meta">${desc}</div>`
                    : ''
                }
              </div>
            </div>
          </article>
        `;
      })
      .join('');
  } catch (err) {
    console.error('Failed to load active coupons', err);
    container.innerHTML = `
      <article class="order-card">
        <div class="order-card-main">
          <div>
            <div class="order-id">More offers coming soon</div>
            <div class="order-meta">
              We are unable to load offers right now. Please check again later.
            </div>
          </div>
        </div>
      </article>
    `;
  }
}