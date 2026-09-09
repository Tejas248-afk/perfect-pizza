// ====================== COMMON ADMIN INIT ======================

const ADMIN_OUTLET_KEY = 'pp_admin_outletId';
const ADMIN_OUTLET_NAME_KEY = 'pp_admin_outletName';

document.addEventListener('DOMContentLoaded', () => {
  if (typeof setupAuthNav === 'function') {
    setupAuthNav();
  }

  // Only ADMIN user can access admin code
  if (!ensureAdmin()) return;

  // Pehle outlet dropdown load karo, phir baaki pages init
  initAdminOutletSelector().then(() => {
    if (document.getElementById('admin-overview')) {
      loadAdminOverview();
    }

    if (document.getElementById('admin-outlet-form')) {
      initAdminOutletForm();
    }

    if (document.getElementById('admin-products-table')) {
      initAdminProductsPage();
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

    if (document.getElementById('admin-coupons-table')) {
      initAdminCouponsPage();
    }

    // NEW: Outlets management page
    if (document.getElementById('admin-outlets-table')) {
      initAdminOutletsPage();
    }
  });
});

function ensureAdmin() {
  const user = Api.getStoredUser();
  if (!user || !Api.getToken()) {
    alert('Please log in with an admin account to access the admin panel.');
    window.location.href = '../login.html';
    return false;
  }

  if (user.role !== 'ADMIN') {
    alert('Only ADMIN users can access the admin panel.');
    if (user.role === 'KITCHEN') {
      window.location.href = '../kitchen/orders.html';
    } else {
      window.location.href = '../index.html';
    }
    return false;
  }

  return true;
}

// --------- Outlet selection helpers (multi-outlet) ----------

function getCurrentAdminOutletId() {
  return localStorage.getItem(ADMIN_OUTLET_KEY) || '';
}

function getCurrentAdminOutletName() {
  return localStorage.getItem(ADMIN_OUTLET_NAME_KEY) || '';
}

function setCurrentAdminOutlet(id, name) {
  if (id) {
    localStorage.setItem(ADMIN_OUTLET_KEY, id);
    localStorage.setItem(ADMIN_OUTLET_NAME_KEY, name || '');
  } else {
    localStorage.removeItem(ADMIN_OUTLET_KEY);
    localStorage.removeItem(ADMIN_OUTLET_NAME_KEY);
  }
}

async function initAdminOutletSelector() {
  const selectEl = document.getElementById('admin-outlet-select');
  if (!selectEl) return;

  try {
    const res = await Api.get('/admin/outlets');
    const outlets = res.outlets || [];

    const currentId = getCurrentAdminOutletId();

    selectEl.innerHTML =
      '<option value="">All Outlets</option>' +
      outlets
        .map(
          o =>
            `<option value="${o._id}">${o.name}${
              o.city ? ' – ' + o.city : ''
            }</option>`
        )
        .join('');

    if (currentId) {
      selectEl.value = currentId;
    }

    selectEl.addEventListener('change', () => {
      const id = selectEl.value || '';
      const found = outlets.find(o => o._id === id);
      const name = found ? found.name : '';
      setCurrentAdminOutlet(id, name);
      // Simple: page reload so saare sections naya outlet use karein
      window.location.reload();
    });
  } catch (err) {
    console.error('Admin outlet selector load error', err);
    // Agar fail ho gaya to bhi page chalega, sirf outlet filter nahi lagega
  }
}

// Global for change-image flow + product cache
let currentImageProductId = null;
let adminProductsById = {};

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

    // Initial: when no category selected, show only Regular
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

  // Hidden input for "Change Image" buttons
  const changeImageInput = document.getElementById('admin-change-image-input');
  if (changeImageInput && !changeImageInput.dataset.bound) {
    changeImageInput.dataset.bound = 'true';
    changeImageInput.addEventListener('change', handleChangeProductImageFile);
  }

  // Setup edit modal
  setupEditProductModal();

  loadAdminProducts();
}

// Category wise show/hide size fields
function updateAddProductSizeVisibility(
  categoryLabel,
  regularGroup,
  mediumGroup,
  largeGroup
) {
  if (!regularGroup || !mediumGroup || !largeGroup) return;

  const label = (categoryLabel || '').toLowerCase();

  const isPizza = label.includes('pizza');

  regularGroup.style.display = 'block';

  if (isPizza) {
    mediumGroup.style.display = 'block';
    largeGroup.style.display = 'block';
  } else {
    mediumGroup.style.display = 'none';
    largeGroup.style.display = 'none';
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
  adminProductsById = {};

  try {
    const res = await Api.get('/admin/products');
    let products = res.products || [];

    // Cache by ID
    products.forEach(p => {
      adminProductsById[p._id] = p;
    });

    const cats = Array.from(
      new Set(products.map(p => p.category).filter(Boolean))
    );

    if (catSelect) {
      catSelect.innerHTML =
        '<option value="">All Categories</option>' +
        cats.map(c => `<option value="${c}">${c}</option>`).join('');
    }

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
          <button class="btn btn-primary btn-sm" data-edit-product="${p._id}">
            Edit
          </button>
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

    // Change Image buttons
    tbody.querySelectorAll('[data-image-product]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.imageProduct;
        openImageFilePickerForProduct(id);
      });
    });

    // Edit buttons
    tbody.querySelectorAll('[data-edit-product]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.editProduct;
        openEditProductModal(id);
      });
    });
  } catch (err) {
    console.error('Admin load products error', err);
    loadingEl.textContent =
      err.message ||
      'Unable to load menu items. Please try again after some time.';
  }
}

