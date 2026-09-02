// ====================== COMMON ADMIN INIT ======================

document.addEventListener('DOMContentLoaded', () => {
  if (typeof setupAuthNav === 'function') {
    setupAuthNav();
  }
    if (document.getElementById('admin-coupons-table')) {
    initAdminCouponsPage();
  }

  // Sirf ADMIN user ke liye aage ka code chale
  if (!ensureAdmin()) return;

  if (document.getElementById('admin-products-table')) {
    initAdminProductsPage();
  }

  if (document.getElementById('admin-overview')) {
    loadAdminOverview();
  }

  if (document.getElementById('admin-orders-table')) {
    initAdminOrdersPage();
  }

  if (document.getElementById('admin-customers-table')) {
    initAdminCustomersPage();
  }

  if (document.getElementById('admin-delivery-rules-table')) {
    initAdminDeliveryRulesPage();
  }
});

function ensureAdmin() {
  const user = Api.getStoredUser();
  if (!user || !Api.getToken()) {
    alert('Admin panel ke liye login zaroori hai (admin account).');
    window.location.href = '../login.html';
    return false;
  }

  if (user.role !== 'ADMIN') {
    alert('Sirf ADMIN user hi admin panel access kar sakte hain.');
    if (user.role === 'KITCHEN') {
      window.location.href = '../kitchen/orders.html';
    } else {
      window.location.href = '../index.html';
    }
    return false;
  }

  return true;
}

// ====================== PRODUCTS (admin/products.html) ======================

async function initAdminProductsPage() {
  const reloadBtn = document.getElementById('admin-products-reload');
  reloadBtn && reloadBtn.addEventListener('click', () => loadAdminProducts());

  const searchInput = document.getElementById('admin-product-search');
  const catFilter = document.getElementById('admin-product-filter-category');
  const availSelect = document.getElementById(
    'admin-product-filter-availability'
  );

  const addCatSelect = document.getElementById('admin-add-category-select');
  const addCatCustom = document.getElementById('admin-add-category-custom');

  const sizeRegularGroup = document.getElementById('admin-add-size-regular');
  const sizeMediumGroup = document.getElementById('admin-add-size-medium');
  const sizeLargeGroup = document.getElementById('admin-add-size-large');

  const triggerLoad = () => loadAdminProducts();

  searchInput &&
    searchInput.addEventListener('keyup', e => {
      if (e.key === 'Enter') triggerLoad();
    });
  catFilter && catFilter.addEventListener('change', triggerLoad);
  availSelect && availSelect.addEventListener('change', triggerLoad);

  // Category change => custom field + size fields handling
  if (addCatSelect) {
    const handleCategoryChange = () => {
      const val = addCatSelect.value;
      if (val === '__custom') {
        addCatCustom.style.display = 'block';
      } else {
        addCatCustom.style.display = 'none';
        addCatCustom.value = '';
      }

      const labelText =
        val === '__custom'
          ? addCatCustom.value
          : addCatSelect.options[addCatSelect.selectedIndex]?.text || '';

      updateAddProductSizeVisibility(
        labelText,
        sizeRegularGroup,
        sizeMediumGroup,
        sizeLargeGroup
      );
    };

    addCatSelect.addEventListener('change', handleCategoryChange);

    addCatCustom &&
      addCatCustom.addEventListener('input', () => {
        updateAddProductSizeVisibility(
          addCatCustom.value,
          sizeRegularGroup,
          sizeMediumGroup,
          sizeLargeGroup
        );
      });

    // Initial: jab tak koi category select nahi, sirf Regular
    updateAddProductSizeVisibility(
      '',
      sizeRegularGroup,
      sizeMediumGroup,
      sizeLargeGroup
    );
  }

  // Add-product form submit
  const addForm = document.getElementById('admin-add-product-form');
  if (addForm && !addForm.dataset.bound) {
    addForm.dataset.bound = 'true';
    addForm.addEventListener('submit', handleAddProduct);
  }

  loadAdminProducts();
}

