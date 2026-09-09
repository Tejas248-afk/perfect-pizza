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

/* ---------- Static combo config (frontend only) ---------- */
/* Yahan sab combo products ka config rakhenge.
   Agar product.name inme se match karega to Combo customizer khulega. */

const SINGLE_TOPPING_OPTIONS = [
  { label: 'Onion Pizza', extraPrice: 0 },
  { label: 'Corn Pizza', extraPrice: 10 },
  { label: 'Tomato Pizza', extraPrice: 0 },
  { label: 'Capsicum Pizza', extraPrice: 10 },
  { label: 'Cheese Paneer Pizza', extraPrice: 60 }
];

const BASIC_SIDE_OPTIONS = [
  { label: 'Garlic Bread [8 Sticks]', extraPrice: 0 }
];

const BASIC_DRINK_OPTIONS_250 = [
  { label: 'ColdDrink 250ml', extraPrice: 0 }
];

const BASIC_DRINK_OPTIONS_1L = [
  { label: 'ColdDrink 1L', extraPrice: 0 }
];

const COMBO_CONFIG = {
  /* ========= SUPER SAVING COMBOS ========= */

  'Zingy Pizza Combo': {
    // 1 Regular pizza + 2 Zingy + ColdDrink 250ml
    groups: [
      {
        key: 'pizza1',
        title: 'Choose Pizza [Regular]',
        required: true,
        options: SINGLE_TOPPING_OPTIONS
      },
      {
        key: 'side1',
        title: 'Zingy Parcel 1',
        required: true,
        options: [{ label: 'Zingy Parcel', extraPrice: 0 }]
      },
      {
        key: 'side2',
        title: 'Zingy Parcel 2',
        required: true,
        options: [{ label: 'Zingy Parcel', extraPrice: 0 }]
      },
      {
        key: 'drink',
        title: 'Beverages',
        required: true,
        options: BASIC_DRINK_OPTIONS_250
      }
    ]
  },

  'Garlic Pizza Combo': {
    // Paneer Onion Pizza + 1 Garlic Bread + ColdDrink 250ml
    groups: [
      {
        key: 'pizza1',
        title: 'Choose Pizza [Regular]',
        required: true,
        options: SINGLE_TOPPING_OPTIONS
      },
      {
        key: 'side',
        title: 'Side',
        required: true,
        options: [{ label: 'Garlic Bread', extraPrice: 0 }]
      },
      {
        key: 'drink',
        title: 'Beverages',
        required: true,
        options: BASIC_DRINK_OPTIONS_250
      }
    ]
  },

  'Pizza Pasta Combo': {
    // 1 Regular Pizza + Red Pasta + ColdDrink 250ml
    groups: [
      {
        key: 'pizza1',
        title: 'Choose Pizza [Regular]',
        required: true,
        options: SINGLE_TOPPING_OPTIONS
      },
      {
        key: 'side',
        title: 'Side',
        required: true,
        options: [{ label: 'Red Pasta', extraPrice: 0 }]
      },
      {
        key: 'drink',
        title: 'Beverages',
        required: true,
        options: BASIC_DRINK_OPTIONS_250
      }
    ]
  },

  'Meal For 2': {
    // 2 Single topping pizza + garlic bread + cold drink
    groups: [
      {
        key: 'firstPizza',
        title: 'Choose 1st Pizza [Regular]',
        required: true,
        options: SINGLE_TOPPING_OPTIONS
      },
      {
        key: 'secondPizza',
        title: 'Choose 2nd Pizza [Regular]',
        required: true,
        options: SINGLE_TOPPING_OPTIONS
      },
      {
        key: 'side',
        title: 'Side',
        required: true,
        options: BASIC_SIDE_OPTIONS
      },
      {
        key: 'drink',
        title: 'Beverages',
        required: true,
        options: BASIC_DRINK_OPTIONS_250
      }
    ]
  },

  'Meal For 3': {
    // 3 Single topping pizza + garlic bread + choco lava + cold drink 1L
    groups: [
      {
        key: 'pizza1',
        title: 'Choose 1st Pizza [Regular]',
        required: true,
        options: SINGLE_TOPPING_OPTIONS
      },
      {
        key: 'pizza2',
        title: 'Choose 2nd Pizza [Regular]',
        required: true,
        options: SINGLE_TOPPING_OPTIONS
      },
      {
        key: 'pizza3',
        title: 'Choose 3rd Pizza [Regular]',
        required: true,
        options: SINGLE_TOPPING_OPTIONS
      },
      {
        key: 'side',
        title: 'Side',
        required: true,
        options: BASIC_SIDE_OPTIONS
      },
      {
        key: 'dessert',
        title: 'Dessert',
        required: true,
        options: [{ label: 'Choco Lava', extraPrice: 0 }]
      },
      {
        key: 'drink',
        title: 'Beverages',
        required: true,
        options: BASIC_DRINK_OPTIONS_1L
      }
    ]
  },

  /* ========= EVERYDAY COMBOS (99 / 149) ========= */

  'Combo-A': {
    // (Onion Capsicum / Tomato Corn, ColdDrink-250ml)
    groups: [
      {
        key: 'pizza1',
        title: 'Choose Pizza [Regular]',
        required: true,
        options: [
          { label: 'Onion Capsicum', extraPrice: 0 },
          { label: 'Tomato Corn', extraPrice: 0 }
        ]
      },
      {
        key: 'drink',
        title: 'Beverages',
        required: true,
        options: BASIC_DRINK_OPTIONS_250
      }
    ]
  },

  'Combo-B': {
    groups: [
      {
        key: 'pizza1',
        title: 'Choose Pizza [Regular]',
        required: true,
        options: [
          { label: 'Cheese Onion', extraPrice: 0 },
          { label: 'Tomato', extraPrice: 0 }
        ]
      },
      {
        key: 'drink',
        title: 'Beverages',
        required: true,
        options: BASIC_DRINK_OPTIONS_250
      }
    ]
  },

  'Combo-C': {
    groups: [
      {
        key: 'pizza1',
        title: 'Choose Pizza [Regular]',
        required: true,
        options: [
          { label: 'Cheese Corn', extraPrice: 0 },
          { label: 'Capsicum', extraPrice: 0 }
        ]
      },
      {
        key: 'drink',
        title: 'Beverages',
        required: true,
        options: BASIC_DRINK_OPTIONS_250
      }
    ]
  },

  'Combo-D': {
    groups: [
      {
        key: 'pizza1',
        title: 'Choose Pizza [Regular]',
        required: true,
        options: [
          { label: 'Corn Pizza', extraPrice: 0 },
          { label: 'Capsicum Pizza', extraPrice: 0 }
        ]
      },
      {
        key: 'drink',
        title: 'Beverages',
        required: true,
        options: BASIC_DRINK_OPTIONS_250
      }
    ]
  },

  'Combo-E': {
    groups: [
      {
        key: 'pizza1',
        title: 'Choose Pizza [Regular]',
        required: true,
        options: [
          { label: 'Tomato Corn Pizza', extraPrice: 0 },
          { label: 'Tomato Pizza', extraPrice: 0 }
        ]
      },
      {
        key: 'drink',
        title: 'Beverages',
        required: true,
        options: BASIC_DRINK_OPTIONS_250
      }
    ]
  },

  'Combo-F': {
    groups: [
      {
        key: 'pizza1',
        title: 'Choose Pizza [Regular]',
        required: true,
        options: [
          { label: 'Tomato Corn Pizza', extraPrice: 0 },
          { label: 'Tomato Pizza', extraPrice: 0 }
        ]
      },
      {
        key: 'drink',
        title: 'Beverages',
        required: true,
        options: BASIC_DRINK_OPTIONS_250
      }
    ]
  },

  'Combo-G': {
    groups: [
      {
        key: 'pizza1',
        title: 'Choose Pizza [Regular]',
        required: true,
        options: [
          { label: 'Tomato Corn Pizza', extraPrice: 0 },
          { label: 'Tomato Pizza', extraPrice: 0 }
        ]
      },
      {
        key: 'drink',
        title: 'Beverages',
        required: true,
        options: BASIC_DRINK_OPTIONS_250
      }
    ]
  },

  'Combo-H': {
    groups: [
      {
        key: 'pizza1',
        title: 'Choose Pizza [Regular]',
        required: true,
        options: [
          { label: 'Onion Capsicum', extraPrice: 0 },
          { label: 'Tomato Corn', extraPrice: 0 }
        ]
      },
      {
        key: 'drink',
        title: 'Beverages',
        required: true,
        options: BASIC_DRINK_OPTIONS_250
      }
    ]
  },

  'Burger Pizza Combo': {
    groups: [
      {
        key: 'pizza1',
        title: 'Pizza',
        required: true,
        options: [{ label: 'Paneer Onion Pizza', extraPrice: 0 }]
      },
      {
        key: 'side',
        title: 'Side',
        required: true,
        options: [{ label: 'Burger', extraPrice: 0 }]
      },
      {
        key: 'drink',
        title: 'Beverages',
        required: true,
        options: BASIC_DRINK_OPTIONS_250
      }
    ]
  }
};