async function handleToggleProductAvailability(id, makeAvailable) {
  try {
    await Api.patch(`/admin/products/${id}/availability`, {
      isAvailable: makeAvailable
    });
    loadAdminProducts();
  } catch (err) {
    alert(err.message || 'Unable to update availability status.');
  }
}

async function handleDeleteProduct(id) {
  if (
    !confirm(
      'Are you sure you want to disable/delete this product? Existing orders will not be affected.'
    )
  ) {
    return;
  }

  try {
    await Api.delete(`/admin/products/${id}`);
    loadAdminProducts();
  } catch (err) {
    alert(err.message || 'Unable to delete this product.');
  }
}

async function handleAddProduct(e) {
  e.preventDefault();
  const form = e.target;
  const name = form.name.value.trim();
  const description = form.description.value.trim();
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
    alert('Name and Category are required.');
    return;
  }

  const priceRegular = Number(form.priceRegular.value || 0);
  const priceMedium = Number(form.priceMedium.value || 0);
  const priceLarge = Number(form.priceLarge.value || 0);

  if (!priceRegular && !priceMedium && !priceLarge) {
    alert('Please enter a price for at least one size.');
    return;
  }

  const sizes = [];
  if (priceRegular) sizes.push({ name: 'REGULAR', price: priceRegular });
  if (priceMedium) sizes.push({ name: 'MEDIUM', price: priceMedium });
  if (priceLarge) sizes.push({ name: 'LARGE', price: priceLarge });

  const availableFromHour =
    form.availableFromHour && form.availableFromHour.value !== ''
      ? Number(form.availableFromHour.value)
      : null;
  const availableToHour =
    form.availableToHour && form.availableToHour.value !== ''
      ? Number(form.availableToHour.value)
      : null;

  const productBody = {
    name,
    category,
    description,
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
    addOns: [],
    availableFromHour,
    availableToHour
  };

  const formData = new FormData();
  formData.append('data', JSON.stringify(productBody));

  const imageInput = form.image;
  if (imageInput && imageInput.files && imageInput.files[0]) {
    formData.append('image', imageInput.files[0]);
  }

  try {
    await Api.post('/admin/products', formData);
    form.reset();

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
    alert(err.message || 'Unable to add the new product.');
  }
}

// Image change helpers
function openImageFilePickerForProduct(id) {
  const input = document.getElementById('admin-change-image-input');
  if (!input) {
    alert('Image file input not found.');
    return;
  }
  currentImageProductId = id;
  input.value = ''; // reset
  input.click();
}

async function handleChangeProductImageFile(e) {
  const file = e.target.files[0];
  if (!file || !currentImageProductId) return;

  const formData = new FormData();
  formData.append('image', file);

  try {
    await Api.put(`/admin/products/${currentImageProductId}`, formData);
    currentImageProductId = null;
    e.target.value = '';
    loadAdminProducts();
  } catch (err) {
    console.error('Change image error', err);
    alert(err.message || 'Unable to update the image.');
  }
}

// ========== EDIT PRODUCT MODAL + ADD-ONS + COMBO CONFIG ==========

function setupEditProductModal() {
  const modal = document.getElementById('admin-edit-product-modal');
  if (!modal || modal.dataset.bound) return;
  modal.dataset.bound = 'true';

  const form = document.getElementById('admin-edit-product-form');
  const cancelBtn = document.getElementById('edit-product-cancel');
  const addAddonBtn = document.getElementById('edit-addons-add-btn');
  const addComboGroupBtn = document.getElementById(
    'edit-combo-add-group-btn'
  );

  if (form) {
    form.addEventListener('submit', handleSaveEditProduct);
  }
  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeEditProductModal);
  }

  modal.addEventListener('click', e => {
    if (e.target === modal) {
      closeEditProductModal();
    }
  });

  if (addAddonBtn) {
    addAddonBtn.addEventListener('click', () => addEmptyAddonRow());
  }

  if (addComboGroupBtn) {
    addComboGroupBtn.addEventListener('click', () => addEmptyComboGroup());
  }
}