// Category ke hisaab se size fields show/hide
function updateAddProductSizeVisibility(
  categoryLabel,
  regularGroup,
  mediumGroup,
  largeGroup
) {
  if (!regularGroup || !mediumGroup || !largeGroup) return;

  const label = (categoryLabel || '').toLowerCase();

  const isPizza = label.includes('pizza'); // simple logic

  // Regular hamesha dikhana
  regularGroup.style.display = 'block';

  if (isPizza) {
    mediumGroup.style.display = 'block';
    largeGroup.style.display = 'block';
  } else {
    mediumGroup.style.display = 'none';
    largeGroup.style.display = 'none';
    // Non-pizza ke liye medium/large values clear kar do
    const medInput = mediumGroup.querySelector('input');
    const lgInput = largeGroup.querySelector('input');
    if (medInput) medInput.value = '';
    if (lgInput) lgInput.value = '';
  }
}

async function loadAdminProducts() {
  const tbody = document.getElementById('admin-products-body');
  const loadingEl = document.getElementById('admin-products-loading');
  const emptyEl = document.getElementById('admin-products-empty');
  const searchInput = document.getElementById('admin-product-search');
  const catSelect = document.getElementById('admin-product-filter-category');
  const availSelect = document.getElementById(
    'admin-product-filter-availability'
  );

  if (!tbody || !loadingEl || !emptyEl) return;

  loadingEl.style.display = 'block';
  emptyEl.style.display = 'none';
  tbody.innerHTML = '';

  try {
    const res = await Api.get('/admin/products');
    let products = res.products || [];

    // Categories list
    const cats = Array.from(
      new Set(products.map(p => p.category).filter(Boolean))
    );

    // Filter dropdown
    if (catSelect) {
      catSelect.innerHTML =
        '<option value="">All Categories</option>' +
        cats.map(c => `<option value="${c}">${c}</option>`).join('');
    }

    // Add-product category select
    const addCatSelect = document.getElementById('admin-add-category-select');
    if (addCatSelect) {
      addCatSelect.innerHTML =
        '<option value="">Select category</option>' +
        cats.map(c => `<option value="${c}">${c}</option>`).join('') +
        '<option value="__custom">Other (custom)</option>';
    }

    const search = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const catFilterVal = catSelect ? catSelect.value : '';
    const availFilter = availSelect ? availSelect.value : 'ALL';

    products = products.filter(p => {
      if (catFilterVal && p.category !== catFilterVal) return false;

      if (availFilter === 'AVAILABLE' && !p.isAvailable) return false;
      if (availFilter === 'DISABLED' && p.isAvailable) return false;

      if (search) {
        const text =
          (p.name || '').toLowerCase() +
          ' ' +
          (p.category || '').toLowerCase();
        if (!text.includes(search)) return false;
      }

      return true;
    });

    loadingEl.style.display = 'none';

    if (!products.length) {
      emptyEl.style.display = 'block';
      return;
    }

    products.forEach(p => {
      const tr = document.createElement('tr');

            const sizes = p.sizes || [];
      const findPrice = sizeName => {
        const s = sizes.find(s => s.name === sizeName);
        return s ? s.price : '';
      };

      const r = findPrice('REGULAR');
      const m = findPrice('MEDIUM');
      const l = findPrice('LARGE');

      const imgHtml = p.image
        ? `<img src="${p.image}" alt="${p.name}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;" onerror="this.style.display='none'" />`
        : '<span class="text-small" style="color:#999">No image</span>';

      tr.innerHTML = `
        <td>${p.name}</td>
        <td>${p.category || ''}</td>
        <td>${imgHtml}</td>
        <td>${p.isVeg ? 'Veg' : 'Non-Veg'}</td>
        <td>
          <span class="text-small">
            R: ${r ? '₹' + r : '-'}<br/>
            M: ${m ? '₹' + m : '-'}<br/>
            L: ${l ? '₹' + l : '-'}
          </span>
        </td>
        <td>${p.isAvailable ? 'Yes' : 'No'}</td>
        <td>
          <button class="btn btn-secondary btn-sm" data-toggle-product="${
            p._id
          }">
            ${p.isAvailable ? 'Disable' : 'Enable'}
          </button>
          <button class="btn btn-secondary btn-sm" data-image-product="${
            p._id
          }">
            Change Image
          </button>
          <button class="btn btn-danger-outline btn-sm" data-delete-product="${
            p._id
          }">
            Delete
          </button>
        </td>
      `;

      tbody.appendChild(tr);
    });

    // Actions
    tbody.querySelectorAll('[data-toggle-product]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.toggleProduct;
        const currentlyDisable = btn.textContent.includes('Disable');
        const newAvail = !currentlyDisable;
        handleToggleProductAvailability(id, newAvail);
      });
    });

    tbody.querySelectorAll('[data-delete-product]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.deleteProduct;
        handleDeleteProduct(id);
      });
    });
  } catch (err) {
    console.error('Admin load products error', err);
    loadingEl.textContent =
      err.message || 'Menu items load nahi ho paaye, thodi der baad try karein.';
  }
}

