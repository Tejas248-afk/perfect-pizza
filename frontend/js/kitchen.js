// js/kitchen.js

document.addEventListener('DOMContentLoaded', () => {
  if (typeof setupAuthNav === 'function') {
    setupAuthNav();
  }

  if (document.getElementById('kitchen-orders')) {
    initKitchenOrdersPage();
  }

  if (document.getElementById('kitchen-order-detail')) {
    initKitchenOrderDetailPage();
  }
});

async function requireKitchenRole() {
  const user = Api.getStoredUser();
  if (!user || !Api.getToken()) {
    alert(
      'Please log in with an admin or kitchen account to access the kitchen panel.'
    );
    window.location.href = '../login.html';
    return false;
  }

  if (user.role !== 'KITCHEN' && user.role !== 'ADMIN') {
    alert('Only ADMIN or KITCHEN users can access the kitchen panel.');
    if (user.role === 'KITCHEN') {
      window.location.href = '../kitchen/orders.html';
    } else {
      window.location.href = '../index.html';
    }
    return false;
  }

  return true;
}

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    timeStyle: 'short',
    dateStyle: 'short'
  });
}

function formatCurrency(v) {
  return `₹${Number(v || 0).toFixed(0)}`;
}

function formatAddOns(addOns) {
  if (!Array.isArray(addOns) || !addOns.length) return 'No add-ons';
  return addOns
    .map(a => {
      const qty = Number(a.quantity || 1);
      return `${a.name}${qty > 1 ? ` × ${qty}` : ''}`;
    })
    .join(', ');
}

const KITCHEN_CURRENT_ORDER_KEY = 'pp_kitchen_current_order_id';

// Polling ke liye previous active orders count track karenge
let lastActiveCount = null;

// Global audio context (ek hi baar banega)
let kitchenAudioCtx = null;
let kitchenSoundEnabled = false;

/* ---------- Sound unlock (autoplay policy ke liye) ---------- */

function setupKitchenSoundUnlock() {
  if (kitchenSoundEnabled) return;

  const handler = async () => {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      console.warn('Web Audio API not supported');
      return;
    }

    if (!kitchenAudioCtx) {
      kitchenAudioCtx = new AudioCtx();
    }

    try {
      if (kitchenAudioCtx.state === 'suspended') {
        await kitchenAudioCtx.resume();
      }
      kitchenSoundEnabled = true;
      console.log('[Kitchen] sound unlocked by user interaction');
    } catch (e) {
      console.warn('Unable to unlock audio context:', e.message);
    }

    document.removeEventListener('click', handler);
  };

  document.addEventListener('click', handler);
}

/* ---------- New order sound helper (Web Audio beep) ---------- */

function playNewOrderSound() {
  if (!kitchenSoundEnabled) {
    console.log('[Kitchen] sound disabled (no user interaction yet)');
    return;
  }

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) {
    console.warn('Web Audio API not supported, skipping sound.');
    return;
  }

  if (!kitchenAudioCtx) {
    kitchenAudioCtx = new AudioCtx();
  }

  const ctx = kitchenAudioCtx;

  const duration = 0.25;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.value = 880;

  gain.gain.setValueAtTime(0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + duration);
}

/* =============== Kitchen Orders List =============== */

async function initKitchenOrdersPage() {
  const ok = await requireKitchenRole();
  if (!ok) return;

  setupKitchenSoundUnlock();

  const loadingEl = document.getElementById('kitchen-loading');
  const emptyEl = document.getElementById('kitchen-empty');
  const listEl = document.getElementById('kitchen-orders');

  let currentFilter = 'active';

  document.querySelectorAll('[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentFilter = btn.dataset.filter;
      loadKitchenOrders(currentFilter, { loadingEl, emptyEl, listEl }, false);
    });
  });

  if (window.AppSocket) {
    AppSocket.onNewOrderForKitchen(() => {
      console.log('[Kitchen] newOrder received → reloading list (socket)');
      playNewOrderSound();
      loadKitchenOrders(currentFilter, { loadingEl, emptyEl, listEl }, true);
    });

    AppSocket.onOrderStatusUpdated(() => {
      console.log('[Kitchen] status updated → reloading list (socket)');
      loadKitchenOrders(currentFilter, { loadingEl, emptyEl, listEl }, true);
    });

    AppSocket.ensureConnected();
  }

  setInterval(() => {
    console.log('[Kitchen] polling refresh for filter:', currentFilter);
    loadKitchenOrders(currentFilter, { loadingEl, emptyEl, listEl }, false);
  }, 10000);

  loadKitchenOrders(currentFilter, { loadingEl, emptyEl, listEl }, false);
}

