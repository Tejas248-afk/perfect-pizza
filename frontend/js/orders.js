// Customer orders (list + details + realtime updates)

const CURRENT_ORDER_KEY = 'pp_current_order_id';

document.addEventListener('DOMContentLoaded', () => {
  if (typeof setupAuthNav === 'function') {
    setupAuthNav();
  }

  if (document.getElementById('orders-list')) {
    initOrdersListPage();
  }

  if (document.getElementById('order-detail')) {
    initOrderDetailPage();
  }
});

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

function formatCurrency(v) {
  return `₹${Number(v || 0).toFixed(0)}`;
}

/* ======================  MY ORDERS LIST  ====================== */

async function initOrdersListPage() {
  if (!Api.getToken()) {
    alert('Orders dekhne ke liye login zaroori hai.');
    window.location.href = 'login.html';
    return;
  }

  // Socket.IO – status update aate hi list reload
  if (window.AppSocket && typeof AppSocket.onOrderStatusUpdated === 'function') {
    AppSocket.onOrderStatusUpdated(() => {
      console.log('[Customer] status updated → refresh orders list');
      loadOrdersList();
    });
    AppSocket.ensureConnected();
  }

  await loadOrdersList();
}

async function loadOrdersList() {
  const listEl = document.getElementById('orders-list');
  const emptyEl = document.getElementById('orders-empty');
  const loadingEl = document.getElementById('orders-loading');

  if (!listEl || !emptyEl || !loadingEl) return;

  loadingEl.style.display = 'block';
  emptyEl.style.display = 'none';
  listEl.innerHTML = '';

  try {
    const res = await Api.get('/orders/my');
    const orders = res.orders || [];

    if (!orders.length) {
      loadingEl.style.display = 'none';
      emptyEl.style.display = 'block';
      return;
    }

    orders.forEach(order => {
      const card = document.createElement('article');
      card.className = 'order-card';

      const createdAt = formatDateTime(order.createdAt);
      const paymentType = order.payment?.paymentType || 'COD';
      const paymentStatus = order.payment?.paymentStatus || 'PENDING';

      card.innerHTML = `
        <div class="order-card-main">
          <div>
            <div class="order-id">Order #${String(order._id).slice(-6)}</div>
            <div class="order-meta">${createdAt}</div>
            <div class="order-meta">
              Payment: ${paymentType} (${paymentStatus})
            </div>
          </div>
          <div class="order-card-right">
            <div class="order-amount">${formatCurrency(order.grandTotal)}</div>
            <div class="order-status-badge status-${order.status.toLowerCase()}">
              ${order.status.replace(/_/g, ' ')}
            </div>
            <button class="btn btn-secondary order-view-btn">
              View details
            </button>
            <button class="btn btn-danger order-delete-btn">
              Delete
            </button>
          </div>
        </div>
      `;

      // Details
      card
        .querySelector('.order-view-btn')
        .addEventListener('click', () => {
          localStorage.setItem(CURRENT_ORDER_KEY, order._id);
          const target = `order-details.html?id=${encodeURIComponent(
            order._id
          )}`;
          console.log('Navigating to order details:', target);
          window.location.href = target;
        });

      // Delete
      const deleteBtn = card.querySelector('.order-delete-btn');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
          deleteMyOrder(order._id, () => {
            loadOrdersList();
          });
        });
      }

      listEl.appendChild(card);
    });
  } catch (err) {
    console.error('Load orders error', err);
    loadingEl.textContent =
      err.message || 'Orders load nahi ho paaye, thodi der baad try karein.';
  } finally {
    loadingEl.style.display = 'none';
  }
}

async function deleteMyOrder(id, onDone) {
  if (
    !confirm(
      `Kya aap order ${String(id).slice(
        -6
      )} ko permanently delete karna chahte hain?`
    )
  ) {
    return;
  }

  try {
    await Api.delete(`/orders/${id}`);
    onDone && onDone();
  } catch (err) {
    console.error('Delete my order error', err);
    alert(err.message || 'Order delete nahi ho paaya.');
  }
}

/* ======================  TIMELINE + ETA HELPERS  ====================== */