async function handleToggleProductAvailability(id, makeAvailable) {
  try {
    await Api.patch(`/admin/products/${id}/availability`, {
      isAvailable: makeAvailable
    });
    loadAdminProducts();
  } catch (err) {
    alert(err.message || 'Availability update nahi ho paayi.');
  }
}

async function handleDeleteProduct(id) {
  if (
    !confirm(
      'Kya aap is product ko disable/delete karna chahte hain? Purane orders par koi effect nahi padega.'
    )
  ) {
    return;
  }

  try {
    await Api.delete(`/admin/products/${id}`);
    loadAdminProducts();
  } catch (err) {
    alert(err.message || 'Product delete nahi ho saka.');
  }
}

async function handleAddProduct(e) {
  e.preventDefault();
  const form = e.target;
  const description = form.description.value.trim();
  const imageUrl = form.imageUrl ? form.imageUrl.value.trim() : '';
  const isVeg = form.isVeg.value === 'true';

  const addCatSelect = document.getElementById('admin-add-category-select');
  const addCatCustom = document.getElementById('admin-add-category-custom');

  let category = '';
  if (addCatSelect) {
    const val = addCatSelect.value;
    if (val === '__custom') {
      category = (addCatCustom?.value || '').trim();
    } else {
      category = (val || '').trim();
    }
  }

  if (!name || !category) {
    alert('Name aur Category required hain.');
    return;
  }

  const priceRegular = Number(form.priceRegular.value || 0);
  const priceMedium = Number(form.priceMedium.value || 0);
  const priceLarge = Number(form.priceLarge.value || 0);

  if (!priceRegular && !priceMedium && !priceLarge) {
    alert('Kam se kam ek size ka price dena zaroori hai.');
    return;
  }

  const sizes = [];
  if (priceRegular) sizes.push({ name: 'REGULAR', price: priceRegular });
  if (priceMedium) sizes.push({ name: 'MEDIUM', price: priceMedium });
  if (priceLarge) sizes.push({ name: 'LARGE', price: priceLarge });

  const productBody = {
    name,
    category,
    description,
    image: '',
    isVeg,
    isAvailable: true,
    sizes,
    crusts: [
      {
        name: 'Classic',
        isAvailable: true,
        prices: sizes.map(s => ({ size: s.name, price: 0 }))
      }
    ],
    addOns: []
  };

  try {
    await Api.post('/admin/products', productBody);
    form.reset();

    // Category + size view reset
    if (addCatSelect) addCatSelect.value = '';
    if (addCatCustom) {
      addCatCustom.value = '';
      addCatCustom.style.display = 'none';
    }
    updateAddProductSizeVisibility(
      '',
      document.getElementById('admin-add-size-regular'),
      document.getElementById('admin-add-size-medium'),
      document.getElementById('admin-add-size-large')
    );

    loadAdminProducts();
  } catch (err) {
    console.error('Add product error', err);
    alert(err.message || 'Naya product add nahi ho saka.');
  }
}

// ====================== OVERVIEW (admin/index.html) ======================

