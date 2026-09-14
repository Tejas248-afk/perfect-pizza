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

/**
 * Combo ko list / KOT me ek line me dikhane ke liye
 * - Agar comboSelections hai to usko priority se use karte hain
 *   Example: "Pizza: Paneer Onion Pizza, Side: Burger, Beverages: ColdDrink 250ml"
 * - Warna purane comboItems (name + quantity) use karte hain
 */
function formatComboItems(comboItems, comboSelections) {
  const selections = Array.isArray(comboSelections)
    ? comboSelections
    : [];

  if (selections.length) {
    return selections
      .map(sel => {
        const label = sel.label || '';
        const title = sel.groupTitle || sel.groupKey || '';
        return title ? `${title}: ${label}` : label;
      })
      .filter(Boolean)
      .join(', ');
  }

  if (!Array.isArray(comboItems) || !comboItems.length) return '';
  return comboItems
    .map(ci => {
      const qty = Number(ci.quantity || 1);
      return `${ci.name}${qty > 1 ? ` × ${qty}` : ''}`;
    })
    .join(', ');
}

const KITCHEN_CURRENT_ORDER_KEY = 'pp_kitchen_current_order_id';

let lastActiveCount = null;
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

/* ---------- Loud triple beep on new order ---------- */

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
  const now = ctx.currentTime;

  const beepCount = 3;
  const beepDuration = 0.3; // seconds
  const gap = 0.1;

  for (let i = 0; i < beepCount; i++) {
    const start = now + i * (beepDuration + gap);
    const end = start + beepDuration;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.value = 1000; // 1 kHz

    gain.gain.setValueAtTime(0.8, start);
    gain.gain.exponentialRampToValueAtTime(0.001, end);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(start);
    osc.stop(end);
  }
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
      playNewOrderSound();
      loadKitchenOrders(currentFilter, { loadingEl, emptyEl, listEl }, true);
    });

    AppSocket.onOrderStatusUpdated(() => {
      loadKitchenOrders(currentFilter, { loadingEl, emptyEl, listEl }, true);
    });

    AppSocket.ensureConnected();
  }

  setInterval(() => {
    loadKitchenOrders(currentFilter, { loadingEl, emptyEl, listEl }, false);
  }, 30000);

  loadKitchenOrders(currentFilter, { loadingEl, emptyEl, listEl }, false);
}

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
          const sizeName = it.size?.name || '';
          const base = `${it.productName} (${sizeName}) × ${it.quantity}`;
          const addOnPart = formatAddOns(it.addOns);
          const comboPart = formatComboItems(
            it.comboItems,
            it.comboSelections
          );
          const parts = [base];

          if (comboPart) parts.push(`Combo: ${comboPart}`);
          if (addOnPart !== 'No add-ons') parts.push(addOnPart);

          return parts.join(' | ');
        })
        .join('; ');

      const shortAddress =
        addrType === 'DELIVERY'
          ? (order.delivery?.address || '').slice(0, 40)
          : '';

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
              ${shortAddress ? ` - ${shortAddress}...` : ''}
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
              <button class="btn btn-secondary kitchen-print-btn">
                Print KOT
              </button>
              <button class="btn btn-danger kitchen-delete-btn">
                Delete
              </button>
            </div>
          </div>
        </div>
      `;

      card.querySelectorAll('.kitchen-status-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const newStatus = btn.dataset.status;
          updateOrderStatus(order._id, newStatus, () => {
            loadKitchenOrders(filter, els, false);
          });
        });
      });

      card
        .querySelector('.order-view-btn')
        .addEventListener('click', () => {
          localStorage.setItem(KITCHEN_CURRENT_ORDER_KEY, order._id);
          const target = `order-details.html?id=${encodeURIComponent(
            order._id
          )}`;
          window.location.href = target;
        });

      const printBtn = card.querySelector('.kitchen-print-btn');
      if (printBtn) {
        printBtn.addEventListener('click', () => {
          printKitchenKot(order);
        });
      }

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

/* ---------- SIMPLE KOT PRINT (TEXT-BASED) ---------- */

function printKitchenKot(order) {
  const win = window.open('', '_blank', 'width=400,height=600');
  if (!win) {
    alert('Popup blocked. Please allow popups to print KOT.');
    return;
  }

  const lines = [];

  lines.push('*** KITCHEN ORDER TICKET ***');
  lines.push('KOT # ' + String(order._id).slice(-6));
  lines.push('');

  lines.push('Branch: ' + (order.outletName || 'Perfect Pizza'));
  lines.push('Time:   ' + formatDateTime(order.createdAt));
  lines.push('Customer: ' + (order.user?.name || 'Walk-in'));
  lines.push(
    'Type: ' +
      (order.delivery?.deliveryType === 'PICKUP'
        ? 'PICKUP'
        : 'DELIVERY')
  );

  if (order.delivery?.deliveryType === 'DELIVERY') {
    lines.push('Address: ' + (order.delivery.address || ''));
    if (order.delivery.landmark) {
      lines.push('Landmark: ' + order.delivery.landmark);
    }
  }

  lines.push('');
  lines.push('ITEMS:');
  (order.items || []).forEach(it => {
    const sizeName = it.size?.name || '';
    lines.push(
      `- ${it.productName} (${sizeName}) × ${it.quantity}`
    );

    const comboText = formatComboItems(
      it.comboItems,
      it.comboSelections
    );
    if (comboText) {
      lines.push('    Combo: ' + comboText);
    }

    const addOnText = formatAddOns(it.addOns);
    if (addOnText !== 'No add-ons') {
      lines.push('    Add-ons: ' + addOnText);
    }
  });

  lines.push('');
  lines.push('*** END OF KITCHEN TICKET ***');

  win.document.write(
    '<pre style="font-family: monospace; font-size: 12px; white-space: pre-wrap;">' +
      lines.join('\n') +
      '</pre>'
  );
  win.document.close();
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
        const sizeName = it.size?.name || '';
        const crustName = it.crust?.name || '';

        let comboItems = Array.isArray(it.comboItems) ? it.comboItems : [];
        let addOns = Array.isArray(it.addOns) ? it.addOns : [];
        const comboSelections = Array.isArray(it.comboSelections)
          ? it.comboSelections
          : [];

        // Purana fallback: agar dono empty hain aur category COMBO hai,
        // to addOns ko comboItems treat karo
        if (
          !comboSelections.length &&
          !comboItems.length &&
          it.category === 'COMBO'
        ) {
          comboItems = addOns;
          addOns = [];
        }

        let comboBoxHtml = '';

        if (comboSelections.length) {
          // NEW: Combo details group-wise (Pizza, Side, Beverages...)
          const lines = comboSelections
            .map(cs => {
              const title = cs.groupTitle || cs.groupKey || '';
              const label = cs.label || '';
              return `<li>${
                title ? `<strong>${title}:</strong> ` : ''
              }${label}</li>`;
            })
            .join('');

          comboBoxHtml = `
            <div class="kitchen-detail-box">
              <div class="kitchen-detail-box-title">Combo details:</div>
              <ul class="kitchen-detail-list">
                ${lines}
              </ul>
            </div>
          `;
        } else if (comboItems.length) {
          // Legacy combo items list
          const comboLines = comboItems
            .map(ci => {
              const q = Number(ci.quantity || 1);
              return `<li>${ci.name}${q > 1 ? ` × ${q}` : ''}</li>`;
            })
            .join('');

          comboBoxHtml = `
            <div class="kitchen-detail-box">
              <div class="kitchen-detail-box-title">Combo items:</div>
              <ul class="kitchen-detail-list">
                ${comboLines}
              </ul>
            </div>
          `;
        }

        const addOnLines = addOns.length
          ? addOns
              .map(a => {
                const q = Number(a.quantity || 1);
                return `<li>${a.name}${q > 1 ? ` × ${q}` : ''}</li>`;
              })
              .join('')
          : '<li>No add-ons</li>';

        return `
          <article class="kitchen-detail-item">
            <div class="kitchen-detail-item-header">
              <strong>${it.productName}</strong>
              <span class="kitchen-detail-item-qty">× ${it.quantity}</span>
            </div>
            <div class="kitchen-detail-item-sub">
              ${
                sizeName
                  ? `Size: <strong>${sizeName}</strong>`
                  : ''
              }
              ${
                crustName
                  ? ` | Crust: <strong>${crustName}</strong>`
                  : ''
              }
            </div>

            ${comboBoxHtml}

            <div class="kitchen-detail-box">
              <div class="kitchen-detail-box-title">Add-ons:</div>
              <ul class="kitchen-detail-list">
                ${addOnLines}
              </ul>
            </div>
          </article>
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

    let deliveryInfoHtml = '';
    if (order.delivery?.deliveryType === 'DELIVERY') {
      const addr = order.delivery.address || '';
      const landmark = order.delivery.landmark || '';
      deliveryInfoHtml = `
        <p><strong>Delivery Address:</strong><br />
          ${addr}<br />
          <span style="font-size:0.85rem;color:#666;">
            ${landmark || ''}
          </span>
        </p>
      `;
    } else {
      deliveryInfoHtml = `
        <p><strong>Pickup:</strong> Customer will collect from outlet.</p>
      `;
    }

    const placedAt = order.placedAt || order.createdAt;
    const bakingAt = order.bakingAt;
    const outForDeliveryAt = order.outForDeliveryAt;
    const deliveredAt = order.deliveredAt;

    const timelineHtml = `
      <h3>Status Timeline</h3>
      <ul class="status-timeline">
        <li><strong>Placed:</strong> ${
          placedAt ? formatDateTime(placedAt) : '-'
        }</li>
        <li><strong>Baking:</strong> ${
          bakingAt ? formatDateTime(bakingAt) : '-'
        }</li>
        <li><strong>Out for Delivery:</strong> ${
          outForDeliveryAt ? formatDateTime(outForDeliveryAt) : '-'
        }</li>
        <li><strong>Delivered:</strong> ${
          deliveredAt ? formatDateTime(deliveredAt) : '-'
        }</li>
      </ul>
    `;

    container.innerHTML = `
      <h2>Order #${String(order._id).slice(-6)}</h2>
      <p>${formatDateTime(order.createdAt)}</p>
      <p>Customer: ${order.user?.name || ''} (${order.user?.contact || ''})</p>
      <p>Order Type: ${deliveryType}</p>

      ${deliveryInfoHtml}

      <p>Status: ${order.status}</p>
      <p>
        <strong>Payment:</strong> ${paymentType} 
        <span style="font-size:0.9rem; color:#555;">(${paymentStatus})</span>
      </p>

      ${timelineHtml}

      <p><strong>Total Amount:</strong> ${formatCurrency(order.grandTotal)}</p>

      <h3>Items</h3>
      ${itemsHtml}
    `;
  } catch (err) {
    console.error('Kitchen order detail error', err);
    loadingEl.textContent =
      err.message || 'Unable to load order details right now.';
  } finally {
    loadingEl.style.display = 'none';
  }
}