/**
 * @param {string} filter 'active' | 'new' | 'completed'
 * @param {object} els  { loadingEl, emptyEl, listEl }
 * @param {boolean} fromSocket  true agar socket event se call hua ho
 */
async function loadKitchenOrders(filter, els, fromSocket) {
  const { loadingEl, emptyEl, listEl } = els;

  loadingEl.style.display = 'block';
  emptyEl.style.display = 'none';
  listEl.innerHTML = '';

  try {
    const res = await Api.get(`/orders/kitchen?filter=${filter}`);
    const orders = res.orders || [];

    if (filter === 'active' && !fromSocket) {
      if (lastActiveCount !== null && orders.length > lastActiveCount) {
        console.log(
          '[Kitchen] polling detected new active order(s). Old:',
          lastActiveCount,
          'New:',
          orders.length
        );
        playNewOrderSound();
      }
      lastActiveCount = orders.length;
    }

    if (!orders.length) {
      loadingEl.style.display = 'none';
      emptyEl.style.display = 'block';
      return;
    }

    orders.forEach(order => {
      const card = document.createElement('article');
      card.className = 'order-card';

      const createdAt = formatDateTime(order.createdAt);
      const addrType = order.delivery?.deliveryType || 'DELIVERY';

      const itemsText = (order.items || [])
        .map(it => {
          const base = `${it.productName} (${it.size?.name || ''}) × ${it.quantity}`;
          const addOnPart = formatAddOns(it.addOns);
          return addOnPart === 'No add-ons'
            ? base
            : `${base} | ${addOnPart}`;
        })
        .join('; ');

      card.innerHTML = `
        <div class="order-card-main">
          <div>
            <div class="order-id">#${String(order._id).slice(-6)}</div>
            <div class="order-meta">${createdAt}</div>
            <div class="order-meta">
              ${order.user?.name || ''} (${order.user?.contact || ''})
            </div>
            <div class="order-meta">
              ${addrType === 'DELIVERY' ? 'Delivery' : 'Pickup'}
            </div>
            <div class="order-meta">Items: ${itemsText}</div>
          </div>
          <div class="order-card-right">
            <div class="order-amount">${formatCurrency(order.grandTotal)}</div>
            <div class="order-status-badge status-${order.status.toLowerCase()}">
              ${order.status.replace(/_/g, ' ')}
            </div>
            <div class="kitchen-actions">
              ${renderKitchenActions(order.status, order.delivery?.deliveryType)
                .map(
                  btn =>
                    `<button class="btn btn-secondary kitchen-status-btn" data-status="${btn.status}">
                       ${btn.label}
                     </button>`
                )
                .join('')}
              <button class="btn btn-secondary order-view-btn">
                Details
              </button>
              <button class="btn btn-danger kitchen-delete-btn">
                Delete
              </button>
            </div>
          </div>
        </div>
      `;

      // Status buttons
      card.querySelectorAll('.kitchen-status-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const newStatus = btn.dataset.status;
          updateOrderStatus(order._id, newStatus, () => {
            loadKitchenOrders(filter, els, false);
          });
        });
      });

      // Details button
      card
        .querySelector('.order-view-btn')
        .addEventListener('click', () => {
          localStorage.setItem(KITCHEN_CURRENT_ORDER_KEY, order._id);
          const target = `order-details.html?id=${encodeURIComponent(
            order._id
          )}`;
          console.log('Kitchen navigating to order details:', target);
          window.location.href = target;
        });

      // Delete button
      const deleteBtn = card.querySelector('.kitchen-delete-btn');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
          deleteOrder(order._id, () => {
            loadKitchenOrders(filter, els, false);
          });
        });
      }

      listEl.appendChild(card);
    });
  } catch (err) {
    console.error('Kitchen load error', err);
    loadingEl.textContent =
      err.message || 'Unable to load orders. Please try again later.';
  } finally {
    loadingEl.style.display = 'none';
  }
}