async function loadAdminOverview() {
  const totalOrdersEl = document.getElementById('admin-today-orders');
  const salesEl = document.getElementById('admin-today-sales');
  const pendingEl = document.getElementById('admin-today-pending');
  const deliveredEl = document.getElementById('admin-today-delivered');
  const customersEl = document.getElementById('admin-total-customers');

  try {
    const res = await Api.get('/admin/overview');
    const { today, totalCustomers } = res;

    if (totalOrdersEl) totalOrdersEl.textContent = today.totalOrders || 0;
    if (salesEl)
      salesEl.textContent = '₹' + Number(today.sales || 0).toFixed(0);
    if (pendingEl) pendingEl.textContent = today.pendingOrders || 0;
    if (deliveredEl) deliveredEl.textContent = today.deliveredOrders || 0;
    if (customersEl) customersEl.textContent = totalCustomers || 0;
  } catch (err) {
    console.error('Admin overview error', err);
    alert(
      err.message || 'Overview load nahi ho paaya, thodi der baad try karein.'
    );
  }
}

// ====================== ORDERS (admin/orders.html) ======================

// ====================== ORDERS (admin/orders.html) ======================

async function initAdminOrdersPage() {
  const statusSelect = document.getElementById('admin-order-status');
  const searchInput = document.getElementById('admin-order-search');
  const reloadBtn = document.getElementById('admin-order-reload');

  const load = () => loadAdminOrders(1);

  statusSelect && statusSelect.addEventListener('change', load);
  searchInput &&
    searchInput.addEventListener('keyup', e => {
      if (e.key === 'Enter') load();
    });
  reloadBtn && reloadBtn.addEventListener('click', load);

  load();
}

async function loadAdminOrders(page = 1) {
  const statusSelect = document.getElementById('admin-order-status');
  const searchInput = document.getElementById('admin-order-search');
  const tbody = document.getElementById('admin-orders-body');
  const loadingEl = document.getElementById('admin-orders-loading');
  const emptyEl = document.getElementById('admin-orders-empty');

  if (!tbody || !loadingEl || !emptyEl) return;

  loadingEl.style.display = 'block';
  emptyEl.style.display = 'none';
  tbody.innerHTML = '';

  const status = statusSelect ? statusSelect.value : 'ALL';
  const search = searchInput ? searchInput.value.trim() : '';

  const params = new URLSearchParams();
  params.set('status', status || 'ALL');
  params.set('page', page);
  params.set('limit', 50);
  if (search) params.set('search', search);

  try {
    const res = await Api.get(`/admin/orders?${params.toString()}`);
    const orders = res.orders || [];

    loadingEl.style.display = 'none';

    if (!orders.length) {
      emptyEl.style.display = 'block';
      return;
    }

    orders.forEach(o => {
      const tr = document.createElement('tr');

      const createdAt = new Date(o.createdAt).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });

      tr.innerHTML = `
        <td>${String(o._id).slice(-6)}</td>
        <td>${o.user?.name || ''}<br /><span class="text-small">${
        o.user?.contact || ''
      }</span></td>
        <td>${createdAt}</td>
        <td>${o.delivery?.deliveryType || 'DELIVERY'}</td>
        <td>₹${Number(o.grandTotal || 0).toFixed(0)}</td>
        <td>${o.payment?.paymentType || 'COD'}<br /><span class="text-small">${
        o.payment?.paymentStatus || 'PENDING'
      }</span></td>
        <td>${o.status}</td>
        <td>
          <button class="btn btn-danger btn-sm admin-order-delete-btn" data-id="${
            o._id
          }">
            Delete
          </button>
        </td>
      `;

      tbody.appendChild(tr);
    });

    // Delete buttons
    tbody.querySelectorAll('.admin-order-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        deleteAdminOrder(id, () => loadAdminOrders(page));
      });
    });
  } catch (err) {
    console.error('Admin load orders error', err);
    loadingEl.textContent =
      err.message || 'Orders load nahi ho paaye, thodi der baad try karein.';
  }
}

async function deleteAdminOrder(id, onDone) {
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
    console.error('Admin delete order error', err);
    alert(err.message || 'Order delete nahi ho paaya.');
  }
}

// ====================== CUSTOMERS (admin/customers.html) ======================

async function initAdminCustomersPage() {
  loadAdminCustomers();
}