/* ---------- Tuesday BOGO helpers ---------- */

// Current time in India (IST)
function getIstNow() {
  const now = new Date();
  return new Date(
    now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
  );
}

// true only on Tuesday between 10:00 and 23:00 IST
function isTuesdayBogoTime() {
  const istNow = getIstNow();
  const day = istNow.getDay();   // 2 = Tuesday
  const hour = istNow.getHours();
  return day === 2 && hour >= 10 && hour < 23;
}

// Product eligible for Tuesday BOGO? (ONLY Exotic Veg / Veg Special + MEDIUM/LARGE)
function isProductEligibleForTuesdayBogo(product) {
  const cat = (product.category || '').toLowerCase();

  const eligibleCategory =
    cat.includes('exotic') ||
    cat.includes('veg special');

  if (!eligibleCategory) return false;

  const hasEligibleSize = (product.sizes || []).some(
    s =>
      s.isAvailable !== false &&
      (s.name === 'MEDIUM' || s.name === 'LARGE')
  );

  return hasEligibleSize;
}

// BOGO kind based on category: EXOTIC / VEG_SPECIAL / OTHER
function getBogoKind(product) {
  const cat = (product.category || '').toLowerCase();
  if (cat.includes('exotic')) return 'EXOTIC';
  if (cat.includes('veg special')) return 'VEG_SPECIAL';
  return 'OTHER';
}

