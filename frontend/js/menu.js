document.addEventListener('DOMContentLoaded', () => {
  if (typeof setupAuthNav === 'function') {
    setupAuthNav();
  }

  createCustomizerModal();
  loadMenu();
});

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getOptionPriceForSize(option, sizeName) {
  const priceEntry = (option.prices || []).find(
    price => price.size === sizeName
  );

  return priceEntry ? Number(priceEntry.price) : null;
}

async function loadMenu() {
  const listElement = document.getElementById('product-list');
  const loadingElement = document.getElementById('menu-loading');
  const emptyElement = document.getElementById('menu-empty');
  const searchInput = document.getElementById('search-input');
  const categorySelect = document.getElementById('category-select');

  if (!listElement) {
    return;
  }

  loadingElement.style.display = 'block';
  emptyElement.style.display = 'none';
  listElement.innerHTML = '';

  try {
    const response = await Api.get('/products');
    const products = response.products || [];

    if (!products.length) {
      emptyElement.textContent = 'Abhi koi pizza available nahi hai.';
      emptyElement.style.display = 'block';
      return;
    }

    const categories = [
      ...new Set(products.map(product => product.category).filter(Boolean))
    ];

    categorySelect.innerHTML =
      '<option value="">All Categories</option>' +
      categories
        .map(category => {
          return `
            <option value="${escapeHtml(category)}">
              ${escapeHtml(category)}
            </option>
          `;
        })
        .join('');

    function filterAndRender() {
      const query = searchInput.value.trim().toLowerCase();
      const selectedCategory = categorySelect.value;

      const filteredProducts = products.filter(product => {
        const productName = (product.name || '').toLowerCase();
        const description = (product.description || '').toLowerCase();

        const matchesSearch =
          productName.includes(query) || description.includes(query);

        const matchesCategory =
          !selectedCategory || product.category === selectedCategory;

        return matchesSearch && matchesCategory;
      });

      renderProducts(filteredProducts, listElement, emptyElement);
    }

    searchInput.addEventListener('input', filterAndRender);
    categorySelect.addEventListener('change', filterAndRender);

    filterAndRender();
  } catch (error) {
    emptyElement.textContent =
      error.message || 'Menu load nahi ho pa raha hai.';
    emptyElement.style.display = 'block';
  } finally {
    loadingElement.style.display = 'none';
  }
}

function renderProducts(products, container, emptyElement) {
  container.innerHTML = '';

  if (!products.length) {
    emptyElement.textContent = 'Search ke according koi product nahi mila.';
    emptyElement.style.display = 'block';
    return;
  }

  emptyElement.style.display = 'none';

  products.forEach(product => {
    const availableSizes = (product.sizes || []).filter(
      size => size.isAvailable !== false
    );

    const startingPrice = availableSizes.length
      ? Math.min(...availableSizes.map(size => Number(size.price)))
      : 0;

    const card = document.createElement('article');
    card.className = 'product-card';

    const imageContainer = document.createElement('div');
    imageContainer.className = 'product-image';

    if (product.image) {
      const image = document.createElement('img');
      image.src = product.image;
      image.alt = product.name;
      image.loading = 'lazy';

      image.addEventListener('error', () => {
        imageContainer.innerHTML = '<span>🍕</span>';
      });

      imageContainer.appendChild(image);
    } else {
      imageContainer.innerHTML = '<span>🍕</span>';
    }

    const content = document.createElement('div');
    content.className = 'product-card-content';

    content.innerHTML = `
      <div>
        <div class="product-category">
          ${escapeHtml(product.category || '')}
        </div>

        <div class="product-title-row">
          <h2 class="product-title">
            ${escapeHtml(product.name)}
          </h2>

          <span class="badge ${
            product.isVeg ? 'badge-veg' : 'badge-nonveg'
          }">
            ${product.isVeg ? 'Veg' : 'Non-Veg'}
          </span>
        </div>

        <p class="product-desc">
          ${escapeHtml(product.description || '')}
        </p>
      </div>

      <div class="product-footer">
        <div>
          <small>Starting from</small>
          <div class="price-text">₹${startingPrice.toFixed(0)}</div>
        </div>

        <button type="button" class="btn btn-primary customize-btn">
          Customize
        </button>
      </div>
    `;

    content
      .querySelector('.customize-btn')
      .addEventListener('click', () => {
        openCustomizer(product);
      });

    card.appendChild(imageContainer);
    card.appendChild(content);
    container.appendChild(card);
  });
}

