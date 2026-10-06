// src/features/kitchen/orders/KitchenOrdersPage.jsx
import React, { useEffect, useMemo } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../../../api/client';
import { io } from 'socket.io-client';

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  'https://perfect-pizza-pa9n.onrender.com';

// Kitchen load -> extra minutes
function getKitchenLoadInfo(activeCount) {
  if (activeCount <= 5) {
    return {
      level: 'NORMAL',
      label: 'Normal',
      color: '#22c55e',
      extraMinutes: 0,
    };
  }
  if (activeCount <= 10) {
    return {
      level: 'BUSY',
      label: 'Busy',
      color: '#facc15',
      extraMinutes: 4,
    };
  }
  if (activeCount <= 15) {
    return {
      level: 'HEAVY',
      label: 'Heavy',
      color: '#f97316',
      extraMinutes: 8,
    };
  }
  return {
    level: 'OVERLOADED',
    label: 'Overloaded',
    color: '#ef4444',
    extraMinutes: 12,
  };
}

// Status transitions (backend ke orderController ke hisab se)
const transitionsDelivery = {
  PLACED: ['BAKING', 'OUT_FOR_DELIVERY', 'CANCELLED'],
  BAKING: ['OUT_FOR_DELIVERY', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

const transitionsPickup = {
  PLACED: ['BAKING', 'CANCELLED'],
  BAKING: ['DELIVERED', 'CANCELLED'], // UI me isko “Ready” dikhayenge
  DELIVERED: [],
  CANCELLED: [],
};

function getAllowedNextStatuses(order) {
  const currentStatus = String(order.status || '').toUpperCase();
  const deliveryType = order.delivery?.deliveryType || 'DELIVERY';
  const t =
    deliveryType === 'PICKUP' ? transitionsPickup : transitionsDelivery;
  return t[currentStatus] || [];
}

// UI label: PICKUP + DELIVERED => "Ready"
function getStatusDisplayLabel(status, deliveryType) {
  const s = String(status || '').toUpperCase();
  if (deliveryType === 'PICKUP') {
    if (s === 'DELIVERED') return 'Ready';
    if (s === 'PLACED') return 'New';
  }
  return s.replace(/_/g, ' ');
}

export function KitchenOrdersPage() {
  const queryClient = useQueryClient();

  // Orders for kitchen
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['kitchenOrders'],
    queryFn: async () => {
      const res = await api.get('/orders/kitchen', {
        params: { filter: 'active' },
      });
      return res.data;
    },
    refetchInterval: 15000, // backup polling
  });

  // Socket.IO live updates
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
    });

    socket.on('order:new', () => {
      queryClient.invalidateQueries(['kitchenOrders']);
    });
    socket.on('order:statusUpdated', () => {
      queryClient.invalidateQueries(['kitchenOrders']);
    });

    return () => {
      socket.disconnect();
    };
  }, [queryClient]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      const res = await api.patch(`/orders/${id}/status`, { status });
      return res.data;
    },
    onSuccess: (_, vars) => {
      toast.success(`Order → ${vars.status}`);
      queryClient.invalidateQueries(['kitchenOrders']);
      queryClient.invalidateQueries(['orders']);
    },
    onError: (err) => {
      console.error('Kitchen update status error:', err);
      toast.error(
        err?.response?.data?.message ||
          'Failed to update status'
      );
    },
  });

  // Normalize orders
  let orders = [];
  if (Array.isArray(data)) orders = data;
  else if (Array.isArray(data?.orders)) orders = data.orders;
  else if (Array.isArray(data?.data)) orders = data.data;
  else if (Array.isArray(data?.items)) orders = data.items;

  // Group by statuses relevant for kitchen
  const grouped = useMemo(() => {
    const result = {
      PLACED: [],
      BAKING: [],
      OUT_FOR_DELIVERY: [],
    };
    orders.forEach((o) => {
      const s = String(o.status || '').toUpperCase();
      if (result[s]) result[s].push(o);
    });
    return result;
  }, [orders]);

  const activeCount =
    grouped.PLACED.length +
    grouped.BAKING.length +
    grouped.OUT_FOR_DELIVERY.length;

  const kitchenInfo = getKitchenLoadInfo(activeCount);
  const basePrep = 14;
  const baseDelivery = 22;
  const estPrep = basePrep + kitchenInfo.extraMinutes;
  const estDelivery = baseDelivery + Math.round(kitchenInfo.extraMinutes / 2);
  const estTotal = estPrep + estDelivery;

  const handleStatusChange = (order, newStatus) => {
    if (!newStatus) return;
    const id = order._id || order.id;
    if (!id) return;
    updateStatusMutation.mutate({ id, status: newStatus });
  };

  const handlePrintKOT = (order) => {
    try {
      const id = order._id || order.id;
      const items = order.items || [];
      const deliveryType = order.delivery?.deliveryType || 'DELIVERY';

      const win = window.open('', '_blank', 'width=380,height=600');
      if (!win) return;

      const created = order.createdAt
        ? new Date(order.createdAt).toLocaleString()
        : '';

      const html = `
<html>
  <head>
    <title>KOT #${String(id).slice(-6)}</title>
    <style>
      * { box-sizing: border-box; }
      body {
        font-family: "Courier New", monospace;
        font-size: 11px;
        margin: 4px;
        width: 280px;
      }
      h1 {
        font-size: 14px;
        margin: 0 0 4px;
        text-align: center;
        text-transform: uppercase;
      }
      .brand {
        text-align: center;
        font-size: 11px;
        margin-bottom: 4px;
      }
      .tag {
        text-align: center;
        font-weight: bold;
        margin: 4px 0;
        padding: 2px 0;
        border-top: 1px dashed #000;
        border-bottom: 1px dashed #000;
      }
      .meta {
        font-size: 10px;
        margin-bottom: 4px;
      }
      .meta div { margin-bottom: 2px; }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 4px;
      }
      th, td {
        padding: 2px 0;
        border-bottom: 1px dashed #000;
        text-align: left;
      }
      th {
        font-size: 10px;
        font-weight: bold;
      }
      .center { text-align: center; }
      .right { text-align: right; }
      .small { font-size: 9px; }
    </style>
  </head>
  <body>
    <h1>Perfect Pizza</h1>
    <div class="brand">Kitchen Order Ticket</div>
    <div class="tag">${
      deliveryType === 'PICKUP' ? 'PICKUP ORDER' : 'DELIVERY ORDER'
    }</div>
    <div class="meta">
      <div>Order: #${String(id).slice(-6)}</div>
      <div>Customer: ${order.customerName || '-'}</div>
      ${
        order.customerContact
          ? `<div>Contact: ${order.customerContact}</div>`
          : ''
      }
      <div>Placed: ${created}</div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th class="center">Qty</th>
        </tr>
      </thead>
      <tbody>
        ${items
          .map((it, idx) => {
            const qty = it.quantity || 1;
            const size =
              typeof it.size === 'string'
                ? it.size
                : it.size && typeof it.size === 'object'
                ? it.size.name
                : '';
            const crust =
              typeof it.crust === 'string'
                ? it.crust
                : it.crust && typeof it.crust === 'object'
                ? it.crust.name
                : '';
            const addOns = Array.isArray(it.addOns)
              ? it.addOns
                  .map((a) =>
                    a.quantity ? a.name + ' x' + a.quantity : a.name
                  )
                  .join(', ')
              : '';
            const details = [size, crust, addOns]
              .filter(Boolean)
              .join(' | ');
            return `<tr>
              <td>
                ${it.name || 'Item'}
                ${
                  details
                    ? `<div class="small">${details}</div>`
                    : ''
                }
              </td>
              <td class="center">${qty}</td>
            </tr>`;
          })
          .join('')}
      </tbody>
    </table>
    <div class="small" style="margin-top:4px;text-align:center;">
      *** KITCHEN COPY ***
    </div>
    <script>
      window.print();
      setTimeout(function(){ window.close(); }, 400);
    </script>
  </body>
</html>`;

      win.document.open();
      win.document.write(html);
      win.document.close();
    } catch (e) {
      console.error('KOT print error', e);
    }
  };

  if (isLoading) {
    return (
      <div style={{ color: '#e5e7eb' }}>Loading orders...</div>
    );
  }

  if (isError) {
    console.error('Kitchen orders error:', error);
    return (
      <div style={{ color: '#fca5a5' }}>
        Error:{' '}
        {error?.response?.data?.message ||
          error.message ||
          'Failed to load kitchen orders'}
      </div>
    );
  }

  // KDS columns mapping:
  // NEW           -> PLACED
  // PREPARING     -> BAKING
  // READY         -> OUT_FOR_DELIVERY (delivery) / further stages
  const columns = [
    { id: 'PLACED', title: 'NEW' },
    { id: 'BAKING', title: 'PREPARING' },
    { id: 'OUT_FOR_DELIVERY', title: 'READY' },
  ];

  return (
    <div
      style={{
        padding: '0.75rem',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      {/* Top bar + load meter */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '0.75rem',
          flexWrap: 'wrap',
          color: '#e5e7eb',
        }}
      >
        <div style={{ minWidth: 220 }}>
          <h2 style={{ margin: 0, fontSize: '1rem' }}>
            Kitchen Display
          </h2>
          <p
            style={{
              margin: 0,
              marginTop: '0.15rem',
              fontSize: '0.75rem',
              color: '#9ca3af',
            }}
          >
            NEW → PREPARING → READY
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            flex: 1,
            gap: '0.75rem',
            minWidth: 320,
            justifyContent: 'flex-end',
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              flex: 1,
              minWidth: 200,
              padding: '0.5rem 0.7rem',
              borderRadius: '0.9rem',
              border: `1px solid ${kitchenInfo.color}`,
              background: 'rgba(15,23,42,0.95)',
            }}
          >
            <div
              style={{
                fontSize: '0.75rem',
                color: '#9ca3af',
                marginBottom: 4,
              }}
            >
              Kitchen Load
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.85rem',
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '999px',
                  background: kitchenInfo.color,
                }}
              />
              <span style={{ fontWeight: 500 }}>
                {kitchenInfo.label}
              </span>
              <span
                style={{
                  color: '#9ca3af',
                  fontSize: '0.75rem',
                }}
              >
                ({activeCount} active orders)
              </span>
            </div>
          </div>

          <div
            style={{
              flex: 1,
              minWidth: 200,
              padding: '0.5rem 0.7rem',
              borderRadius: '0.9rem',
              border: '1px solid rgba(148,163,184,0.6)',
              background: 'rgba(15,23,42,0.95)',
              fontSize: '0.8rem',
            }}
          >
            <div
              style={{
                fontSize: '0.75rem',
                color: '#9ca3af',
                marginBottom: 4,
              }}
            >
              Estimated Time (per new order)
            </div>
            <div>Prep: {estPrep} min</div>
            <div>Delivery: {estDelivery} min</div>
            <div
              style={{
                marginTop: 2,
                fontWeight: 600,
              }}
            >
              Total: ~{estTotal} min
            </div>
          </div>
        </div>
      </div>

      {/* 3-column KDS grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
          gap: '0.8rem',
          flex: 1,
          minHeight: 0,
        }}
      >
        {columns.map((col) => (
          <div
            key={col.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              background: 'rgba(15,23,42,0.98)',
              borderRadius: '1rem',
              padding: '0.5rem',
              maxHeight: 'calc(100vh - 7rem)',
            }}
          >
            <div
              style={{
                marginBottom: '0.5rem',
                fontSize: '0.9rem',
                fontWeight: 600,
                color: '#e5e7eb',
                textAlign: 'center',
              }}
            >
              {col.title}{' '}
              <span
                style={{
                  fontWeight: 400,
                  color: '#9ca3af',
                  fontSize: '0.75rem',
                }}
              >
                ({grouped[col.id]?.length || 0})
              </span>
            </div>

            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
            >
              {(grouped[col.id] || []).map((order, idx) => (
                <OrderCard
                  key={order._id || order.id || idx}
                  order={order}
                  etaMinutes={estTotal}
                  onChangeStatus={handleStatusChange}
                  isUpdating={updateStatusMutation.isLoading}
                  onPrintKOT={handlePrintKOT}
                />
              ))}

              {grouped[col.id]?.length === 0 && (
                <div
                  style={{
                    fontSize: '0.8rem',
                    color: '#6b7280',
                    padding: '0.6rem 0.75rem',
                    borderRadius: '0.5rem',
                    border: '1px dashed #1f2937',
                    textAlign: 'center',
                  }}
                >
                  No orders
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OrderCard({
  order,
  etaMinutes,
  onChangeStatus,
  isUpdating,
  onPrintKOT,
}) {
  const id = order._id || order.id;
  const items = order.items || [];
  const status = order.status || '—';
  const total = order.grandTotal || order.subtotal || 0;
  const deliveryType = order.delivery?.deliveryType || 'DELIVERY';

  const allowedNext = getAllowedNextStatuses(order);
  const statusLabel = getStatusDisplayLabel(
    status,
    deliveryType
  );

  return (
    <div
      style={{
        background: '#020617',
        borderRadius: '0.8rem',
        padding: '0.6rem 0.75rem',
        border: '1px solid #1f2937',
        color: '#e5e7eb',
        fontSize: '0.9rem',
      }}
    >
      {/* Top row: ID + ETA */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '0.25rem',
        }}
      >
        <div style={{ fontWeight: 700, fontSize: '1rem' }}>
          #{String(id).slice(-6)}
        </div>
        <div
          style={{
            fontSize: '0.78rem',
            color: '#9ca3af',
          }}
        >
          ETA: ~{etaMinutes} min
        </div>
      </div>

      {/* Items summary only (KDS friendly) */}
      <div
        style={{
          marginBottom: '0.3rem',
          color: '#d1d5db',
        }}
      >
        {items.map((it, idx) => (
          <div key={it._id || it.id || idx}>
            {it.quantity || 1} × {it.name}
          </div>
        ))}
      </div>

      {/* Bottom controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '0.2rem',
          gap: '0.4rem',
          fontSize: '0.78rem',
        }}
      >
        <div style={{ color: '#9ca3af' }}>
          {deliveryType === 'PICKUP' ? 'Pickup' : 'Delivery'} ·{' '}
          {statusLabel}
        </div>

        <div
          style={{
            display: 'flex',
            gap: '0.3rem',
            alignItems: 'center',
          }}
        >
          <button
            type="button"
            onClick={() => onPrintKOT(order)}
            style={{
              padding: '0.25rem 0.5rem',
              borderRadius: '999px',
              border: '1px solid rgba(148,163,184,0.7)',
              background: 'rgba(15,23,42,0.9)',
              color: '#e5e7eb',
              fontSize: '0.75rem',
              cursor: 'pointer',
            }}
          >
            Print KOT
          </button>

          {allowedNext.length > 0 && (
            <select
              disabled={isUpdating}
              defaultValue=""
              onChange={(e) => {
                const v = e.target.value;
                if (v) onChangeStatus(order, v);
                e.target.value = '';
              }}
              style={{
                padding: '0.25rem 0.55rem',
                borderRadius: '999px',
                border:
                  '1px solid rgba(148,163,184,0.7)',
                background: 'rgba(15,23,42,0.9)',
                color: '#e5e7eb',
                fontSize: '0.75rem',
                cursor: 'pointer',
              }}
            >
              <option value="">Next status</option>
              {allowedNext.map((s) => (
                <option key={s} value={s}>
                  {getStatusDisplayLabel(s, deliveryType)}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
    </div>
  );
}