function getTimelineSteps(status, deliveryType) {
  const type = deliveryType || 'DELIVERY';

  if (type === 'PICKUP') {
    const steps = [
      { key: 'PLACED', label: 'Order Placed' },
      { key: 'BAKING', label: 'Baking' },
      { key: 'DELIVERED', label: 'Ready for Pickup' }
    ];

    let activeIndex = 0;

    if (status === 'BAKING') activeIndex = 1;
    else if (status === 'DELIVERED') activeIndex = 2;
    else if (status === 'CANCELLED') activeIndex = -1;

    return { steps, activeIndex };
  }

  const steps = [
    { key: 'PLACED', label: 'Order Placed' },
    { key: 'BAKING', label: 'Baking' },
    { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' },
    { key: 'DELIVERED', label: 'Delivered' }
  ];

  let activeIndex = 0;

  if (status === 'BAKING') activeIndex = 1;
  else if (status === 'OUT_FOR_DELIVERY') activeIndex = 2;
  else if (status === 'DELIVERED') activeIndex = 3;
  else if (status === 'CANCELLED') activeIndex = -1;

  return { steps, activeIndex };
}

function getEtaInfo(order) {
  if (!order || !order.createdAt) return null;
  const created = new Date(order.createdAt);
  if (Number.isNaN(created.getTime())) return null;

  const type = order.delivery?.deliveryType || 'DELIVERY';
  const minutes = type === 'PICKUP' ? 20 : 35;

  const eta = new Date(created.getTime() + minutes * 60000);
  const timeStr = eta.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit'
  });

  return {
    type,
    minutes,
    time: timeStr,
    label: type === 'PICKUP' ? 'Pickup by' : 'Estimated delivery by'
  };
}

/* ======================  ORDER DETAILS  ====================== */

async function initOrderDetailPage() {
  console.log('order-details URL:', window.location.href);

  const params = new URLSearchParams(window.location.search);
  let id = params.get('id');

  if (!id) {
    id = localStorage.getItem(CURRENT_ORDER_KEY) || null;
  }

  console.log('order-details id param / stored:', id);

  if (!id) {
    alert(
      'Order ID missing hai. Pehle "My Orders" page se kisi order par "View details" dabayein.'
    );
    window.location.href = 'orders.html';
    return;
  }

  if (!Api.getToken()) {
    alert('Order details dekhne ke liye login zaroori hai.');
    window.location.href = 'login.html';
    return;
  }

  const container = document.getElementById('order-detail');
  const loadingEl = document.getElementById('order-loading');

  if (!container || !loadingEl) return;

  loadingEl.style.display = 'block';
  container.innerHTML = '';

  if (window.AppSocket && typeof AppSocket.onOrderStatusUpdated === 'function') {
    AppSocket.onOrderStatusUpdated(order => {
      if (order && String(order._id) === String(id)) {
        console.log('[Customer] detail page: status updated → refetch');
        fetchAndRenderOrder(id, container, loadingEl, false);
      }
    });
    AppSocket.ensureConnected();
  }

  await fetchAndRenderOrder(id, container, loadingEl, true);
}

async function fetchAndRenderOrder(id, container, loadingEl, hideLoaderOnEnd) {
  try {
    const res = await Api.get(`/orders/${id}`);
    const order = res.order;

    if (!order) {
      loadingEl.textContent = 'Order not found.';
      return;
    }

    renderOrderDetail(order, container);
  } catch (err) {
    console.error('Order detail error', err);
    loadingEl.textContent =
      err.message || 'Order details load nahi ho paaye.';
  } finally {
    if (hideLoaderOnEnd && loadingEl) {
      loadingEl.style.display = 'none';
    }
  }
}

