let rewardsInfo = {
  availableCoins: 0,
  rupeeValue: 0,
  rules: null
};

let latestPreview = null;
let previewTimeout = null;

document.addEventListener('DOMContentLoaded', () => {
  // Agar yeh page nahi hai to kuch mat karo
  if (!document.getElementById('place-order-btn')) {
    return;
  }

  if (typeof setupAuthNav === 'function') {
    setupAuthNav();
  }
  initCheckoutPage();
});

function initCheckoutPage() {
  const cartItems = Cart.getItems();

  if (!cartItems.length) {
    alert('Cart khali hai. Pehle pizza add karein.');
    window.location.href = 'menu.html';
    return;
  }

  if (!Api.getToken()) {
    alert('Checkout ke liye login zaroori hai.');
    window.location.href = 'login.html';
    return;
  }

  renderCheckoutItems(cartItems);

  // ----- Delivery type radio -----
  const deliveryRadios = document.querySelectorAll(
    'input[name="deliveryType"]'
  );
  const deliverySection = document.getElementById('delivery-address-section');

  if (deliveryRadios.length && deliverySection) {
    deliveryRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        if (radio.value === 'DELIVERY') {
          deliverySection.style.display = 'block';
        } else {
          deliverySection.style.display = 'none';
        }
        schedulePreview();
      });
    });
  } else {
    console.warn(
      'Checkout: deliveryType radios ya delivery-address-section nahi mila'
    );
  }

  // ----- Use location button -----
  const useLocationBtn = document.getElementById('use-location-btn');
  if (useLocationBtn) {
    useLocationBtn.addEventListener('click', handleUseLocation);
  } else {
    console.warn('Checkout: #use-location-btn element nahi mila');
  }

  // ----- Place order button -----
  const placeOrderBtn = document.getElementById('place-order-btn');
  if (placeOrderBtn) {
    placeOrderBtn.addEventListener('click', handlePlaceOrder);
  } else {
    console.warn('Checkout: #place-order-btn element nahi mila');
  }

  // ----- Rewards input -----
  const coinsInput = document.getElementById('coins-to-use');
  if (coinsInput) {
    coinsInput.addEventListener('input', () => {
      if (coinsInput.value < 0) coinsInput.value = 0;
      schedulePreview();
    });
  } else {
    console.warn('Checkout: #coins-to-use element nahi mila');
  }

  // ----- Coupon apply button -----
  const applyCouponBtn = document.getElementById('apply-coupon-btn');
  if (applyCouponBtn) {
    applyCouponBtn.addEventListener('click', () => {
      schedulePreview();
    });
  }

  // ----- Lat / Lng change -----
  const latInput = document.getElementById('latitude');
  const lngInput = document.getElementById('longitude');

  if (latInput) latInput.addEventListener('input', schedulePreview);
  if (lngInput) lngInput.addEventListener('input', schedulePreview);

  loadRewardsAndPreview();
}

function renderCheckoutItems(items) {
  const container = document.getElementById('checkout-items');
  const subtotalEl = document.getElementById('summary-subtotal');

  if (!container || !subtotalEl) return;

  container.innerHTML = '';
  let subtotal = 0;

  items.forEach(item => {
    const lineTotal =
      Number(item.unitPrice || 0) * Number(item.quantity || 1);
    subtotal += lineTotal;

    const addOnsText = (item.addOns || []).length
      ? item.addOns
          .map(a => `${a.name}${a.quantity > 1 ? ` × ${a.quantity}` : ''}`)
          .join(', ')
      : 'No add-ons';

    const row = document.createElement('div');
    row.className = 'checkout-item';

    row.innerHTML = `
      <div class="checkout-item-main">
        <div>
          <div class="checkout-item-title">
            ${item.productName}
            <span class="badge ${
              item.isVeg ? 'badge-veg' : 'badge-nonveg'
            }">${item.isVeg ? 'Veg' : 'Non-Veg'}</span>
          </div>
          <div class="checkout-item-meta">
            ${item.size?.name || ''} • ${item.crust?.name || ''}
          </div>
          <div class="checkout-item-addons">${addOnsText}</div>
        </div>
        <div class="checkout-item-price">
          <span>₹${Number(item.unitPrice || 0).toFixed(0)} × ${
            item.quantity
          }</span>
          <strong>₹${lineTotal.toFixed(0)}</strong>
        </div>
      </div>
    `;

  container.appendChild(row);
  });

  subtotalEl.textContent = `₹${subtotal.toFixed(0)}`;
}

