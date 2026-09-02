(function () {
  const CART_KEY = 'pp_cart';
  const MAX_ITEM_QUANTITY = 20;

  function safeNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function buildConfigurationKey(item) {
    const addOnKey = (item.addOns || [])
      .map(addOn => {
        return `${addOn.name}:${safeNumber(addOn.quantity, 1)}`;
      })
      .sort()
      .join('|');

    return [
      item.productId,
      item.size?.name || '',
      item.crust?.name || '',
      addOnKey
    ].join('::');
  }

  function getItems() {
    const rawCart = localStorage.getItem(CART_KEY);

    if (!rawCart) {
      return [];
    }

    try {
      const parsedCart = JSON.parse(rawCart);
      return Array.isArray(parsedCart) ? parsedCart : [];
    } catch (error) {
      console.error('Invalid cart data:', error);
      localStorage.removeItem(CART_KEY);
      return [];
    }
  }

  function saveItems(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items));

    window.dispatchEvent(
      new CustomEvent('pp:cart-updated', {
        detail: {
          items
        }
      })
    );
  }

  function addItem(item) {
    if (!item || !item.productId) {
      throw new Error('Invalid product');
    }

    const quantity = Math.max(
      1,
      Math.min(MAX_ITEM_QUANTITY, safeNumber(item.quantity, 1))
    );

    const normalizedItem = {
      ...item,
      quantity,
      unitPrice: safeNumber(item.unitPrice),
      addOns: Array.isArray(item.addOns) ? item.addOns : []
    };

    normalizedItem.key = buildConfigurationKey(normalizedItem);

    const items = getItems();
    const existingItem = items.find(
      cartItem => cartItem.key === normalizedItem.key
    );

    if (existingItem) {
      existingItem.quantity = Math.min(
        MAX_ITEM_QUANTITY,
        safeNumber(existingItem.quantity, 1) + quantity
      );

      // Latest menu display price update kar rahe hain.
      // Backend checkout me dobara actual price calculate karega.
      existingItem.unitPrice = normalizedItem.unitPrice;
    } else {
      items.push(normalizedItem);
    }

    saveItems(items);
    return items;
  }

  function updateQuantity(key, quantity) {
    const items = getItems();
    const item = items.find(cartItem => cartItem.key === key);

    if (!item) {
      return items;
    }

    const newQuantity = safeNumber(quantity, 1);

    if (newQuantity <= 0) {
      return removeItem(key);
    }

    item.quantity = Math.min(MAX_ITEM_QUANTITY, newQuantity);
    saveItems(items);

    return items;
  }

  function removeItem(key) {
    const items = getItems().filter(item => item.key !== key);
    saveItems(items);

    return items;
  }

  function clear() {
    saveItems([]);
  }

  function getCount() {
    return getItems().reduce((total, item) => {
      return total + safeNumber(item.quantity, 0);
    }, 0);
  }

  function getSubtotal() {
    return getItems().reduce((total, item) => {
      return (
        total +
        safeNumber(item.unitPrice, 0) * safeNumber(item.quantity, 0)
      );
    }, 0);
  }

  function updateCartBadges() {
    const count = getCount();

    document.querySelectorAll('[data-cart-count]').forEach(element => {
      element.textContent = count;
      element.setAttribute('aria-label', `${count} cart items`);
    });
  }

  function renderCartPage() {
    const cartItemsElement = document.getElementById('cart-items');

    if (!cartItemsElement) {
      updateCartBadges();
      return;
    }

    const emptyElement = document.getElementById('cart-empty');
    const contentElement = document.getElementById('cart-content');
    const subtotalElement = document.getElementById('cart-subtotal');
    const itemCountElement = document.getElementById('cart-item-count');
    const clearButton = document.getElementById('clear-cart-btn');
    const checkoutButton = document.getElementById('checkout-btn');

    const items = getItems();
    cartItemsElement.innerHTML = '';

    if (!items.length) {
      emptyElement.style.display = 'block';
      contentElement.style.display = 'none';
      updateCartBadges();
      return;
    }

    emptyElement.style.display = 'none';
    contentElement.style.display = 'grid';

    items.forEach(item => {
      const itemTotal =
        safeNumber(item.unitPrice) * safeNumber(item.quantity, 1);

      const addOnText = (item.addOns || []).length
        ? item.addOns
            .map(addOn => {
              const quantity = safeNumber(addOn.quantity, 1);
              return `${addOn.name}${quantity > 1 ? ` × ${quantity}` : ''}`;
            })
            .join(', ')
        : 'No add-ons';

      const cartItem = document.createElement('article');
      cartItem.className = 'cart-item';

      cartItem.innerHTML = `
        <div class="cart-item-visual">🍕</div>

        <div class="cart-item-details">
          <div class="cart-item-heading">
            <div>
              <h2>${escapeHtml(item.productName)}</h2>
              <span class="badge ${
                item.isVeg ? 'badge-veg' : 'badge-nonveg'
              }">
                ${item.isVeg ? 'Veg' : 'Non-Veg'}
              </span>
            </div>

            <button
              type="button"
              class="icon-btn cart-remove-btn"
              aria-label="Remove item"
            >
              ✕
            </button>
          </div>

          <div class="cart-customization">
            <span>
              <strong>Size:</strong>
              ${escapeHtml(item.size?.name || '')}
            </span>

            <span>
              <strong>Crust:</strong>
              ${escapeHtml(item.crust?.name || '')}
            </span>

            <span>
              <strong>Add-ons:</strong>
              ${escapeHtml(addOnText)}
            </span>
          </div>

          <div class="cart-item-bottom">
            <div class="quantity-control">
              <button
                type="button"
                class="quantity-btn decrease-btn"
                aria-label="Decrease quantity"
              >
                −
              </button>

              <span>${safeNumber(item.quantity, 1)}</span>

              <button
                type="button"
                class="quantity-btn increase-btn"
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>

            <div class="cart-pricing">
              <span>₹${safeNumber(item.unitPrice).toFixed(0)} each</span>
              <strong>₹${itemTotal.toFixed(0)}</strong>
            </div>
          </div>
        </div>
      `;

      cartItem
        .querySelector('.decrease-btn')
        .addEventListener('click', () => {
          updateQuantity(item.key, safeNumber(item.quantity, 1) - 1);
        });

      cartItem
        .querySelector('.increase-btn')
        .addEventListener('click', () => {
          updateQuantity(item.key, safeNumber(item.quantity, 1) + 1);
        });

      cartItem
        .querySelector('.cart-remove-btn')
        .addEventListener('click', () => {
          removeItem(item.key);
        });

      cartItemsElement.appendChild(cartItem);
    });

    const itemCount = getCount();
    const subtotal = getSubtotal();

    itemCountElement.textContent = itemCount;
    subtotalElement.textContent = `₹${subtotal.toFixed(0)}`;

    if (clearButton && !clearButton.dataset.bound) {
      clearButton.dataset.bound = 'true';

      clearButton.addEventListener('click', () => {
        const shouldClear = window.confirm(
          'Kya aap complete cart clear karna chahte hain?'
        );

        if (shouldClear) {
          clear();
        }
      });
    }

    if (checkoutButton && !checkoutButton.dataset.bound) {
  checkoutButton.dataset.bound = 'true';

  checkoutButton.addEventListener('click', () => {
    if (!getItems().length) return;

    if (!window.Api || !Api.getToken()) {
      alert('Checkout ke liye pehle login karna zaroori hai.');
      window.location.href = 'login.html';
      return;
    }

    window.location.href = 'checkout.html';
  });
}
    updateCartBadges();
  }

  window.Cart = {
    getItems,
    addItem,
    updateQuantity,
    removeItem,
    clear,
    getCount,
    getSubtotal,
    buildConfigurationKey
  };

  document.addEventListener('DOMContentLoaded', () => {
    updateCartBadges();
    renderCartPage();
  });

  window.addEventListener('pp:cart-updated', () => {
    updateCartBadges();
    renderCartPage();
  });

  window.addEventListener('storage', event => {
    if (event.key === CART_KEY) {
      updateCartBadges();
      renderCartPage();
    }
  });
})();