async function loadAdminCustomers() {
  const tbody = document.getElementById('admin-customers-body');
  const loadingEl = document.getElementById('admin-customers-loading');
  const emptyEl = document.getElementById('admin-customers-empty');

  if (!tbody || !loadingEl || !emptyEl) return;

  loadingEl.style.display = 'block';
  emptyEl.style.display = 'none';
  tbody.innerHTML = '';

  try {
    const res = await Api.get('/admin/customers');
    const customers = res.customers || [];

    loadingEl.style.display = 'none';

    if (!customers.length) {
      emptyEl.style.display = 'block';
      return;
    }

    customers.forEach(c => {
      const tr = document.createElement('tr');

      const since = new Date(c.createdAt).toLocaleDateString('en-IN', {
        dateStyle: 'medium'
      });

      tr.innerHTML = `
        <td>${c.name}</td>
        <td>${c.contact}</td>
        <td>${since}</td>
        <td>${c.totalOrders || 0}</td>
        <td>₹${Number(c.totalSpend || 0).toFixed(0)}</td>
        <td>${c.rewardCoins || 0}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Admin load customers error', err);
    loadingEl.textContent =
      err.message ||
      'Customers load nahi ho paaye, thodi der baad dobara try karein.';
  }
}

// ====================== DELIVERY RULES ======================

async function initAdminDeliveryRulesPage() {
  loadAdminDeliveryRules();

  const addForm = document.getElementById('admin-add-rule-form');
  if (addForm && !addForm.dataset.bound) {
    addForm.dataset.bound = 'true';
    addForm.addEventListener('submit', handleAddRule);
  }
}

async function loadAdminDeliveryRules() {
  const tbody = document.getElementById('admin-rules-body');
  const loadingEl = document.getElementById('admin-rules-loading');
  const emptyEl = document.getElementById('admin-rules-empty');

  if (!tbody || !loadingEl || !emptyEl) return;

  loadingEl.style.display = 'block';
  emptyEl.style.display = 'none';
  tbody.innerHTML = '';

  try {
    const res = await Api.get('/admin/delivery-rules');
    const rules = res.rules || [];

    loadingEl.style.display = 'none';

    if (!rules.length) {
      emptyEl.style.display = 'block';
      return;
    }

    rules.forEach(rule => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="number" step="0.1" min="0" value="${
          rule.minDistance
        }" data-field="minDistance" data-id="${rule._id}" /></td>
        <td><input type="number" step="0.1" min="0" value="${
          rule.maxDistance
        }" data-field="maxDistance" data-id="${rule._id}" /></td>
        <td><input type="number" min="0" value="${
          rule.minCartValueForFreeDelivery
        }" data-field="minCartValueForFreeDelivery" data-id="${rule._id}" /></td>
        <td><input type="number" min="0" value="${
          rule.baseDeliveryFee
        }" data-field="baseDeliveryFee" data-id="${rule._id}" /></td>
        <td>
          <button class="btn btn-secondary btn-sm" data-toggle="${
            rule._id
          }">
            ${rule.isActive ? 'Active' : 'Inactive'}
          </button>
        </td>
        <td>
          <button class="btn btn-primary btn-sm" data-save="${rule._id}">
            Save
          </button>
        </td>
      `;

      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('[data-save]').forEach(btn => {
      btn.addEventListener('click', () => handleSaveRule(btn.dataset.save));
    });

    tbody.querySelectorAll('[data-toggle]').forEach(btn => {
      btn.addEventListener('click', () => handleToggleRule(btn.dataset.toggle));
    });

    tbody.querySelectorAll('[data-image-product]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.imageProduct;
        const currentRow = btn.closest('tr');
        const currentImg = currentRow
          ? currentRow.querySelector('img')
          : null;
        const currentUrl = currentImg ? currentImg.src : '';

        handleChangeProductImage(id, currentUrl);
      });
    });
async function handleChangeProductImage(id, currentUrl) {
  const newUrl = window.prompt(
    'Image URL enter karein (blank rakhne se image hata di jayegi):',
    currentUrl || ''
  );

  if (newUrl === null) return; // user ne cancel kiya

  const body = { image: newUrl.trim() || '' };

  try {
    await Api.put(`/admin/products/${id}`, body);
    loadAdminProducts();
  } catch (err) {
    alert(err.message || 'Image update nahi ho paayi.');
  }
}
  } catch (err) {
    console.error('Admin load rules error', err);
    loadingEl.textContent =
      err.message || 'Delivery rules load nahi ho paaye.';
  }
}