async function loadRewardsAndPreview() {
  const infoEl = document.getElementById('rewards-info');
  const coinsInput = document.getElementById('coins-to-use');

  try {
    const res = await Api.get('/rewards/balance');
    rewardsInfo = {
      availableCoins: res.coins || 0,
      rupeeValue: res.rupeeValue || 0,
      rules: res.rules || null
    };

    if (coinsInput) {
      coinsInput.max = rewardsInfo.availableCoins;
      coinsInput.value = 0;
    }

    if (infoEl) {
      if (rewardsInfo.availableCoins > 0) {
        infoEl.textContent = `Aapke paas ${
          rewardsInfo.availableCoins
        } coins hain (value ₹${rewardsInfo.rupeeValue.toFixed(
          0
        )}). 2 coins = ₹1 discount.`;
      } else {
        infoEl.textContent =
          'Abhi aapke paas 0 reward coins hain. ₹100 se upar ke order par 20 coins milenge.';
      }
    }
  } catch (err) {
    console.error('Rewards load error', err);
    if (infoEl) {
      infoEl.textContent = 'Reward balance load nahi ho paaya.';
    }
  } finally {
    schedulePreview();
  }
}

function schedulePreview() {
  clearTimeout(previewTimeout);
  previewTimeout = setTimeout(refreshOrderPreview, 400);
}

async function refreshOrderPreview() {
  const subtotalRaw = Cart.getSubtotal();
  const deliveryTypeRadio = document.querySelector(
    'input[name="deliveryType"]:checked'
  );
  const subtotalEl = document.getElementById('summary-subtotal');

  if (!deliveryTypeRadio || !subtotalEl) return;

  const deliveryType = deliveryTypeRadio.value;

  const address = document.getElementById('address')?.value.trim() || '';
  const landmark = document.getElementById('landmark')?.value.trim() || '';
  const latVal = document.getElementById('latitude')?.value.trim() || '';
  const lngVal = document.getElementById('longitude')?.value.trim() || '';
  const coinsInput = document.getElementById('coins-to-use');
  const coinsToUse = Number(coinsInput?.value || 0);
  const couponInput = document.getElementById('coupon-code');
  const couponCode = couponInput ? couponInput.value.trim() : '';

  // NEW: outletId (multi-outlet support)
  const outletId = localStorage.getItem('pp_outlet_id') || null;

  if (deliveryType === 'DELIVERY') {
    if (!latVal || !lngVal) {
      updateCheckoutSummary(null);
      return;
    }
  }

  const cartItems = Cart.getItems();
  if (!cartItems.length) {
    updateCheckoutSummary(null);
    return;
  }

  const itemsForBackend = cartItems.map(item => ({
    productId: item.productId,
    size: item.size?.name,
    crust: item.crust?.name,
    quantity: item.quantity,
    addOns: (item.addOns || []).map(a => ({
      name: a.name,
      quantity: a.quantity || 1
    }))
  }));

  const payload = {
    outletId, // <--- yahan se backend ko outlet milega
    items: itemsForBackend,
    deliveryType,
    address: deliveryType === 'DELIVERY' ? address : '',
    landmark: deliveryType === 'DELIVERY' ? landmark : '',
    latitude: deliveryType === 'DELIVERY' ? Number(latVal) : null,
    longitude: deliveryType === 'DELIVERY' ? Number(lngVal) : null,
    rewardCoinsToUse: coinsToUse,
    couponCode
  };

  try {
    const res = await Api.post('/orders/preview', payload);
    latestPreview = res.preview;
    updateCheckoutSummary(res.preview);
  } catch (err) {
    console.error('Preview error', err);
    if (err.status === 400) {
      alert(err.message);
    }
    updateCheckoutSummary(null);
  }
}