function renderKitchenActions(status, deliveryType) {
  const type = deliveryType || 'DELIVERY';

  if (type === 'PICKUP') {
    switch (status) {
      case 'PLACED':
        return [{ status: 'BAKING', label: 'Start Baking' }];
      case 'BAKING':
        return [{ status: 'DELIVERED', label: 'Ready for Pickup' }];
      default:
        return [];
    }
  }

  switch (status) {
    case 'PLACED':
      return [{ status: 'BAKING', label: 'Start Baking' }];
    case 'BAKING':
      return [{ status: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' }];
    case 'OUT_FOR_DELIVERY':
      return [{ status: 'DELIVERED', label: 'Mark Delivered' }];
    default:
      return [];
  }
}

async function updateOrderStatus(id, newStatus, onDone) {
  if (
    !confirm(
      `Are you sure you want to change order ${String(id).slice(
        -6
      )} status to "${newStatus.replace(/_/g, ' ')}"?`
    )
  ) {
    return;
  }

  try {
    await Api.patch(`/orders/${id}/status`, { status: newStatus });
    onDone && onDone();
  } catch (err) {
    alert(err.message || 'Unable to update order status.');
  }
}

// Delete helper
async function deleteOrder(id, onDone) {
  if (
    !confirm(
      `Are you sure you want to permanently delete order ${String(id).slice(
        -6
      )}?`
    )
  ) {
    return;
  }

  try {
    await Api.delete(`/orders/${id}`);
    onDone && onDone();
  } catch (err) {
    console.error('deleteOrder error', err);
    alert(err.message || 'Unable to delete the order.');
  }
}

/* =============== Kitchen Order Detail =============== */

async function initKitchenOrderDetailPage() {
  const ok = await requireKitchenRole();
  if (!ok) return;

  const params = new URLSearchParams(window.location.search);
  let id = params.get('id');

  if (!id) {
    id = localStorage.getItem(KITCHEN_CURRENT_ORDER_KEY) || null;
  }

  console.log('Kitchen order-details id:', id);

  if (!id) {
    alert(
      'Order ID is missing. Please open this page from the Kitchen Orders screen.'
    );
    window.location.href = 'orders.html';
    return;
  }

  const container = document.getElementById('kitchen-order-detail');
  const loadingEl = document.getElementById('kitchen-order-loading');

  loadingEl.style.display = 'block';

  try {
    const res = await Api.get(`/orders/${id}`);
    const order = res.order;
    if (!order) {
      loadingEl.textContent = 'Order not found.';
      return;
    }

    const itemsHtml = (order.items || [])
      .map(it => {
        const addOnsText = formatAddOns(it.addOns);
        return `
          <li>
            <strong>${it.productName}</strong> 
            (${it.size?.name || ''}, ${it.crust?.name || ''}) 
            × ${it.quantity}
            <br />
            <span style="font-size:0.8rem;color:#666">
              Add-ons: ${addOnsText}
            </span>
          </li>
        `;
      })
      .join('');

    const paymentType =
      order.payment?.paymentType === 'PAYU'
        ? 'Online (PayU)'
        : 'Cash on Delivery (COD)';

    const paymentStatus = order.payment?.paymentStatus || 'PENDING';

    const deliveryType =
      order.delivery?.deliveryType === 'PICKUP' ? 'Pickup' : 'Delivery';

    container.innerHTML = `
      <h2>Order #${String(order._id).slice(-6)}</h2>
      <p>${formatDateTime(order.createdAt)}</p>
      <p>Customer: ${order.user?.name || ''} (${order.user?.contact || ''})</p>
      <p>Order Type: ${deliveryType}</p>
      <p>Status: ${order.status}</p>
      <p>
        <strong>Payment:</strong> ${paymentType} 
        <span style="font-size:0.9rem; color:#555;">(${paymentStatus})</span>
      </p>
      <p><strong>Total Amount:</strong> ${formatCurrency(order.grandTotal)}</p>

      <h3>Items</h3>
      <ul>${itemsHtml}</ul>
    `;
  } catch (err) {
    console.error('Kitchen order detail error', err);
    loadingEl.textContent =
      err.message || 'Unable to load order details right now.';
  } finally {
    loadingEl.style.display = 'none';
  }
}