function openEditProductModal(productId) {
  const product = adminProductsById[productId];
  if (!product) {
    alert('Product not found in cache.');
    return;
  }

  const idEl = document.getElementById('edit-product-id');
  const nameEl = document.getElementById('edit-name');
  const catSelectEl = document.getElementById('edit-category-select');
  const catCustomEl = document.getElementById('edit-category-custom');
  const descEl = document.getElementById('edit-description');
  const isVegEl = document.getElementById('edit-isVeg');
  const isAvailEl = document.getElementById('edit-isAvailable');
  const priceRegEl = document.getElementById('edit-price-regular');
  const priceMedEl = document.getElementById('edit-price-medium');
  const priceLgEl = document.getElementById('edit-price-large');
  const fromEl = document.getElementById('edit-available-from');
  const toEl = document.getElementById('edit-available-to');

  if (!idEl) return;

  idEl.value = product._id || '';
  if (nameEl) nameEl.value = product.name || '';
  if (descEl) descEl.value = product.description || '';
  if (isVegEl) isVegEl.value = product.isVeg ? 'true' : 'false';
  if (isAvailEl) isAvailEl.checked = !!product.isAvailable;

  // Fill category options from all products
  if (catSelectEl) {
    const allCats = Array.from(
      new Set(
        Object.values(adminProductsById)
          .map(p => p.category)
          .filter(Boolean)
      )
    );

    catSelectEl.innerHTML =
      '<option value="">Select category</option>' +
      allCats.map(c => `<option value="${c}">${c}</option>`).join('') +
      '<option value="__custom">Other (custom)</option>';

    const currentCat = product.category || '';
    if (allCats.includes(currentCat)) {
      catSelectEl.value = currentCat;
      if (catCustomEl) {
        catCustomEl.style.display = 'none';
        catCustomEl.value = '';
      }
    } else if (currentCat) {
      catSelectEl.value = '__custom';
      if (catCustomEl) {
        catCustomEl.value = currentCat;
        catCustomEl.style.display = 'block';
      }
    } else {
      catSelectEl.value = '';
      if (catCustomEl) {
        catCustomEl.value = '';
        catCustomEl.style.display = 'none';
      }
    }

    // change handler (only once)
    if (!catSelectEl.dataset.bound) {
      catSelectEl.dataset.bound = 'true';
      catSelectEl.addEventListener('change', () => {
        if (!catCustomEl) return;
        if (catSelectEl.value === '__custom') {
          catCustomEl.style.display = 'block';
        } else {
          catCustomEl.style.display = 'none';
          catCustomEl.value = '';
        }
      });
    }
  }

  // Prices
  const sizes = product.sizes || [];
  const findPrice = sizeName => {
    const s = sizes.find(s => s.name === sizeName);
    return s ? s.price : '';
  };
  if (priceRegEl) priceRegEl.value = findPrice('REGULAR') || '';
  if (priceMedEl) priceMedEl.value = findPrice('MEDIUM') || '';
  if (priceLgEl) priceLgEl.value = findPrice('LARGE') || '';

  // Time window
  if (fromEl) fromEl.value = product.availableFromHour ?? '';
  if (toEl) toEl.value = product.availableToHour ?? '';

  // Add-ons
  renderEditAddOns(product.addOns || []);

  // Combo config
  renderEditComboConfig(product.comboConfig || null);

  const modal = document.getElementById('admin-edit-product-modal');
  if (modal) {
    modal.style.display = 'flex';
  }
}

