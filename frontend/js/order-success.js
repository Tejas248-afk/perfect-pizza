document.addEventListener('DOMContentLoaded', () => {
  if (typeof setupAuthNav === 'function') {
    setupAuthNav();
  }
  loadOrderAndRender();
});

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

async function loadOrderAndRender() {
  const invoiceEl = document.getElementById('invoice');
  const orderId = getQueryParam('orderId');

  if (!invoiceEl) return;

  if (!orderId) {
    invoiceEl.innerHTML = '<p>Order ID is missing.</p>';
    return;
  }

  try {
    const res = await Api.get(`/orders/${orderId}`);
    const order = res.order;
    renderInvoice(order);
  } catch (err) {
    console.error('Failed to load order', err);
    invoiceEl.innerHTML =
      '<p>Unable to load order details. Please try again later.</p>';
  }
}

function renderInvoice(order) {
  const invoiceEl = document.getElementById('invoice');
  if (!invoiceEl || !order) return;

  const created = new Date(order.createdAt);
  const dateStr = created.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  const itemsRows = (order.items || [])
    .map(
      item => `
      <tr>
        <td>
          <strong>${item.productName}</strong><br />
          <small>${item.size?.name || ''} • ${item.crust?.name || ''}</small><br />
          ${
            (item.addOns || []).length
              ? `<small>Add-ons: ${item.addOns
                  .map(a => `${a.name}${a.quantity > 1 ? ` × ${a.quantity}` : ''}`)
                  .join(', ')}</small>`
              : ''
          }
        </td>
        <td style="text-align:center;">${item.quantity}</td>
        <td style="text-align:right;">₹${Number(item.unitPrice || 0).toFixed(0)}</td>
        <td style="text-align:right;">₹${Number(item.itemTotal || 0).toFixed(0)}</td>
      </tr>
    `
    )
    .join('');

  const subtotal = Number(order.subtotal || 0);
  const offerDiscount = Number(order.offerDiscount || 0);
  const couponDiscount = Number(order.couponDiscount || 0);
  const rewardDiscount = Number(order.rewardDiscount || 0);
  const deliveryFee = Number(order.deliveryFee || 0);
  const taxAmount = Number(order.taxAmount || 0);
  const grandTotal = Number(order.grandTotal || 0);

  const totalOfferDiscount = offerDiscount + couponDiscount;

  invoiceEl.innerHTML = `
    <div class="invoice-header">
      <div>
        <h2>Perfect Pizza</h2>
        <p>${order.outletName || 'Singhpur Chauraha, Kalyanpur'}</p>
        <p>Phone: 9889229198</p>
      </div>
      <div style="text-align:right;">
        <p><strong>Order ID:</strong> ${order._id}</p>
        <p><strong>Date:</strong> ${dateStr}</p>
        <p><strong>Payment:</strong> ${order.payment?.paymentType || 'COD'} (${order.payment?.paymentStatus || 'PENDING'})</p>
        <p><strong>Status:</strong> ${order.status}</p>
      </div>
    </div>

    <hr />

    <table class="invoice-items">
      <thead>
        <tr>
          <th>Item</th>
          <th style="text-align:center;">Qty</th>
          <th style="text-align:right;">Price</th>
          <th style="text-align:right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <hr />

    <div class="invoice-summary">
      <div class="invoice-summary-left">
        ${
          order.delivery?.deliveryType === 'DELIVERY'
            ? `
            <p><strong>Delivery Address</strong><br />
              ${order.delivery.address || ''}<br />
              ${order.delivery.landmark || ''}
            </p>
          `
            : `
            <p><strong>Pickup</strong><br />
              Collect your order from the outlet.
            </p>
          `
        }
      </div>
      <div class="invoice-summary-right">
        <div class="summary-row">
          <span>Items subtotal</span>
          <strong>₹${subtotal.toFixed(0)}</strong>
        </div>
        <div class="summary-row">
          <span>Offer discount</span>
          <strong>${totalOfferDiscount ? `-₹${totalOfferDiscount.toFixed(0)}` : '₹0'}</strong>
        </div>
        <div class="summary-row">
          <span>Reward discount</span>
          <strong>${rewardDiscount ? `-₹${rewardDiscount.toFixed(0)}` : '₹0'}</strong>
        </div>
        <div class="summary-row">
          <span>Delivery fee</span>
          <strong>₹${deliveryFee.toFixed(0)}</strong>
        </div>
        <div class="summary-row">
          <span>GST (5%)</span>
          <strong>₹${taxAmount.toFixed(0)}</strong>
        </div>
        <div class="summary-row summary-total">
          <span>Grand total</span>
          <strong>₹${grandTotal.toFixed(0)}</strong>
        </div>
      </div>
    </div>
  `;
}