function renderOrderDetail(order, container) {
  const createdAt = formatDateTime(order.createdAt);
  const deliveryType = order.delivery?.deliveryType || 'DELIVERY';
  const { steps, activeIndex } = getTimelineSteps(order.status, deliveryType);
  const isCancelled = order.status === 'CANCELLED';

  const itemsHtml = (order.items || [])
    .map(item => {
      const addOnsText =
        (item.addOns || []).length > 0
          ? item.addOns
              .map(
                a =>
                  `${a.name}${(a.quantity || 1) > 1 ? ` × ${a.quantity}` : ''}`
              )
              .join(', ')
          : 'No add-ons';

      return `
        <div class="order-item-row">
          <div>
            <div class="order-item-title">
              ${item.productName}
              <span class="badge ${
                item.isVeg ? 'badge-veg' : 'badge-nonveg'
              }">${item.isVeg ? 'Veg' : 'Non-Veg'}</span>
            </div>
            <div class="order-item-meta">
              ${item.size?.name || ''} • ${item.crust?.name || ''}
            </div>
            <div class="order-item-meta">Add-ons: ${addOnsText}</div>
          </div>
          <div class="order-item-price">
            <span>${formatCurrency(item.unitPrice)} × ${item.quantity}</span>
            <strong>${formatCurrency(item.itemTotal)}</strong>
          </div>
        </div>
      `;
    })
    .join('');

  const addr =
    order.delivery?.deliveryType === 'DELIVERY'
      ? `
        <p>${order.delivery.address || ''}</p>
        <p>${order.delivery.landmark || ''}</p>
        <p>
          Distance: ${order.delivery.distance?.toFixed(2) || 0} km
        </p>
      `
      : '<p>Outlet Pickup — No delivery fee.</p>';

  const etaInfo = getEtaInfo(order);
  let etaHtml = '';
  if (etaInfo) {
    etaHtml = `<p>${etaInfo.label}: <strong>${etaInfo.time}</strong> (~${etaInfo.minutes} min)</p>`;
  }

  const subtotal = order.subtotal ?? 0;
  const deliveryFee = order.deliveryFee ?? 0;
  const rewardDiscount = order.rewardDiscount ?? 0;
  const taxAmount = order.taxAmount ?? 0;
  const grandTotal =
    order.grandTotal ??
    subtotal + deliveryFee + taxAmount - rewardDiscount;

  container.innerHTML = `
    <header class="order-detail-header">
      <div>
        <div class="order-id">Order #${order._id}</div>
        <div class="order-meta">${createdAt}</div>
      </div>
      <div class="order-detail-right>
        <div class="order-amount">${formatCurrency(grandTotal)}</div>
        <div class="order-status-badge status-${order.status.toLowerCase()}">
          ${order.status.replace(/_/g, ' ')}
        </div>
      </div>
    </header>

    <section class="order-timeline">
      ${isCancelled ? '<p class="cancelled-text">This order was cancelled.</p>' : ''}
      <div class="timeline">
        ${steps
          .map((step, index) => {
            const state =
              activeIndex === -1
                ? 'inactive'
                : index < activeIndex
                  ? 'completed'
                  : index === activeIndex
                    ? 'current'
                    : 'upcoming';

            return `
              <div class="timeline-step timeline-${state}">
                <div class="timeline-dot"></div>
                <div class="timeline-label">${step.label}</div>
              </div>
            `;
          })
          .join('')}
      </div>
    </section>

    <section class="order-section">
      <h2>Items</h2>
      ${itemsHtml}
    </section>

    <section class="order-section two-column">
      <div>
        <h2>Delivery</h2>
        ${addr}
        ${etaHtml}
      </div>
      <div>
        <h2>Payment & Summary</h2>
        <p>Payment type: ${order.payment?.paymentType || 'COD'}</p>
        <p>Payment status: ${order.payment?.paymentStatus || 'PENDING'}</p>

        <div class="summary-row">
          <span>Subtotal</span>
          <strong>${formatCurrency(subtotal)}</strong>
        </div>
        <div class="summary-row">
          <span>Delivery fee</span>
          <strong>${formatCurrency(deliveryFee)}</strong>
        </div>
        <div class="summary-row">
          <span>Reward discount</span>
          <strong>- ${formatCurrency(rewardDiscount)}</strong>
        </div>
        <div class="summary-row">
          <span>GST (5%)</span>
          <strong>${formatCurrency(taxAmount)}</strong>
        </div>
        <div class="summary-row summary-total">
          <span>Grand total</span>
          <strong>${formatCurrency(grandTotal)}</strong>
        </div>

        <p class="summary-note" style="margin-top:0.5rem">
          Reward coins used: ${order.rewardCoinsUsed || 0},
          earned: ${order.rewardCoinsEarned || 0}.
        </p>
      </div>
    </section>
  `;
}