/* ---------- Load menu ---------- */

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

    // Global list so customizer me free pizza options dikh sake
    window.__PP_ALL_PRODUCTS = products;

    if (!products.length) {
      emptyElement.textContent = 'No pizzas available right now.';
      emptyElement.style.display = 'block';
      return;
    }

    const baseCategories = [
      ...new Set(products.map(product => product.category).filter(Boolean))
    ];

    // Normal categories
    categorySelect.innerHTML =
      '<option value="">All Categories</option>' +
      baseCategories
        .map(category => {
          return `
            <option value="${escapeHtml(category)}">
              ${escapeHtml(category)}
            </option>
          `;
        })
        .join('');

    // Special Tuesday BOGO virtual category
    if (isTuesdayBogoTime()) {
      categorySelect.innerHTML += `
        <option value="__TUESDAY_BOGO__">
          Tuesday BOGO (Buy 1 Get 1 Free)
        </option>
      `;
    }

    function filterAndRender() {
      const query = searchInput.value.trim().toLowerCase();
      const selectedCategory = categorySelect.value;
      const isTuesdayBogoSelected = selectedCategory === '__TUESDAY_BOGO__';

      const filteredProducts = products.filter(product => {
        const productName = (product.name || '').toLowerCase();
        const description = (product.description || '').toLowerCase();

        const matchesSearch =
          productName.includes(query) || description.includes(query);

        if (isTuesdayBogoSelected) {
          // Sirf Tuesday BOGO ke liye eligible products
          return matchesSearch && isProductEligibleForTuesdayBogo(product);
        }

        const matchesCategory =
          !selectedCategory || product.category === selectedCategory;

        return matchesSearch && matchesCategory;
      });

      renderProducts(
        filteredProducts,
        listElement,
        emptyElement,
        isTuesdayBogoSelected
      );
    }

    searchInput.addEventListener('input', filterAndRender);
    categorySelect.addEventListener('change', filterAndRender);

    filterAndRender();
  } catch (error) {
    console.error('loadMenu error:', error);
    emptyElement.textContent =
      error.message || 'Unable to load menu right now.';
    emptyElement.style.display = 'block';
  } finally {
    loadingElement.style.display = 'none';
  }
}

/* ---------- Render product cards ---------- */