async function handleSaveRule(id) {
  const rowInputs = document.querySelectorAll(`input[data-id="${id}"]`);
  const body = {};
  rowInputs.forEach(input => {
    const field = input.dataset.field;
    body[field] = Number(input.value || 0);
  });

  try {
    await Api.put(`/admin/delivery-rules/${id}`, body);
    alert('Rule saved.');
  } catch (err) {
    alert(err.message || 'Rule save nahi ho saka.');
  }
}

async function handleToggleRule(id) {
  try {
    await Api.patch(`/admin/delivery-rules/${id}/toggle`, {});
    loadAdminDeliveryRules();
  } catch (err) {
    alert(err.message || 'Rule toggle nahi ho saka.');
  }
}

async function handleAddRule(e) {
  e.preventDefault();
  const form = e.target;

  const body = {
    minDistance: Number(form.minDistance.value || 0),
    maxDistance: Number(form.maxDistance.value || 0),
    minCartValueForFreeDelivery: Number(
      form.minCartValueForFreeDelivery.value || 0
    ),
    baseDeliveryFee: Number(form.baseDeliveryFee.value || 0),
    isActive: true
  };

  try {
    await Api.post('/admin/delivery-rules', body);
    form.reset();
    loadAdminDeliveryRules();
  } catch (err) {
    alert(err.message || 'Naya rule create nahi ho saka.');
  }
}
// ====================== COUPONS (admin/coupons.html) ======================

async function initAdminCouponsPage() {
  loadAdminCoupons();

  const addForm = document.getElementById('admin-add-coupon-form');
  if (addForm && !addForm.dataset.bound) {
    addForm.dataset.bound = 'true';
    addForm.addEventListener('submit', handleAddCoupon);
  }
}