function closeEditProductModal() {
  const modal = document.getElementById('admin-edit-product-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

function getAddonPrice(addon, sizeName) {
  if (!addon || !Array.isArray(addon.prices)) return '';
  const p = addon.prices.find(x => x.size === sizeName);
  return p ? p.price : '';
}

function createAddonRow(addon) {
  const container = document.getElementById('edit-addons-container');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'edit-addon-row';
  row.style.display = 'grid';
  row.style.gridTemplateColumns = '2fr repeat(3, 1fr) auto';
  row.style.gap = '0.5rem';
  row.style.alignItems = 'center';
  row.style.marginBottom = '0.5rem';

  const name = addon?.name || '';
  const regPrice = getAddonPrice(addon, 'REGULAR') || '';
  const medPrice = getAddonPrice(addon, 'MEDIUM') || '';
  const lgPrice = getAddonPrice(addon, 'LARGE') || '';
  const isRequired = !!(addon && addon.isRequired);

  row.innerHTML = `
    <input
      type="text"
      class="input"
      placeholder="Name"
      data-addon-field="name"
      value="${name}"
    />
    <input
      type="number"
      class="input"
      min="0"
      step="1"
      placeholder="R"
      data-addon-field="priceRegular"
      value="${regPrice}"
    />
    <input
      type="number"
      class="input"
      min="0"
      step="1"
      placeholder="M"
      data-addon-field="priceMedium"
      value="${medPrice}"
    />
    <input
      type="number"
      class="input"
      min="0"
      step="1"
      placeholder="L"
      data-addon-field="priceLarge"
      value="${lgPrice}"
    />
    <div style="display:flex;align-items:center;gap:0.25rem;">
      <label class="text-small">
        <input type="checkbox" data-addon-field="isRequired" ${
          isRequired ? 'checked' : ''
        } />
        Req
      </label>
      <button
        type="button"
        class="btn btn-danger-outline btn-sm"
        data-addon-remove
      >
        &times;
      </button>
    </div>
  `;

  const removeBtn = row.querySelector('[data-addon-remove]');
  removeBtn.addEventListener('click', () => row.remove());

  container.appendChild(row);
}

function renderEditAddOns(addOns) {
  const container = document.getElementById('edit-addons-container');
  if (!container) return;
  container.innerHTML = '';
  (addOns || []).forEach(a => createAddonRow(a));
}

function addEmptyAddonRow() {
  createAddonRow({});
}

function collectEditAddOnsFromDOM() {
  const container = document.getElementById('edit-addons-container');
  if (!container) return [];
  const rows = container.querySelectorAll('.edit-addon-row');
  const addOns = [];

  rows.forEach(row => {
    const nameEl = row.querySelector('[data-addon-field="name"]');
    const regEl = row.querySelector('[data-addon-field="priceRegular"]');
    const medEl = row.querySelector('[data-addon-field="priceMedium"]');
    const lgEl = row.querySelector('[data-addon-field="priceLarge"]');
    const reqEl = row.querySelector('[data-addon-field="isRequired"]');

    const name = (nameEl?.value || '').trim();
    const reg = Number(regEl?.value || 0);
    const med = Number(medEl?.value || 0);
    const lg = Number(lgEl?.value || 0);

    const anyPrice = !!(reg || med || lg);

    // Completely empty row -> ignore
    if (!name && !anyPrice) {
      return;
    }

    const prices = [];
    if (reg) prices.push({ size: 'REGULAR', price: reg });
    if (med) prices.push({ size: 'MEDIUM', price: med });
    if (lg) prices.push({ size: 'LARGE', price: lg });

    addOns.push({
      name,
      isRequired: !!(reqEl && reqEl.checked),
      prices
    });
  });

  return addOns;
}

// --------- Combo config helpers ---------

function createComboOptionRow(groupEl, option) {
  const optionsContainer = groupEl.querySelector('.edit-combo-options');
  if (!optionsContainer) return;

  const row = document.createElement('div');
  row.className = 'edit-combo-option-row';
  row.style.display = 'grid';
  row.style.gridTemplateColumns = '2fr 1fr auto';
  row.style.gap = '0.5rem';
  row.style.alignItems = 'center';
  row.style.marginBottom = '0.5rem';

  const label = option?.label || '';
  const extraPrice =
    typeof option?.extraPrice === 'number' ? option.extraPrice : '';

  row.innerHTML = `
    <input
      type="text"
      class="input"
      placeholder="Pizza / item name"
      data-combo-option-field="label"
      value="${label}"
    />
    <input
      type="number"
      class="input"
      min="0"
      step="1"
      placeholder="Extra price"
      data-combo-option-field="extraPrice"
      value="${extraPrice}"
    />
    <button
      type="button"
      class="btn btn-danger-outline btn-sm"
      data-combo-option-remove
    >
      &times;
    </button>
  `;

  const removeBtn = row.querySelector('[data-combo-option-remove]');
  removeBtn.addEventListener('click', () => row.remove());

  optionsContainer.appendChild(row);
}

function createComboGroupRow(group) {
  const container = document.getElementById('edit-combo-groups-container');
  if (!container) return;

  const groupEl = document.createElement('div');
  groupEl.className = 'edit-combo-group';
  groupEl.style.border = '1px solid #eee';
  groupEl.style.borderRadius = '6px';
  groupEl.style.padding = '0.5rem';
  groupEl.style.marginBottom = '0.75rem';

  const title = group?.title || group?.name || '';
  const required =
    typeof group?.required === 'boolean' ? group.required : true;
  const options = Array.isArray(group?.options) ? group.options : [];

  groupEl.innerHTML = `
    <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;flex-wrap:wrap;">
      <input
        type="text"
        class="input"
        placeholder="Group title (e.g. Choose Pizza [Regular])"
        data-combo-group-field="title"
        value="${title}"
        style="flex:1 1 200px;"
      />
      <label class="text-small">
        <input
          type="checkbox"
          data-combo-group-field="required"
          ${required ? 'checked' : ''}
        />
        Required
      </label>
      <button
        type="button"
        class="btn btn-danger-outline btn-sm"
        data-combo-group-remove
      >
        &times;
      </button>
    </div>
    <div class="edit-combo-options"></div>
    <button
      type="button"
      class="btn btn-secondary btn-sm"
      data-combo-add-option
    >
      Add Option
    </button>
  `;

  const addOptionBtn = groupEl.querySelector('[data-combo-add-option]');
  addOptionBtn.addEventListener('click', () =>
    createComboOptionRow(groupEl, {})
  );

  const removeGroupBtn = groupEl.querySelector('[data-combo-group-remove]');
  removeGroupBtn.addEventListener('click', () => groupEl.remove());

  // Existing options
  if (options.length) {
    options.forEach(opt => createComboOptionRow(groupEl, opt));
  } else {
    // Ek empty option row by default
    createComboOptionRow(groupEl, {});
  }

  container.appendChild(groupEl);
}

function renderEditComboConfig(comboConfig) {
  const container = document.getElementById('edit-combo-groups-container');
  if (!container) return;
  container.innerHTML = '';

  if (!comboConfig) return;

  const rawGroups = Array.isArray(comboConfig.groups)
    ? comboConfig.groups
    : Array.isArray(comboConfig)
      ? comboConfig
      : [];

  rawGroups.forEach(group => createComboGroupRow(group));
}

function addEmptyComboGroup() {
  createComboGroupRow({
    title: '',
    required: true,
    options: [{ label: '', extraPrice: 0 }]
  });
}

function collectEditComboConfigFromDOM() {
  const container = document.getElementById('edit-combo-groups-container');
  if (!container) return null;

  const groupEls = container.querySelectorAll('.edit-combo-group');
  const groups = [];

  groupEls.forEach(groupEl => {
    const titleEl = groupEl.querySelector(
      '[data-combo-group-field="title"]'
    );
    const requiredEl = groupEl.querySelector(
      '[data-combo-group-field="required"]'
    );
    const rawTitle = (titleEl?.value || '').trim();

    const optionsContainer = groupEl.querySelector('.edit-combo-options');
    const optionRows = optionsContainer
      ? optionsContainer.querySelectorAll('.edit-combo-option-row')
      : [];
    const options = [];

    optionRows.forEach(row => {
      const labelEl = row.querySelector(
        '[data-combo-option-field="label"]'
      );
      const extraPriceEl = row.querySelector(
        '[data-combo-option-field="extraPrice"]'
      );

      const label = (labelEl?.value || '').trim();
      const extraPrice = Number(extraPriceEl?.value || 0);

      // Blank option -> ignore
      if (!label && !extraPrice) return;

      options.push({
        label,
        extraPrice
      });
    });

    // Pure empty group (no title, no options) -> ignore
    if (!rawTitle && !options.length) return;

    const keyBase = rawTitle
      ? rawTitle
          .toLowerCase()
          .replace(/\s+/g, '_')
          .replace(/[^a-z0-9_]/g, '')
      : '';
    const key =
      keyBase ||
      `group_${groups.length + 1}`;

    groups.push({
      key,
      title: rawTitle || key,
      required: !!(requiredEl && requiredEl.checked),
      options
    });
  });

  return groups.length ? groups : null;
}

async function handleSaveEditProduct(e) {
  e.preventDefault();

  const idEl = document.getElementById('edit-product-id');
  const nameEl = document.getElementById('edit-name');
  const catSelectEl = document.getElementById('edit-category-select');
  const catCustomEl = document.getElementById('edit-category-custom');
  const descEl = document.getElementById('edit-description');
  const isVegEl = document.getElementById('edit-isVeg');
  const isAvailEl = document.getElementById('edit-isAvailable');
  const priceRegEl = document.getElementById('edit-price-regular');
  const priceMedEl = document.getElementById('edit-price-medium');
  const priceLgEl = document.getElementById('edit-price-large');
  const fromEl = document.getElementById('edit-available-from');
  const toEl = document.getElementById('edit-available-to');

  const id = idEl?.value;
  const name = (nameEl?.value || '').trim();

  // Category from dropdown + custom
  let category = '';
  if (catSelectEl) {
    const val = catSelectEl.value;
    if (val === '__custom') {
      category = (catCustomEl?.value || '').trim();
    } else {
      category = (val || '').trim();
    }
  }

  const description = (descEl?.value || '').trim();
  const isVeg = isVegEl?.value === 'true';
  const isAvailable = !!(isAvailEl && isAvailEl.checked);

  if (!id) {
    alert('Product ID missing.');
    return;
  }
  if (!name || !category) {
    alert('Name and Category are required.');
    return;
  }

  const priceReg = Number(priceRegEl?.value || 0);
  const priceMed = Number(priceMedEl?.value || 0);
  const priceLg = Number(priceLgEl?.value || 0);

  if (!priceReg && !priceMed && !priceLg) {
    alert('Please enter a price for at least one size.');
    return;
  }

  const sizes = [];
  if (priceReg) sizes.push({ name: 'REGULAR', price: priceReg });
  if (priceMed) sizes.push({ name: 'MEDIUM', price: priceMed });
  if (priceLg) sizes.push({ name: 'LARGE', price: priceLg });

  const addOns = collectEditAddOnsFromDOM();
  const comboGroups = collectEditComboConfigFromDOM();

  // Time window
  const availableFromHour =
    fromEl && fromEl.value !== '' ? Number(fromEl.value) : null;
  const availableToHour =
    toEl && toEl.value !== '' ? Number(toEl.value) : null;

  const orig = adminProductsById[id] || {};
  const productBody = {
    name,
    category,
    description,
    isVeg,
    isAvailable,
    sizes,
    crusts: Array.isArray(orig.crusts) ? orig.crusts : [],
    addOns,
    comboConfig:
      comboGroups && comboGroups.length
        ? { groups: comboGroups }
        : null,
    availableFromHour,
    availableToHour
  };

  try {
    await Api.put(`/admin/products/${id}`, productBody);
    closeEditProductModal();
    loadAdminProducts();
  } catch (err) {
    console.error('Edit product save error', err);
    alert(err.message || 'Unable to save product changes.');
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
    const outletId = getCurrentAdminOutletId();
    const url = outletId
      ? `/admin/overview?outletId=${outletId}`
      : '/admin/overview';

    const res = await Api.get(url);
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
      err.message ||
        'Unable to load overview. Please try again after some time.'
    );
  }
}

// ====================== OUTLET SETTINGS (admin/index.html) ======================

async function initAdminOutletForm() {
  const form = document.getElementById('admin-outlet-form');
  if (!form) return;

  await loadAdminOutletConfig();

  if (!form.dataset.bound) {
    form.dataset.bound = 'true';
    form.addEventListener('submit', handleSaveOutletConfig);
  }
}

async function loadAdminOutletConfig() {
  const openEl = document.getElementById('outlet-open-hour');
  const closeEl = document.getElementById('outlet-close-hour');
  const onlineEl = document.getElementById('outlet-online-orders');
  const bogoEl = document.getElementById('outlet-bogo');
  const statusEl = document.getElementById('admin-outlet-status');

  if (!openEl || !closeEl || !onlineEl || !bogoEl) return;

  try {
    const res = await Api.get('/admin/outlet');
    const { name, openHour, closeHour, settings } = res;

    openEl.value = openHour ?? 10;
    closeEl.value = closeHour ?? 23;
    onlineEl.checked =
      settings && typeof settings.enableOnlineOrders === 'boolean'
        ? settings.enableOnlineOrders
        : true;
    bogoEl.checked =
      settings && typeof settings.enableBogoTuesday === 'boolean'
        ? settings.enableBogoTuesday
        : true;

    if (statusEl) {
      statusEl.textContent = name ? `Outlet: ${name}` : '';
    }
  } catch (err) {
    console.error('Admin load outlet error', err);
    if (statusEl) {
      statusEl.textContent =
        err.message || 'Unable to load outlet settings.';
    }
  }
}

async function handleSaveOutletConfig(e) {
  e.preventDefault();

  const openEl = document.getElementById('outlet-open-hour');
  const closeEl = document.getElementById('outlet-close-hour');
  const onlineEl = document.getElementById('outlet-online-orders');
  const bogoEl = document.getElementById('outlet-bogo');
  const statusEl = document.getElementById('admin-outlet-status');

  const body = {
    openHour: Number(openEl.value || 0),
    closeHour: Number(closeEl.value || 0),
    enableOnlineOrders: !!onlineEl.checked,
    enableBogoTuesday: !!bogoEl.checked
  };

  try {
    await Api.put('/admin/outlet', body);
    if (statusEl) {
      statusEl.textContent = 'Outlet settings saved.';
    }
  } catch (err) {
    console.error('Admin save outlet error', err);
    alert(err.message || 'Unable to update outlet settings.');
  }
}

// ====================== ORDERS (admin/orders.html) ======================

async function initAdminOrdersPage() {
  const statusSelect = document.getElementById('admin-order-status');
  const searchInput = document.getElementById('admin-order-search');
  const reloadBtn = document.getElementById('admin-order-reload');
  const todayOnlyEl = document.getElementById('admin-order-today-only');

  const load = () => loadAdminOrders(1);

  statusSelect && statusSelect.addEventListener('change', load);
  todayOnlyEl && todayOnlyEl.addEventListener('change', load);
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
  const todayOnlyEl = document.getElementById('admin-order-today-only');
  const tbody = document.getElementById('admin-orders-body');
  const loadingEl = document.getElementById('admin-orders-loading');
  const emptyEl = document.getElementById('admin-orders-empty');

  if (!tbody || !loadingEl || !emptyEl) return;

  loadingEl.style.display = 'block';
  emptyEl.style.display = 'none';
  tbody.innerHTML = '';

  const status = statusSelect ? statusSelect.value : 'ALL';
  const search = searchInput ? searchInput.value.trim() : '';
  const todayOnly = todayOnlyEl ? todayOnlyEl.checked : false;
  const outletId = getCurrentAdminOutletId();

  const params = new URLSearchParams();
  params.set('status', status || 'ALL');
  params.set('page', page);
  params.set('limit', 50);
  if (search) params.set('search', search);
  if (todayOnly) params.set('onlyToday', 'true');
  if (outletId) params.set('outletId', outletId);

  try {
    const res = await Api.get(`/admin/orders?${params.toString()}`);
    const orders = res.orders || [];

    loadingEl.style.display = 'none';

    if (!orders.length) {
      emptyEl.style.display = 'block';
      return;
    }

    const allowedStatuses = [
      'PLACED',
      'BAKING',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'CANCELLED'
    ];

    orders.forEach(o => {
      const tr = document.createElement('tr');

      const createdAt = new Date(o.createdAt).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });

      const statusKey = (o.status || '').toLowerCase(); // e.g. placed, out_for_delivery
      const badgeClass = `status-${statusKey}`;

      const statusOptions = allowedStatuses
        .map(
          s =>
            `<option value="${s}" ${
              s === o.status ? 'selected' : ''
            }>${s}</option>`
        )
        .join('');

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
        <td>${o.outletName || '-'}</td>
        <td>
          <span class="order-status-badge ${badgeClass}">${
        o.status
      }</span><br/>
          <select class="text-small" data-change-status="${o._id}">
            ${statusOptions}
          </select>
        </td>
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

    tbody.querySelectorAll('.admin-order-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        deleteAdminOrder(id, () => loadAdminOrders(page));
      });
    });

    tbody.querySelectorAll('[data-change-status]').forEach(select => {
      select.addEventListener('change', () => {
        const id = select.dataset.changeStatus;
        const newStatus = select.value;
        if (!newStatus) return;
        updateAdminOrderStatus(id, newStatus, () => loadAdminOrders(page));
      });
    });
  } catch (err) {
    console.error('Admin load orders error', err);
    loadingEl.textContent =
      err.message ||
      'Unable to load orders. Please try again after some time.';
  }
}