function renderProducts(
  products,
  container,
  emptyElement,
  isTuesdayBogoMode = false
) {
  container.innerHTML = '';

  if (!products.length) {
    emptyElement.textContent = 'No products found for the selected filters.';
    emptyElement.style.display = 'block';
    return;
  }

  emptyElement.style.display = 'none';

  const bogoActive = isTuesdayBogoTime();

  products.forEach(product => {
    const availableSizes = (product.sizes || []).filter(
      size => size.isAvailable !== false
    );

    // Tuesday BOGO category me "Starting from" = MEDIUM ka price
    let startingPrice = 0;
    if (isTuesdayBogoMode) {
      const mediumSize = (product.sizes || []).find(
        s => s.name === 'MEDIUM' && s.isAvailable !== false
      );

      if (mediumSize) {
        startingPrice = Number(mediumSize.price || 0);
      } else if (availableSizes.length) {
        // fallback agar kisi product me Medium hi nahi hai
        startingPrice = Math.min(
          ...availableSizes.map(size => Number(size.price || 0))
        );
      }
    } else {
      // Normal categories: cheapest size (REGULAR/MEDIUM/LARGE)
      startingPrice = availableSizes.length
        ? Math.min(
            ...availableSizes.map(size => Number(size.price || 0))
          )
        : 0;
    }

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

    const eligibleForBogo =
      bogoActive && isProductEligibleForTuesdayBogo(product);

    const isCombo = !!COMBO_CONFIG[product.name];

    content.innerHTML = `
      <div>
        <div class="product-category">
          ${escapeHtml(product.category || '')}
          ${
            eligibleForBogo && !isCombo
              ? '<span class="badge badge-offer" style="margin-left:0.4rem;">BOGO Tuesday</span>'
              : ''
          }
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
        ${
          eligibleForBogo && isTuesdayBogoMode && !isCombo
            ? '<p class="text-small" style="color:#388e3c;margin-top:0.2rem;">Buy 1 Get 1 FREE on Medium & Large (Exotic/Veg Special) today.</p>'
            : ''
        }
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

    const isTuesdayBogoForThisProduct =
      isTuesdayBogoMode && eligibleForBogo && !isCombo;

    content
      .querySelector('.customize-btn')
      .addEventListener('click', () => {
        const comboCfg = COMBO_CONFIG[product.name];
        if (comboCfg) {
          openComboCustomizer(product, comboCfg);
        } else {
          openPizzaCustomizer(product, {
            isTuesdayBogo: isTuesdayBogoForThisProduct
          });
        }
      });

    card.appendChild(imageContainer);
    card.appendChild(content);
    container.appendChild(card);
  });
}

/* ---------- Customizer modal ---------- */

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

/* ---------- Combo customizer (Meal / Zingy / Everyday) ---------- */

function openComboCustomizer(product, comboCfg) {
  const modal = document.getElementById('customizer-modal');
  const title = document.getElementById('customizer-title');
  const body = document.getElementById('customizer-body');

  // For combos, assume REGULAR size (ya pehla available size)
  let size = (product.sizes || []).find(
    s => s.name === 'REGULAR' && s.isAvailable !== false
  );
  if (!size) {
    size = (product.sizes || []).find(s => s.isAvailable !== false);
  }
  if (!size) {
    alert('No size is available for this combo.');
    return;
  }

  const crusts = (product.crusts || []).filter(
    crust => crust.isAvailable !== false
  );
  if (!crusts.length) {
    alert('No crust is available for this combo.');
    return;
  }

  title.textContent = product.name;

  body.innerHTML = `
    <form id="customizer-form">
      <section class="customizer-section">
        <h3>Base Price</h3>
        <p class="muted-text">
          ${escapeHtml(product.description || '')}
        </p>
        <p><strong>Size:</strong> ${escapeHtml(size.name)} • <strong>₹${Number(size.price).toFixed(0)}</strong></p>
      </section>

      <section class="customizer-section">
        <h3>Choose Crust</h3>
        <div class="choice-list" id="combo-crust-options">
          ${crusts
            .map((crust, index) => {
              const crustPriceEntry = (crust.prices || []).find(
                p => p.size === size.name
              );
              const extra = crustPriceEntry ? Number(crustPriceEntry.price || 0) : 0;
              const priceText = extra === 0 ? 'Free' : `+₹${extra.toFixed(0)}`;
              return `
                <label class="choice-row">
                  <input
                    type="radio"
                    name="combo-crust"
                    value="${index}"
                    ${index === 0 ? 'checked' : ''}
                  />
                  <span class="choice-row-name">${escapeHtml(crust.name)}</span>
                  <span class="choice-row-price">${priceText}</span>
                </label>
              `;
            })
            .join('')}
        </div>
      </section>

      ${comboCfg.groups
        .map((group) => {
          return `
            <section class="customizer-section">
              <h3>${escapeHtml(group.title || group.key)}</h3>
              <div class="choice-list">
                ${group.options
                  .map((opt, oIndex) => {
                    const extra = Number(opt.extraPrice || 0);
                    const priceText =
                      extra === 0 ? 'Free' : `+₹${extra.toFixed(0)}`;
                    return `
                      <label class="choice-row">
                        <input
                          type="radio"
                          name="combo-${group.key}"
                          value="${oIndex}"
                          ${oIndex === 0 ? 'checked' : ''}
                        />
                        <span class="choice-row-name">${escapeHtml(opt.label)}</span>
                        <span class="choice-row-price">${priceText}</span>
                      </label>
                    `;
                  })
                  .join('')}
              </div>
            </section>
          `;
        })
        .join('')}

      <section class="customizer-section quantity-section">
        <div>
          <h3>Quantity</h3>
          <small>Applies to full combo (all items).</small>
        </div>

        <div class="quantity-control">
          <button
            type="button"
            class="quantity-btn"
            data-combo-qty-action="decrease"
          >
            −
          </button>

          <span id="combo-qty">1</span>

          <button
            type="button"
            class="quantity-btn"
            data-combo-qty-action="increase"
          >
            +
          </button>
        </div>
      </section>

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
  let comboQty = 1;

  function getSelectedCrust() {
    const input = form.querySelector('input[name="combo-crust"]:checked');
    return input ? crusts[Number(input.value)] : crusts[0];
  }

  function getSelectedCrustExtraPrice(crust) {
    const entry = (crust.prices || []).find(p => p.size === size.name);
    return entry ? Number(entry.price || 0) : 0;
  }

  function calculateComboUnitPrice() {
    const crust = getSelectedCrust();
    const crustExtra = getSelectedCrustExtraPrice(crust);

    let extras = 0;

    comboCfg.groups.forEach(group => {
      const radio = form.querySelector(
        `input[name="combo-${group.key}"]:checked`
      );
      if (!radio) return;
      const opt = group.options[Number(radio.value)];
      if (!opt) return;
      extras += Number(opt.extraPrice || 0);
    });

    return Number(size.price || 0) + crustExtra + extras;
  }

  function refreshComboTotal() {
    const unitPrice = calculateComboUnitPrice();
    const total = unitPrice * comboQty;
    const totalEl = document.getElementById('customizer-total');
    const btn = document.getElementById('add-to-cart-btn');
    if (totalEl) totalEl.textContent = `₹${total.toFixed(0)}`;
    if (btn) btn.textContent = `Add to Cart • ₹${total.toFixed(0)}`;
  }

  form.addEventListener('change', event => {
    if (event.target.name && event.target.name.startsWith('combo-')) {
      refreshComboTotal();
    }
  });

  form
    .querySelectorAll('[data-combo-qty-action]')
    .forEach(button => {
      button.addEventListener('click', () => {
        const action = button.dataset.comboQtyAction;
        if (action === 'increase') {
          comboQty = Math.min(20, comboQty + 1);
        } else {
          comboQty = Math.max(1, comboQty - 1);
        }
        document.getElementById('combo-qty').textContent = comboQty;
        refreshComboTotal();
      });
    });

  form.addEventListener('submit', event => {
    event.preventDefault();

    // collect selections
    const crust = getSelectedCrust();
    const crustExtra = getSelectedCrustExtraPrice(crust);

    const comboSelections = {};
    for (const group of comboCfg.groups) {
      const radio = form.querySelector(
        `input[name="combo-${group.key}"]:checked`
      );
      if (!radio && group.required) {
        alert(`Please choose an option for "${group.title || group.key}".`);
        return;
      }
      const opt = group.options[Number(radio.value)];
      comboSelections[group.key] = {
        label: opt.label,
        extraPrice: Number(opt.extraPrice || 0)
      };
    }

    const unitPrice = calculateComboUnitPrice();

    Cart.addItem({
      productId: product._id,
      productName: product.name,
      image: product.image || '',
      isVeg: product.isVeg,
      size: {
        name: size.name,
        price: Number(size.price)
      },
      crust: {
        name: crust.name,
        price: crustExtra
      },
      addOns: [], // combos ke liye abhi addOns nahi use kar rahe
      quantity: comboQty,
      unitPrice,
      comboSelections // sirf frontend ke liye (backend ignore karega)
    });

    closeCustomizer();

    const shouldOpenCart = window.confirm(
      'Combo added to cart! Do you want to open your cart?'
    );

    if (shouldOpenCart) {
      window.location.href = 'cart.html';
    }
  });

  // initial total
  refreshComboTotal();

  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
}

/* ---------- Pizza customizer (existing BOGO logic) ---------- */

function openPizzaCustomizer(product, options = {}) {
  const isTuesdayBogo = options.isTuesdayBogo === true;

  const modal = document.getElementById('customizer-modal');
  const title = document.getElementById('customizer-title');
  const body = document.getElementById('customizer-body');

  let sizes = (product.sizes || []).filter(
    size => size.isAvailable !== false
  );

  // Tuesday BOGO: Only MEDIUM & LARGE sizes
  if (isTuesdayBogo) {
    sizes = sizes.filter(
      size => size.name === 'MEDIUM' || size.name === 'LARGE'
    );
  }

  const crusts = (product.crusts || []).filter(
    crust => crust.isAvailable !== false
  );

  const addOns = (product.addOns || []).filter(
    addOn => addOn.isAvailable !== false
  );

  if (!sizes.length) {
    alert('No size is available for this product.');
    return;
  }

  if (!crusts.length) {
    alert('No crust is available for this pizza.');
    return;
  }

  // Paid pizza ka kind nikaalo (EXOTIC / VEG_SPECIAL / OTHER)
  const paidKind = getBogoKind(product);

  // Free pizza options BOGO ke liye
  let eligibleFreeProducts = [];
  if (isTuesdayBogo && isTuesdayBogoTime()) {
    const allProducts = window.__PP_ALL_PRODUCTS || [];
    eligibleFreeProducts = allProducts.filter(p => {
      if (!isProductEligibleForTuesdayBogo(p)) return false;
      const k = getBogoKind(p);
      if (paidKind === 'EXOTIC') {
        return k === 'EXOTIC';
      }
      if (paidKind === 'VEG_SPECIAL') {
        return k === 'EXOTIC' || k === 'VEG_SPECIAL';
      }
      return true;
    });
  }

  title.textContent = product.name;

  const quantityHelpText = isTuesdayBogo
    ? 'You will get 1 paid pizza and 1 selected FREE pizza (BOGO Tuesday).'
    : 'Maximum 20 pizzas per cart item';

  const initialQuantity = 1;

  let freePizzaSectionHtml = '';
  if (isTuesdayBogo) {
    if (eligibleFreeProducts.length) {
      freePizzaSectionHtml = `
        <section class="customizer-section">
          <h3>4. Choose your FREE pizza</h3>
          <p class="muted-text">
            Free pizza options are based on your selected category:
            ${
              paidKind === 'EXOTIC'
                ? 'Exotic Veg pizzas only.'
                : paidKind === 'VEG_SPECIAL'
                ? 'Veg Special and Exotic Veg pizzas.'
                : 'all eligible BOGO pizzas.'
            }
            Free pizza will use the same size & crust as your paid pizza, without extra add-ons.
          </p>
          <div class="choice-list" id="free-pizza-options">
            ${eligibleFreeProducts
              .map(
                (p, idx) => `
              <label class="choice-row">
                <input
                  type="radio"
                  name="free-pizza"
                  value="${idx}"
                  ${idx === 0 ? 'checked' : ''}
                />
                <span class="choice-row-name">${escapeHtml(p.name)}</span>
                <span class="choice-row-price">
                  <small>${escapeHtml(p.category || '')}</small>
                </span>
              </label>
            `
              )
              .join('')}
          </div>
        </section>
      `;
    } else {
      freePizzaSectionHtml = `
        <section class="customizer-section">
          <h3>4. Choose your FREE pizza</h3>
          <p class="muted-text">No free pizza options are available right now.</p>
        </section>
      `;
    }
  }

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
            : '<p class="muted-text">No add-ons are available for this product.</p>'
        }
      </section>

      ${freePizzaSectionHtml}

      <section class="customizer-section quantity-section">
        <div>
          <h3>${isTuesdayBogo ? '5. Quantity (paid pizza)' : '4. Quantity'}</h3>
          <small>${quantityHelpText}</small>
        </div>

        <div class="quantity-control">
          <button
            type="button"
            class="quantity-btn"
            data-pizza-quantity-action="decrease"
          >
            −
          </button>

          <span id="pizza-quantity">${initialQuantity}</span>

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
          <small>Approx. final price (actual offer will apply at checkout)</small>
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
  let pizzaQuantity = initialQuantity;

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
        'No crust is available for the selected size.';
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
      alert('This add-on is required.');
    }

    refreshPrices();
  });

  form
    .querySelectorAll('[data-pizza-quantity-action]')
    .forEach(button => {
      button.addEventListener('click', () => {
        const action = button.dataset.pizzaQuantityAction;

        if (isTuesdayBogo) {
          // 1 paid pizza + 1 free combo, quantity change allowed nahi
          return;
        }

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
      alert('Please select a valid size and crust.');
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

    // Paid pizza quantity
    let paidQuantity = pizzaQuantity;

    // Free pizza handling (Tuesday BOGO)
    let freeProduct = null;

    if (isTuesdayBogo && isTuesdayBogoTime()) {
      paidQuantity = 1; // ek paid pizza per combo

      if (!eligibleFreeProducts.length) {
        alert('No free pizza options are available right now.');
        return;
      }

      const freeRadio = form.querySelector(
        'input[name="free-pizza"]:checked'
      );
      if (!freeRadio) {
        alert('Please choose your FREE pizza.');
        return;
      }

      freeProduct = eligibleFreeProducts[Number(freeRadio.value)];
      if (!freeProduct) {
        alert('Selected free pizza is not available.');
        return;
      }
    }

    // 1) Add paid pizza
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
      quantity: paidQuantity,
      unitPrice
    });

    // 2) Add free pizza as separate cart item (no extra add-ons)
    if (freeProduct && isTuesdayBogo && isTuesdayBogoTime()) {
      const freeSize = (freeProduct.sizes || []).find(
        s =>
          s.name === selectedSize.name &&
          s.isAvailable !== false
      );

      if (!freeSize) {
        alert(
          'Selected free pizza is not available in this size. Please choose another free pizza.'
        );
        return;
      }

      let freeCrust =
        (freeProduct.crusts || []).find(
          c => c.name === selectedCrust.name && c.isAvailable !== false
        ) || null;

      if (!freeCrust) {
        freeCrust = (freeProduct.crusts || []).find(
          c => c.isAvailable !== false
        );
      }

      if (!freeCrust) {
        alert(
          'Selected free pizza has no available crust. Please choose another free pizza.'
        );
        return;
      }

      const freeCrustPriceEntry = (freeCrust.prices || []).find(
        p => p.size === freeSize.name
      );
      const freeCrustPrice = freeCrustPriceEntry
        ? Number(freeCrustPriceEntry.price || 0)
        : 0;

      const freeUnitPrice =
        Number(freeSize.price || 0) + freeCrustPrice;

      Cart.addItem({
        productId: freeProduct._id,
        productName: freeProduct.name + ' (FREE - BOGO)',
        image: freeProduct.image || '',
        isVeg: freeProduct.isVeg,
        size: {
          name: freeSize.name,
          price: Number(freeSize.price)
        },
        crust: {
          name: freeCrust.name,
          price: freeCrustPrice
        },
        addOns: [], // free pizza pe extra add-ons nahi
        quantity: 1,
        unitPrice: freeUnitPrice
      });

      alert(
        'Tuesday BOGO applied: 1 paid pizza and 1 selected FREE pizza added to your cart.'
      );
    }

    closeCustomizer();

    const shouldOpenCart = window.confirm(
      'Pizza added to cart! Do you want to open your cart?'
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

/* ---------- Close customizer ---------- */

function closeCustomizer() {
  const modal = document.getElementById('customizer-modal');

  if (!modal || modal.classList.contains('hidden')) {
    return;
  }

  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
}