async function loadAdminCoupons() {
  const tbody = document.getElementById('admin-coupons-body');
  const loadingEl = document.getElementById('admin-coupons-loading');
  const emptyEl = document.getElementById('admin-coupons-empty');

  if (!tbody || !loadingEl || !emptyEl) return;

  loadingEl.style.display = 'block';
  emptyEl.style.display = 'none';
  tbody.innerHTML = '';

  try {
    const res = await Api.get('/admin/coupons');
    const coupons = res.coupons || [];

    loadingEl.style.display = 'none';

    if (!coupons.length) {
      emptyEl.style.display = 'block';
      return;
    }

    coupons.forEach(c => {
      const tr = document.createElement('tr');

      const daysStr = Array.isArray(c.daysOfWeek)
        ? c.daysOfWeek.join(',')
        : '';

      const timeStr =
        typeof c.startHour === 'number' &&
        typeof c.endHour === 'number'
          ? `${c.startHour}-${c.endHour}`
          : '';

      tr.innerHTML = `
        <td>${c.code}</td>
        <td><input type="text" value="${
          c.description || ''
        }" data-field="description" data-id="${c._id}" /></td>
        <td>
          <select data-field="discountType" data-id="${c._id}">
            <option value="FLAT" ${
              c.discountType === 'FLAT' ? 'selected' : ''
            }>Flat</option>
            <option value="PERCENT" ${
              c.discountType === 'PERCENT' ? 'selected' : ''
            }>Percent</option>
          </select>
        </td>
        <td><input type="number" min="0" value="${
          c.amount
        }" data-field="amount" data-id="${c._id}" /></td>
        <td><input type="number" min="0" value="${
          c.minCartAmount || 0
        }" data-field="minCartAmount" data-id="${c._id}" /></td>
        <td><input type="number" min="0" value="${
          c.maxDiscount || 0
        }" data-field="maxDiscount" data-id="${c._id}" /></td>
        <td><input type="text" value="${daysStr}" data-field="daysOfWeek" data-id="${
          c._id
        }" placeholder="0,1,2..." /></td>
        <td><input type="text" value="${timeStr}" data-field="timeWindow" data-id="${
        c._id
      }" placeholder="14-16" /></td>
        <td>
          <button class="btn btn-secondary btn-sm" data-toggle-coupon="${
            c._id
          }">
            ${c.isActive ? 'Active' : 'Inactive'}
          </button>
        </td>
        <td>
          <button class="btn btn-primary btn-sm" data-save-coupon="${
            c._id
          }">
            Save
          </button>
        </td>
      `;

      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('[data-save-coupon]').forEach(btn => {
      btn.addEventListener('click', () =>
        handleSaveCoupon(btn.dataset.saveCoupon)
      );
    });

    tbody.querySelectorAll('[data-toggle-coupon]').forEach(btn => {
      btn.addEventListener('click', () =>
        handleToggleCoupon(btn.dataset.toggleCoupon)
      );
    });
  } catch (err) {
    console.error('Admin load coupons error', err);
    loadingEl.textContent =
      err.message || 'Coupons load nahi ho paaye, thodi der baad try karein.';
  }
}

function parseDaysOfWeek(str) {
  if (!str) return [];
  return str
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(n => Number(n))
    .filter(n => Number.isInteger(n) && n >= 0 && n <= 6);
}

function parseTimeWindow(str) {
  if (!str) return { startHour: null, endHour: null };
  const parts = str.split('-').map(s => s.trim());
  if (parts.length !== 2) return { startHour: null, endHour: null };
  const start = Number(parts[0]);
  const end = Number(parts[1]);
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    start > 23 ||
    end < 0 ||
    end > 23
  ) {
    return { startHour: null, endHour: null };
  }
  return { startHour: start, endHour: end };
}

async function handleSaveCoupon(id) {
  const rowInputs = document.querySelectorAll(
    `[data-id="${id}"][data-field]`
  );
  const body = {};

  rowInputs.forEach(input => {
    const field = input.dataset.field;
    let value = input.value;

    if (field === 'amount' || field === 'minCartAmount' || field === 'maxDiscount') {
      body[field] = Number(value || 0);
    } else if (field === 'discountType') {
      body[field] = value;
    } else if (field === 'description') {
      body[field] = value;
    } else if (field === 'daysOfWeek') {
      body.daysOfWeek = parseDaysOfWeek(value);
    } else if (field === 'timeWindow') {
      const tw = parseTimeWindow(value);
      body.startHour = tw.startHour;
      body.endHour = tw.endHour;
    }
  });

  try {
    await Api.put(`/admin/coupons/${id}`, body);
    alert('Coupon updated.');
    loadAdminCoupons();
  } catch (err) {
    alert(err.message || 'Coupon update nahi ho saka.');
  }
}

async function handleToggleCoupon(id) {
  try {
    await Api.patch(`/admin/coupons/${id}/toggle`, {});
    loadAdminCoupons();
  } catch (err) {
    alert(err.message || 'Coupon toggle nahi ho saka.');
  }
}

async function handleAddCoupon(e) {
  e.preventDefault();
  const form = e.target;

  const code = form.code.value.trim();
  const description = form.description.value.trim();
  const discountType = form.discountType.value;
  const amount = Number(form.amount.value || 0);
  const minCartAmount = Number(form.minCartAmount.value || 0);
  const maxDiscount = Number(form.maxDiscount.value || 0);

  const daysOfWeek = parseDaysOfWeek(form.daysOfWeek.value.trim());
  const timeWindow = parseTimeWindow(form.timeWindow.value.trim());

  if (!code || !amount) {
    alert('Code aur amount required hain.');
    return;
  }

  const body = {
    code,
    description,
    discountType,
    amount,
    minCartAmount,
    maxDiscount,
    daysOfWeek,
    startHour: timeWindow.startHour,
    endHour: timeWindow.endHour
  };

  try {
    await Api.post('/admin/coupons', body);
    form.reset();
    loadAdminCoupons();
  } catch (err) {
    alert(err.message || 'Naya coupon create nahi ho saka.');
  }
}