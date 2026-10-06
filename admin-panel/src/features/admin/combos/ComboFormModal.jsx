// src/features/admin/combos/ComboFormModal.jsx
import React, { useEffect, useMemo, useState } from 'react';

const SIZE_OPTIONS = ['ANY', 'REGULAR', 'MEDIUM', 'LARGE', '7"'];
const GROUP_OPTIONS = ['Pizza', 'Drink', 'Side', 'Dessert', 'Other'];

// Products ko unki category ke hisaab se group karne ka helper
function groupProductsByCategory(products) {
  const groups = {};

  for (const p of products) {
    const category =
      p.category?.name ||
      p.categoryName ||
      p.category ||
      p.type ||
      p.group ||
      'Other';

    if (!groups[category]) groups[category] = [];
    groups[category].push(p);
  }

  return groups;
}

export function ComboFormModal({
  open,
  onClose,
  onSubmit,
  initialCombo,
  submitting,
  products,
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [regularPrice, setRegularPrice] = useState('');
  const [comboPrice, setComboPrice] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [showOnWebsite, setShowOnWebsite] = useState(true);
  const [items, setItems] = useState([]);
  const [upgrades, setUpgrades] = useState([]); // ✅ NEW

  const safeProducts = Array.isArray(products) ? products : [];
  const productGroups = useMemo(
    () => groupProductsByCategory(safeProducts),
    [safeProducts]
  );

  useEffect(() => {
    if (initialCombo) {
      setName(initialCombo.name || '');
      setDescription(initialCombo.description || '');
      setRegularPrice(
        initialCombo.regularPrice != null
          ? String(initialCombo.regularPrice)
          : ''
      );
      setComboPrice(
        initialCombo.comboPrice != null
          ? String(initialCombo.comboPrice)
          : ''
      );
      setIsActive(initialCombo.isActive !== false);
      setShowOnWebsite(initialCombo.showOnWebsite !== false);
      setItems(
        Array.isArray(initialCombo.items)
          ? initialCombo.items.map((it) => ({
              ...it,
              _isCustom:
                (!it.product || it.product === '__custom') &&
                !!it.productName,
            }))
          : []
      );
      setUpgrades(
        Array.isArray(initialCombo.upgrades)
          ? initialCombo.upgrades
          : []
      );
    } else {
      setName('');
      setDescription('');
      setRegularPrice('');
      setComboPrice('');
      setIsActive(true);
      setShowOnWebsite(true);
      setItems([]);
      setUpgrades([]);
    }
  }, [initialCombo, open]);

  if (!open) return null;

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        product: '',
        productName: '',
        size: 'ANY',
        quantity: 1,
        group: 'Pizza',
        _isCustom: false,
      },
    ]);
  };

  const handleItemChange = (index, field, value) => {
    setItems((prev) =>
      prev.map((it, i) =>
        i === index ? { ...it, [field]: value } : it
      )
    );
  };

  const handleItemCustomNameChange = (index, value) => {
    setItems((prev) =>
      prev.map((it, i) =>
        i === index ? { ...it, productName: value } : it
      )
    );
  };

  const handleItemProductChange = (index, productId) => {
    if (productId === '__custom') {
      // Custom / Other item
      setItems((prev) =>
        prev.map((it, i) =>
          i === index
            ? {
                ...it,
                product: '',
                _isCustom: true,
              }
            : it
        )
      );
      return;
    }

    if (!productId) {
      // Clear selection
      setItems((prev) =>
        prev.map((it, i) =>
          i === index
            ? {
                ...it,
                product: '',
                productName: '',
                _isCustom: false,
              }
            : it
        )
      );
      return;
    }

    const p = safeProducts.find(
      (x) => String(x._id || x.id) === String(productId)
    );

    setItems((prev) =>
      prev.map((it, i) =>
        i === index
          ? {
              ...it,
              product: productId,
              productName: p ? p.name : '',
              _isCustom: false,
            }
          : it
      )
    );
  };

  const handleRemoveItem = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // ✅ NEW: upgrades handlers
  const handleAddUpgrade = () => {
    setUpgrades((prev) => [
      ...prev,
      { label: '', price: 0 },
    ]);
  };

  const handleUpgradeChange = (index, field, value) => {
    setUpgrades((prev) =>
      prev.map((u, i) =>
        i === index
          ? {
              ...u,
              [field]:
                field === 'price' ? Number(value || 0) : value,
            }
          : u
      )
    );
  };

  const handleRemoveUpgrade = (index) => {
    setUpgrades((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      regularPrice: regularPrice
        ? Number(regularPrice)
        : undefined,
      comboPrice: comboPrice ? Number(comboPrice) : 0,
      isActive,
      showOnWebsite,
      items: items.map(({ _isCustom, ...it }) => ({
        product: it.product || undefined,
        productName: it.productName,
        size: it.size,
        quantity: Number(it.quantity || 1),
        group: it.group,
      })),
      upgrades: upgrades
        .filter((u) => u.label && u.label.trim())
        .map((u) => ({
          label: u.label.trim(),
          price: Number(u.price || 0),
        })),
    };
    onSubmit(payload);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
      }}
    >
      <div
        className="card"
        style={{
          width: '780px',
          maxWidth: '95vw',
          maxHeight: '95vh',
          padding: '0.9rem 1rem',
          borderRadius: '1rem',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '0.5rem',
            alignItems: 'center',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '1rem' }}>
            {initialCombo ? 'Edit Combo' : 'Create Combo'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#9ca3af',
              cursor: 'pointer',
              fontSize: '1.1rem',
            }}
          >
            ×
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            display: 'grid',
            gridTemplateColumns:
              'minmax(0, 1.2fr) minmax(0, 1.5fr)',
            gap: '0.8rem',
            overflow: 'auto',
          }}
        >
          {/* Left: main info */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.6rem',
            }}
          >
            <div className="field">
              <label className="field-label">Combo Name</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Family Pizza Combo"
              />
            </div>
            <div className="field">
              <label className="field-label">Description</label>
              <textarea
                className="input"
                style={{
                  minHeight: '60px',
                  resize: 'vertical',
                }}
                value={description}
                onChange={(e) =>
                  setDescription(e.target.value)
                }
                placeholder="2 Pizzas + 2 Drinks + Garlic Bread..."
              />
            </div>
            <div className="field">
              <label className="field-label">
                Regular Price (₹)
              </label>
              <input
                className="input"
                type="number"
                min="0"
                step="1"
                value={regularPrice}
                onChange={(e) =>
                  setRegularPrice(e.target.value)
                }
                placeholder="e.g. 599"
              />
            </div>
            <div className="field">
              <label className="field-label">
                Combo Price (₹)
              </label>
              <input
                className="input"
                type="number"
                min="0"
                step="1"
                value={comboPrice}
                onChange={(e) =>
                  setComboPrice(e.target.value)
                }
                required
                placeholder="e.g. 499"
              />
            </div>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                fontSize: '0.8rem',
                color: '#cbd5f5',
                marginTop: '0.2rem',
              }}
            >
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) =>
                  setIsActive(e.target.checked)
                }
              />
              Combo is active
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                fontSize: '0.8rem',
                color: '#cbd5f5',
                marginTop: '0.2rem',
              }}
            >
              <input
                type="checkbox"
                checked={showOnWebsite}
                onChange={(e) =>
                  setShowOnWebsite(e.target.checked)
                }
              />
              Show on website
            </label>
          </div>

          {/* Right: items builder + upgrades */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.6rem',
            }}
          >
            {/* Items */}
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <label className="field-label">
                  Items in Combo
                </label>
                <button
                  type="button"
                  className="btn"
                  onClick={handleAddItem}
                  style={{
                    background: '#1f2937',
                    color: '#e5e7eb',
                    fontSize: '0.75rem',
                    padding: '0.25rem 0.55rem',
                  }}
                >
                  + Add item
                </button>
              </div>

              {items.length === 0 && (
                <div
                  className="text-muted-small"
                  style={{ marginBottom: '0.3rem' }}
                >
                  Add pizza, drink and side items to build
                  combo.
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                }}
              >
                {items.map((it, index) => (
                  <div
                    key={index}
                    style={{
                      borderRadius: '0.6rem',
                      padding: '0.4rem 0.45rem',
                      background: 'rgba(15,23,42,0.9)',
                      border:
                        '1px solid rgba(15,23,42,0.9)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        gap: '0.3rem',
                        alignItems: 'center',
                        marginBottom: '0.25rem',
                      }}
                    >
                      <select
                        className="input"
                        style={{ flex: 1 }}
                        value={
                          it.product ||
                          (it._isCustom
                            ? '__custom'
                            : '')
                        }
                        onChange={(e) =>
                          handleItemProductChange(
                            index,
                            e.target.value
                          )
                        }
                      >
                        <option value="">
                          Select item
                        </option>
                        {Object.entries(
                          productGroups
                        ).map(
                          ([
                            catName,
                            catProducts,
                          ]) => (
                            <optgroup
                              key={catName}
                              label={catName}
                            >
                              {catProducts.map((p) => (
                                <option
                                  key={
                                    p._id ||
                                    p.id
                                  }
                                  value={
                                    p._id ||
                                    p.id
                                  }
                                >
                                  {p.name}
                                </option>
                              ))}
                            </optgroup>
                          )
                        )}
                        <option value="__custom">
                          Other / Custom
                        </option>
                      </select>

                      <select
                        className="input"
                        style={{ width: 90 }}
                        value={it.size || 'ANY'}
                        onChange={(e) =>
                          handleItemChange(
                            index,
                            'size',
                            e.target.value
                          )
                        }
                      >
                        {SIZE_OPTIONS.map((s) => (
                          <option
                            key={s}
                            value={s}
                          >
                            {s}
                          </option>
                        ))}
                      </select>

                      <input
                        className="input"
                        style={{ width: 50 }}
                        type="number"
                        min="1"
                        value={it.quantity || 1}
                        onChange={(e) =>
                          handleItemChange(
                            index,
                            'quantity',
                            Number(
                              e.target.value ||
                                1
                            )
                          )
                        }
                      />

                      <button
                        type="button"
                        className="btn"
                        onClick={() =>
                          handleRemoveItem(index)
                        }
                        style={{
                          background: '#7f1d1d',
                          color: '#fecaca',
                          fontSize: '0.75rem',
                          padding:
                            '0.2rem 0.4rem',
                        }}
                      >
                        ×
                      </button>
                    </div>

                    {it._isCustom && (
                      <div
                        style={{
                          marginBottom: '0.3rem',
                        }}
                      >
                        <input
                          className="input"
                          value={
                            it.productName ||
                            ''
                          }
                          onChange={(e) =>
                            handleItemCustomNameChange(
                              index,
                              e.target.value
                            )
                          }
                          placeholder='Custom item name, e.g. "Any Medium Pizza"'
                        />
                        <div
                          className="text-muted-small"
                          style={{
                            fontSize: '0.7rem',
                            marginTop:
                              '0.1rem',
                          }}
                        >
                          This name will
                          be shown on the
                          website instead
                          of a specific
                          menu item.
                        </div>
                      </div>
                    )}

                    <div
                      style={{
                        display: 'flex',
                        gap: '0.3rem',
                        alignItems: 'center',
                      }}
                    >
                      <select
                        className="input"
                        style={{ width: 120 }}
                        value={
                          it.group ||
                          'Pizza'
                        }
                        onChange={(e) =>
                          handleItemChange(
                            index,
                            'group',
                            e.target.value
                          )
                        }
                      >
                        {GROUP_OPTIONS.map(
                          (g) => (
                            <option
                              key={g}
                              value={g}
                            >
                              {g}
                            </option>
                          )
                        )}
                      </select>
                      <div
                        className="text-muted-small"
                        style={{
                          fontSize:
                            '0.72rem',
                        }}
                      >
                        Use group to
                        separate Pizza /
                        Drink / Side in
                        UI.
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ✅ Combo upgrades / add-ons */}
            <div
              style={{
                borderTop:
                  '1px solid rgba(55,65,81,0.9)',
                paddingTop: '0.5rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent:
                    'space-between',
                  alignItems: 'center',
                  marginBottom: '0.3rem',
                }}
              >
                <label className="field-label">
                  Combo Add-ons / Upgrades
                </label>
                <button
                  type="button"
                  className="btn"
                  onClick={handleAddUpgrade}
                  style={{
                    background: '#1f2937',
                    color: '#e5e7eb',
                    fontSize: '0.75rem',
                    padding:
                      '0.25rem 0.55rem',
                  }}
                >
                  + Add upgrade
                </button>
              </div>

              {upgrades.length === 0 && (
                <div
                  className="text-muted-small"
                  style={{
                    marginBottom:
                      '0.3rem',
                    fontSize: '0.75rem',
                  }}
                >
                  Example:&nbsp;
                  Cheese Burst +₹60,
                  Extra Cheese +₹40
                  etc.
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  flexDirection:
                    'column',
                  gap: '0.3rem',
                }}
              >
                {upgrades.map((u, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      gap: '0.3rem',
                      alignItems: 'center',
                    }}
                  >
                    <input
                      className="input"
                      style={{ flex: 1 }}
                      placeholder="Upgrade name (e.g. Cheese Burst)"
                      value={u.label || ''}
                      onChange={(e) =>
                        handleUpgradeChange(
                          index,
                          'label',
                          e.target.value
                        )
                      }
                    />
                    <input
                      className="input"
                      style={{ width: 90 }}
                      type="number"
                      min="0"
                      step="1"
                      placeholder="₹"
                      value={u.price ?? 0}
                      onChange={(e) =>
                        handleUpgradeChange(
                          index,
                          'price',
                          e.target.value
                        )
                      }
                    />
                    <button
                      type="button"
                      className="btn"
                      onClick={() =>
                        handleRemoveUpgrade(
                          index
                        )
                      }
                      style={{
                        background:
                          '#7f1d1d',
                        color: '#fecaca',
                        fontSize:
                          '0.75rem',
                        padding:
                          '0.2rem 0.4rem',
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Buttons */}
            <div
              style={{
                display: 'flex',
                justifyContent:
                  'flex-end',
                gap: '0.5rem',
                marginTop: '0.5rem',
              }}
            >
              <button
                type="button"
                className="btn"
                style={{
                  background: '#1f2937',
                  color: '#e5e7eb',
                }}
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
              >
                {submitting
                  ? 'Saving...'
                  : 'Save Combo'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}