async function handleUseLocation() {
  const btn = document.getElementById('use-location-btn');
  if (!btn) return;

  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Fetching...';

  try {
    const pos = await LocationUtil.getCurrentPosition();
    const lat = pos.latitude;
    const lng = pos.longitude;

    const latInput = document.getElementById('latitude');
    const lngInput = document.getElementById('longitude');

    if (latInput) latInput.value = lat.toFixed(6);
    if (lngInput) lngInput.value = lng.toFixed(6);

    const geo = await LocationUtil.reverseGeocode(lat, lng);
    if (geo) {
      const addressInput = document.getElementById('address');
      const landmarkInput = document.getElementById('landmark');

      if (addressInput && !addressInput.value.trim() && geo.fullAddress) {
        addressInput.value = geo.fullAddress;
      }

      if (landmarkInput && !landmarkInput.value.trim()) {
        const parts = [];
        if (geo.area) parts.push(geo.area);
        if (geo.city && !parts.includes(geo.city)) parts.push(geo.city);
        if (parts.length) {
          landmarkInput.value = parts.join(', ');
        }
      }
    }

    schedulePreview();
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

function updateCheckoutSummary(previewOrder) {
  const subtotalRaw = Cart.getSubtotal();
  const subtotalEl = document.getElementById('summary-subtotal');
  const deliveryEl = document.getElementById('summary-delivery');
  const offerEl = document.getElementById('summary-offer');
  const discountEl = document.getElementById('summary-discount'); // coins + coupon
  const gstEl = document.getElementById('summary-gst');
  const totalEl = document.getElementById('summary-total');

  if (
    !subtotalEl ||
    !deliveryEl ||
    !offerEl ||
    !discountEl ||
    !gstEl ||
    !totalEl
  ) {
    return;
  }

  subtotalEl.textContent = `₹${subtotalRaw.toFixed(0)}`;

  const deliveryType = document.querySelector(
    'input[name="deliveryType"]:checked'
  )?.value;

  if (!previewOrder) {
    deliveryEl.textContent = deliveryType === 'PICKUP' ? '₹0' : '—';
    offerEl.textContent = '₹0';
    discountEl.textContent = '₹0';
    gstEl.textContent = '₹0';
    totalEl.textContent = `₹${subtotalRaw.toFixed(0)}`;
    return;
  }

  const deliveryFee = Number(previewOrder.deliveryFee || 0);
  const offerDiscount = Number(previewOrder.offerDiscount || 0);
  const couponDiscount = Number(previewOrder.couponDiscount || 0);
  const rewardDiscount = Number(previewOrder.rewardDiscount || 0);
  const taxAmount = Number(previewOrder.taxAmount || 0);
  const grandTotal = Number(previewOrder.grandTotal || 0);

  deliveryEl.textContent = `₹${deliveryFee.toFixed(0)}`;
  offerEl.textContent = offerDiscount
    ? `-₹${offerDiscount.toFixed(0)}`
    : '₹0';

  const totalExtraDiscount = couponDiscount + rewardDiscount;
  discountEl.textContent = totalExtraDiscount
    ? `-₹${totalExtraDiscount.toFixed(0)}`
    : '₹0';

  gstEl.textContent = `₹${taxAmount.toFixed(0)}`;
  totalEl.textContent = `₹${grandTotal.toFixed(0)}`;
}

async function handlePlaceOrder() {
  const cartItems = Cart.getItems();
  if (!cartItems.length) {
    alert('Cart khali hai.');
    window.location.href = 'menu.html';
    return;
  }

  const deliveryTypeRadio = document.querySelector(
    'input[name="deliveryType"]:checked'
  );
  if (!deliveryTypeRadio) {
    alert('Delivery type select karein.');
    return;
  }
  const deliveryType = deliveryTypeRadio.value;

  // NEW: payment method
  const paymentRadio = document.querySelector(
    'input[name="paymentMethod"]:checked'
  );
  const paymentMethod = paymentRadio ? paymentRadio.value : 'COD';

  const address = document.getElementById('address')?.value.trim() || '';
  const landmark = document.getElementById('landmark')?.value.trim() || '';
  const latVal = document.getElementById('latitude')?.value.trim() || '';
  const lngVal = document.getElementById('longitude')?.value.trim() || '';
  const coinsInput = document.getElementById('coins-to-use');
  const coinsToUse = Number(coinsInput?.value || 0);
  const couponInput = document.getElementById('coupon-code');
  const couponCodeSafe = couponInput ? couponInput.value.trim() : '';

  if (deliveryType === 'DELIVERY') {
    if (!address) {
      alert('Delivery address daalna zaroori hai.');
      return;
    }
    if (!latVal || !lngVal) {
      alert(
        'Latitude/Longitude missing hain. "Use current location" dabayein ya manually daalein.'
      );
      return;
    }
  }

  const itemsForBackend = cartItems.map(item => ({
    productId: item.productId,
    size: item.size?.name,
    crust: item.crust?.name,
    quantity: item.quantity,
    addOns: (item.addOns || []).map(a => ({
      name: a.name,
      quantity: a.quantity || 1
    }))
  }));

  const outletId = localStorage.getItem('pp_outlet_id') || null;

  const payload = {
    outletId,
    items: itemsForBackend,
    deliveryType,
    address: deliveryType === 'DELIVERY' ? address : '',
    landmark: deliveryType === 'DELIVERY' ? landmark : '',
    latitude: deliveryType === 'DELIVERY' ? Number(latVal) : null,
    longitude: deliveryType === 'DELIVERY' ? Number(lngVal) : null,
    rewardCoinsToUse: coinsToUse,
    couponCode: couponCodeSafe
  };

  const btn = document.getElementById('place-order-btn');
  if (!btn) return;

  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Placing order...';

  try {
    if (paymentMethod === 'COD') {
      // ---- COD old flow ----
      const res = await Api.post('/orders/cod', payload);

      Cart.clear();

      alert(
        `Order placed successfully!\nOrder ID: ${res.orderId}\nTotal: ₹${res.order.grandTotal.toFixed(
          0
        )}`
      );

      window.location.href = 'menu.html';
      return;
    }

    // ---- PAYU ONLINE PAYMENT FLOW ----
    const res = await Api.post('/payment/payu/init', payload);
    // res: { orderId, payuUrl, params, hash }

    const { payuUrl, params, hash } = res;

    if (!payuUrl || !params || !hash) {
      alert('Payment init failed, please try again.');
      return;
    }

    // Hidden form banake PayU pe redirect
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = payuUrl;

    function addField(name, value) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      form.appendChild(input);
    }

    Object.keys(params).forEach(key => addField(key, params[key]));
    addField('hash', hash);

    document.body.appendChild(form);

    // Online payment ke liye bhi cart clear kar sakte ho
    Cart.clear();

    form.submit();
  } catch (err) {
    console.error('Create order / payment error', err);
    alert(
      err.message ||
        'Order place nahi ho paaya, thodi der baad dobara try karein.'
    );
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}