async function updateAdminOrderStatus(id, newStatus, onDone) {
  try {
    await Api.patch(`/orders/${id}/status`, { status: newStatus });
    onDone && onDone();
  } catch (err) {
    console.error('Admin update order status error', err);
    alert(err.message || 'Unable to update order status.');
  }
}

async function deleteAdminOrder(id, onDone) {
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
    console.error('Admin delete order error', err);
    alert(err.message || 'Unable to delete the order.');
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
      'Unable to load customers. Please try again after some time.';
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
  } catch (err) {
    console.error('Admin load rules error', err);
    loadingEl.textContent =
      err.message || 'Unable to load delivery rules.';
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
    alert('Rule saved successfully.');
  } catch (err) {
    alert(err.message || 'Unable to save the rule.');
  }
}

async function handleToggleRule(id) {
  try {
    await Api.patch(`/admin/delivery-rules/${id}/toggle`, {});
    loadAdminDeliveryRules();
  } catch (err) {
    alert(err.message || 'Unable to toggle this rule.');
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
    alert(err.message || 'Unable to create the new rule.');
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
      err.message || 'Unable to load coupons. Please try again later.';
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

    if (
      field === 'amount' ||
      field === 'minCartAmount' ||
      field === 'maxDiscount'
    ) {
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
    alert('Coupon updated successfully.');
    loadAdminCoupons();
  } catch (err) {
    alert(err.message || 'Unable to update the coupon.');
  }
}

async function handleToggleCoupon(id) {
  try {
    await Api.patch(`/admin/coupons/${id}/toggle`, {});
    loadAdminCoupons();
  } catch (err) {
    alert(err.message || 'Unable to toggle this coupon.');
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
    alert('Coupon code and amount are required.');
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
    alert(err.message || 'Unable to create the new coupon.');
  }
}

// ====================== OUTLETS (admin/outlets.html) ======================

async function initAdminOutletsPage() {
  loadAdminOutlets();

  const addForm = document.getElementById('admin-add-outlet-form');
  if (addForm && !addForm.dataset.bound) {
    addForm.dataset.bound = 'true';
    addForm.addEventListener('submit', handleAddOutlet);
  }
}

async function loadAdminOutlets() {
  const tbody = document.getElementById('admin-outlets-body');
  const loadingEl = document.getElementById('admin-outlets-loading');
  const emptyEl = document.getElementById('admin-outlets-empty');

  if (!tbody || !loadingEl || !emptyEl) return;

  loadingEl.style.display = 'block';
  emptyEl.style.display = 'none';
  tbody.innerHTML = '';

  try {
    const res = await Api.get('/admin/outlets/manage');
    const outlets = res.outlets || [];

    loadingEl.style.display = 'none';

    if (!outlets.length) {
      emptyEl.style.display = 'block';
      return;
    }

    outlets.forEach(o => {
      const tr = document.createElement('tr');

      tr.innerHTML = `
        <td><input type="text" class="input" data-field="name" data-id="${
          o._id
        }" value="${o.name || ''}" /></td>
        <td><input type="text" class="input" data-field="code" data-id="${
          o._id
        }" value="${o.code || ''}" /></td>
        <td><input type="text" class="input" data-field="city" data-id="${
          o._id
        }" value="${o.city || ''}" /></td>
        <td><input type="number" class="input" min="0" max="23" data-field="openHour" data-id="${
          o._id
        }" value="${
        typeof o.openHour === 'number' ? o.openHour : 10
      }" /></td>
        <td><input type="number" class="input" min="0" max="23" data-field="closeHour" data-id="${
          o._id
        }" value="${
        typeof o.closeHour === 'number' ? o.closeHour : 23
      }" /></td>
        <td><input type="number" class="input" min="0" step="0.1" data-field="deliveryRadiusKm" data-id="${
          o._id
        }" value="${
        typeof o.deliveryRadiusKm === 'number' ? o.deliveryRadiusKm : 5
      }" /></td>
        <td>
          <label class="text-small">
            <input type="checkbox" data-field="enableOnlineOrders" data-id="${
              o._id
            }" ${
        o.settings && o.settings.enableOnlineOrders ? 'checked' : ''
      } />
            ON
          </label>
        </td>
        <td>
          <label class="text-small">
            <input type="checkbox" data-field="enableBogoTuesday" data-id="${
              o._id
            }" ${
        o.settings && o.settings.enableBogoTuesday ? 'checked' : ''
      } />
            ON
          </label>
        </td>
        <td>
          <button class="btn btn-secondary btn-sm" data-toggle-outlet="${
            o._id
          }">
            ${o.isActive ? 'Active' : 'Inactive'}
          </button>
        </td>
        <td>
          <button class="btn btn-primary btn-sm" data-save-outlet="${
            o._id
          }">
            Save
          </button>
        </td>
      `;

      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('[data-save-outlet]').forEach(btn => {
      btn.addEventListener('click', () =>
        handleSaveOutlet(btn.dataset.saveOutlet)
      );
    });

    tbody.querySelectorAll('[data-toggle-outlet]').forEach(btn => {
      btn.addEventListener('click', () =>
        handleToggleOutletActive(btn.dataset.toggleOutlet)
      );
    });
  } catch (err) {
    console.error('Admin load outlets error', err);
    loadingEl.textContent =
      err.message || 'Unable to load outlets right now.';
  }
}

async function handleSaveOutlet(id) {
  const rowInputs = document.querySelectorAll(
    `[data-id="${id}"][data-field]`
  );
  const body = {};

  rowInputs.forEach(input => {
    const field = input.dataset.field;
    let value =
      input.type === 'checkbox' ? input.checked : (input.value ?? '');

    if (typeof value === 'string') {
      value = value.trim();
    }

    // empty name/code/city bhejne ki zarurat nahi (purana value DB me rahe)
    if (
      (field === 'name' || field === 'code' || field === 'city') &&
      !value
    ) {
      return;
    }

    if (field === 'openHour' || field === 'closeHour' || field === 'deliveryRadiusKm') {
      const n = Number(value);
      if (!Number.isNaN(n)) body[field] = n;
    } else if (field === 'enableOnlineOrders' || field === 'enableBogoTuesday') {
      body[field] = !!value;
    } else if (field === 'name' || field === 'code' || field === 'city') {
      body[field] = value;
    }
    // lat/lng/phoneNumbers agar baad me add karne ho to yahan bhi handle kar sakte ho
  });

  try {
    await Api.put(`/admin/outlets/${id}`, body);
    alert('Outlet updated.');
    loadAdminOutlets();
  } catch (err) {
    console.error('Admin save outlet error', err);
    const msg =
      (err.data && err.data.message) ||
      err.message ||
      'Unable to update the outlet.';
    const detail = err.data && err.data.error ? `\n${err.data.error}` : '';
    alert(msg + detail);
  }
}

async function handleToggleOutletActive(id) {
  try {
    await Api.patch(`/admin/outlets/${id}/toggle`, {});
    loadAdminOutlets();
  } catch (err) {
    console.error('Admin toggle outlet error', err);
    alert(err.message || 'Unable to toggle this outlet.');
  }
}

async function handleAddOutlet(e) {
  e.preventDefault();
  const form = e.target;

  const body = {
    name: (form.name?.value || '').trim(),
    code: (form.code?.value || '').trim(),
    city: (form.city?.value || '').trim(),
    openHour:
      form.openHour && form.openHour.value !== ''
        ? Number(form.openHour.value)
        : 10,
    closeHour:
      form.closeHour && form.closeHour.value !== ''
        ? Number(form.closeHour.value)
        : 23,
    deliveryRadiusKm:
      form.deliveryRadiusKm && form.deliveryRadiusKm.value !== ''
        ? Number(form.deliveryRadiusKm.value)
        : 5,
    enableOnlineOrders: !!(form.enableOnlineOrders && form.enableOnlineOrders.checked),
    enableBogoTuesday: !!(form.enableBogoTuesday && form.enableBogoTuesday.checked)
  };

  if (!body.name || !body.code) {
    alert('Name and Code are required for an outlet.');
    return;
  }

  try {
    await Api.post('/admin/outlets', body);
    form.reset();
    loadAdminOutlets();
  } catch (err) {
    console.error('Admin add outlet error', err);
    alert(err.message || 'Unable to create the new outlet.');
  }
}