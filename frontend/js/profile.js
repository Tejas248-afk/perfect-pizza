document.addEventListener('DOMContentLoaded', () => {
  if (typeof setupAuthNav === 'function') {
    setupAuthNav();
  }
  initProfilePage();
});

async function initProfilePage() {
  const token = Api.getToken && Api.getToken();
  if (!token) {
    alert('Profile dekhne ke liye login zaroori hai.');
    window.location.href = 'login.html';
    return;
  }

  try {
    const meRes = await Api.get('/auth/me');
    const user = meRes.user;

    // Sirf CUSTOMER ko profile allow
    if (!user || user.role !== 'CUSTOMER') {
      alert('Profile page sirf customer ke liye available hai.');
      if (user && user.role === 'KITCHEN') {
        window.location.href = 'kitchen/orders.html';
      } else {
        window.location.href = 'index.html';
      }
      return;
    }

    // Account info + header
    const nameEl = document.getElementById('profile-name');
    const contactEl = document.getElementById('profile-contact');
    const sinceEl = document.getElementById('profile-since');
    const headingNameEl = document.getElementById('profile-name-heading');
    const avatarEl = document.getElementById('profile-avatar');

    if (nameEl) nameEl.textContent = user.name;
    if (contactEl) contactEl.textContent = user.contact;

    if (sinceEl && user.createdAt) {
      const d = new Date(user.createdAt);
      sinceEl.textContent = d.toLocaleDateString('en-IN', {
        dateStyle: 'medium'
      });
    }

    if (headingNameEl) {
      const firstName = user.name ? user.name.split(' ')[0] : 'Guest';
      headingNameEl.textContent = firstName;
    }

    if (avatarEl && user.name) {
      avatarEl.textContent = user.name.charAt(0).toUpperCase();
    }

    // Wallet info
    const rewards = await Api.get('/rewards/balance');
    const coins = rewards.coins || 0;
    const value = rewards.rupeeValue || 0;

    const coinsEl = document.getElementById('wallet-coins');
    const valueEl = document.getElementById('wallet-value');

    if (coinsEl) coinsEl.textContent = coins;
    if (valueEl) valueEl.textContent = `₹${value.toFixed(0)}`;

    // Order history
    const listEl = document.getElementById('profile-orders-list');
    const emptyEl = document.getElementById('profile-orders-empty');
    const loadingEl = document.getElementById('profile-orders-loading');
    const ordersRes = await Api.get('/orders/my');
    const orders = ordersRes.orders || [];

    loadingEl.style.display = 'none';

    const countEl = document.getElementById('profile-orders-count');
    if (countEl) countEl.textContent = orders.length;

    if (!orders.length) {
      emptyEl.style.display = 'block';
      return;
    }

    orders.forEach(order => {
      const card = document.createElement('article');
      card.className = 'order-card';

      const createdAt = new Date(order.createdAt).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });

      card.innerHTML = `
        <div class="order-card-main">
          <div>
            <div class="order-id">Order #${String(order._id).slice(-6)}</div>
            <div class="order-meta">${createdAt}</div>
            <div class="order-meta">Status: ${order.status}</div>
          </div>
          <div class="order-card-right">
            <div class="order-amount">₹${Number(
              order.grandTotal || 0
            ).toFixed(0)}</div>
            <button class="btn btn-secondary profile-view-btn">
              View details
            </button>
          </div>
        </div>
      `;

      card
        .querySelector('.profile-view-btn')
        .addEventListener('click', () => {
          localStorage.setItem('pp_current_order_id', order._id);
          window.location.href = `order-details.html?id=${encodeURIComponent(
            order._id
          )}`;
        });

      listEl.appendChild(card);
    });
  } catch (err) {
    console.error('Profile load error', err);
    alert(
      err.message || 'Profile load nahi ho paaya, thodi der baad try karein.'
    );
  }
}