function createCustomizerModal() {
  if (document.getElementById('customizer-modal')) {
    return;
  }

  const modal = document.createElement('div');
  modal.id = 'customizer-modal';
  modal.className = 'customizer-modal hidden';
  modal.setAttribute('aria-hidden', 'true');

  modal.innerHTML = `
    <div class="modal-backdrop" data-close-customizer></div>

    <section
      class="customizer-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="customizer-title"
    >
      <header class="customizer-header">
        <div>
          <small>Customize your pizza</small>
          <h2 id="customizer-title">Pizza</h2>
        </div>

        <button
          type="button"
          class="modal-close-btn"
          data-close-customizer
          aria-label="Close"
        >
          ✕
        </button>
      </header>

      <div id="customizer-body" class="customizer-body"></div>
    </section>
  `;

  modal.querySelectorAll('[data-close-customizer]').forEach(element => {
    element.addEventListener('click', closeCustomizer);
  });

  document.body.appendChild(modal);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeCustomizer();
    }
  });
}

function openCustomizer(product) {
  const modal = document.getElementById('customizer-modal');
  const title = document.getElementById('customizer-title');
  const body = document.getElementById('customizer-body');

  const sizes = (product.sizes || []).filter(
    size => size.isAvailable !== false
  );

  const crusts = (product.crusts || []).filter(
    crust => crust.isAvailable !== false
  );

  const addOns = (product.addOns || []).filter(
    addOn => addOn.isAvailable !== false
  );

  if (!sizes.length) {
    alert('Is product ka koi size available nahi hai.');
    return;
  }

  if (!crusts.length) {
    alert('Is pizza ka koi crust available nahi hai.');
    return;
  }

  title.textContent = product.name;

  body.innerHTML = `
    <form id="customizer-form">
      <section class="customizer-section">
        <h3>1. Select Size</h3>

        <div class="choice-grid" id="size-options">
          ${sizes
            .map((size, index) => {
              return `
                <label class="choice-card">
                  <input
                    type="radio"
                    name="pizza-size"
                    value="${index}"
                    ${index === 0 ? 'checked' : ''}
                  />

                  <span>
                    <strong>${escapeHtml(size.name)}</strong>
                    <small>₹${Number(size.price).toFixed(0)}</small>
                  </span>
                </label>
              `;
            })
            .join('')}
        </div>
      </section>

      <section class="customizer-section">
        <h3>2. Select Crust</h3>

        <div class="choice-list" id="crust-options">
          ${crusts
            .map((crust, index) => {
              return `
                <label class="choice-row">
                  <input
                    type="radio"
                    name="pizza-crust"
                    value="${index}"
                    ${index === 0 ? 'checked' : ''}
                  />

                  <span class="choice-row-name">
                    ${escapeHtml(crust.name)}
                  </span>

                  <span
                    class="choice-row-price"
                    data-crust-price="${index}"
                  ></span>
                </label>
              `;
            })
            .join('')}
        </div>
      </section>

      <section class="customizer-section">
        <h3>3. Select Add-ons</h3>

        ${
          addOns.length
            ? `
              <div class="choice-list" id="addon-options">
                ${addOns
                  .map((addOn, index) => {
                    return `
                      <div class="choice-row addon-row">
                        <label class="addon-label">
                          <input
                            type="checkbox"
                            name="pizza-addon"
                            value="${index}"
                            data-required="${addOn.isRequired ? 'true' : 'false'}"
                            ${addOn.isRequired ? 'checked' : ''}
                          />

                          <span>
                            ${escapeHtml(addOn.name)}
                            ${
                              addOn.isRequired
                                ? '<small class="required-text">Required</small>'
                                : ''
                            }
                          </span>
                        </label>

                        <div class="addon-actions">
                          ${
                            addOn.multiple
                              ? `
                                <select
                                  class="addon-quantity"
                                  data-addon-quantity="${index}"
                                  aria-label="${escapeHtml(
                                    addOn.name
                                  )} quantity"
                                >
                                  <option value="1">1×</option>
                                  <option value="2">2×</option>
                                  <option value="3">3×</option>
                                </select>
                              `
                              : ''
                          }

                          <span
                            class="choice-row-price"
                            data-addon-price="${index}"
                          ></span>
                        </div>
                      </div>
                    `;
                  })
                  .join('')}
              </div>
            `
            : '<p class="muted-text">Is product ke liye koi add-on nahi hai.</p>'
        }
      </section>

      <section class="customizer-section quantity-section">
        <div>
          <h3>4. Quantity</h3>
          <small>Maximum 20 pizzas per cart item</small>
        </div>

        <div class="quantity-control">
          <button
            type="button"
            class="quantity-btn"
            data-pizza-quantity-action="decrease"
          >
            −
          </button>

          <span id="pizza-quantity">1</span>

          <button
            type="button"
            class="quantity-btn"
            data-pizza-quantity-action="increase"
          >
            +
          </button>
        </div>
      </section>

      <div id="customizer-error" class="alert alert-error hidden"></div>

      <footer class="customizer-footer">
        <div>
          <small>Final price</small>
          <strong id="customizer-total">₹0</strong>
        </div>

        <button
          type="submit"
          id="add-to-cart-btn"
          class="btn btn-primary"
        >
          Add to Cart
        </button>
      </footer>
    </form>
  `;

  const form = document.getElementById('customizer-form');
  let pizzaQuantity = 1;

  function getSelectedSize() {
    const input = form.querySelector(
      'input[name="pizza-size"]:checked'
    );

    return input ? sizes[Number(input.value)] : null;
  }

  function refreshPrices() {
    const selectedSize = getSelectedSize();
    const errorElement = document.getElementById('customizer-error');
    const addButton = document.getElementById('add-to-cart-btn');

    if (!selectedSize) {
      return;
    }

    form
      .querySelectorAll('input[name="pizza-crust"]')
      .forEach(input => {
        const crust = crusts[Number(input.value)];
        const price = getOptionPriceForSize(crust, selectedSize.name);
        const priceElement = form.querySelector(
          `[data-crust-price="${input.value}"]`
        );

        const unavailable = price === null;

        input.disabled = unavailable;
        input.closest('.choice-row').classList.toggle(
          'choice-disabled',
          unavailable
        );

        priceElement.textContent = unavailable
          ? 'Unavailable'
          : price === 0
            ? 'Included'
            : `+₹${price.toFixed(0)}`;

        if (unavailable && input.checked) {
          input.checked = false;
        }
      });

    if (
      !form.querySelector(
        'input[name="pizza-crust"]:checked:not(:disabled)'
      )
    ) {
      const firstAvailableCrust = form.querySelector(
        'input[name="pizza-crust"]:not(:disabled)'
      );

      if (firstAvailableCrust) {
        firstAvailableCrust.checked = true;
      }
    }

    form
      .querySelectorAll('input[name="pizza-addon"]')
      .forEach(input => {
        const addOn = addOns[Number(input.value)];
        const price = getOptionPriceForSize(addOn, selectedSize.name);
        const priceElement = form.querySelector(
          `[data-addon-price="${input.value}"]`
        );

        const quantitySelect = form.querySelector(
          `[data-addon-quantity="${input.value}"]`
        );

        const unavailable = price === null;
        input.disabled = unavailable;

        input.closest('.addon-row').classList.toggle(
          'choice-disabled',
          unavailable
        );

        if (unavailable) {
          input.checked = false;
        } else if (input.dataset.required === 'true') {
          input.checked = true;
        }

        if (quantitySelect) {
          quantitySelect.disabled = unavailable || !input.checked;
        }

        priceElement.textContent = unavailable
          ? 'Unavailable'
          : price === 0
            ? 'Included'
            : `+₹${price.toFixed(0)}`;
      });

    const selectedCrust = form.querySelector(
      'input[name="pizza-crust"]:checked:not(:disabled)'
    );

    if (!selectedCrust) {
      errorElement.textContent =
        'Selected size ke liye koi crust available nahi hai.';
      errorElement.classList.remove('hidden');
      addButton.disabled = true;
    } else {
      errorElement.textContent = '';
      errorElement.classList.add('hidden');
      addButton.disabled = false;
    }

    calculateTotal();
  }

  function calculateTotal() {
    const selectedSize = getSelectedSize();

    const crustInput = form.querySelector(
      'input[name="pizza-crust"]:checked:not(:disabled)'
    );

    if (!selectedSize || !crustInput) {
      document.getElementById('customizer-total').textContent = '₹0';
      return 0;
    }

    const selectedCrust = crusts[Number(crustInput.value)];

    let unitPrice = Number(selectedSize.price);

    unitPrice +=
      getOptionPriceForSize(selectedCrust, selectedSize.name) || 0;

    form
      .querySelectorAll(
        'input[name="pizza-addon"]:checked:not(:disabled)'
      )
      .forEach(input => {
        const addOn = addOns[Number(input.value)];

        const addOnPrice =
          getOptionPriceForSize(addOn, selectedSize.name) || 0;

        const quantitySelect = form.querySelector(
          `[data-addon-quantity="${input.value}"]`
        );

        const addOnQuantity = quantitySelect
          ? Number(quantitySelect.value)
          : 1;

        unitPrice += addOnPrice * addOnQuantity;
      });

    const finalPrice = unitPrice * pizzaQuantity;

    document.getElementById(
      'customizer-total'
    ).textContent = `₹${finalPrice.toFixed(0)}`;

    document.getElementById(
      'add-to-cart-btn'
    ).textContent = `Add to Cart • ₹${finalPrice.toFixed(0)}`;

    return unitPrice;
  }

  form.addEventListener('change', event => {
    if (
      event.target.matches('input[name="pizza-addon"]') &&
      event.target.dataset.required === 'true' &&
      !event.target.checked
    ) {
      event.target.checked = true;
      alert('Ye add-on required hai.');
    }

    refreshPrices();
  });

  form
    .querySelectorAll('[data-pizza-quantity-action]')
    .forEach(button => {
      button.addEventListener('click', () => {
        const action = button.dataset.pizzaQuantityAction;

        if (action === 'increase') {
          pizzaQuantity = Math.min(20, pizzaQuantity + 1);
        } else {
          pizzaQuantity = Math.max(1, pizzaQuantity - 1);
        }

        document.getElementById(
          'pizza-quantity'
        ).textContent = pizzaQuantity;

        calculateTotal();
      });
    });

  form.addEventListener('submit', event => {
    event.preventDefault();

    const selectedSize = getSelectedSize();

    const crustInput = form.querySelector(
      'input[name="pizza-crust"]:checked:not(:disabled)'
    );

    if (!selectedSize || !crustInput) {
      alert('Valid size aur crust select karo.');
      return;
    }

    const selectedCrust = crusts[Number(crustInput.value)];

    const crustPrice =
      getOptionPriceForSize(selectedCrust, selectedSize.name) || 0;

    const selectedAddOns = [];

    form
      .querySelectorAll(
        'input[name="pizza-addon"]:checked:not(:disabled)'
      )
      .forEach(input => {
        const addOn = addOns[Number(input.value)];

        const quantitySelect = form.querySelector(
          `[data-addon-quantity="${input.value}"]`
        );

        selectedAddOns.push({
          name: addOn.name,
          price:
            getOptionPriceForSize(addOn, selectedSize.name) || 0,
          quantity: quantitySelect ? Number(quantitySelect.value) : 1
        });
      });

    const unitPrice = calculateTotal();

    Cart.addItem({
      productId: product._id,
      productName: product.name,
      image: product.image || '',
      isVeg: product.isVeg,
      size: {
        name: selectedSize.name,
        price: Number(selectedSize.price)
      },
      crust: {
        name: selectedCrust.name,
        price: crustPrice
      },
      addOns: selectedAddOns,
      quantity: pizzaQuantity,
      unitPrice
    });

    closeCustomizer();

    const shouldOpenCart = window.confirm(
      'Pizza cart me add ho gaya! Cart open karna hai?'
    );

    if (shouldOpenCart) {
      window.location.href = 'cart.html';
    }
  });

  refreshPrices();

  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
}

function closeCustomizer() {
  const modal = document.getElementById('customizer-modal');

  if (!modal || modal.classList.contains('hidden')) {
    return;
  }

  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
}