// src/features/admin/orders/OrdersPage.jsx
import React, { useState } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../../../api/client';
import { OrderDetailModal } from './OrderDetailModal';

function normalizeOrders(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.orders)) return data.orders;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function matchStatusFilter(order, filter) {
  const s = order.status ? String(order.status).toUpperCase() : '';

  if (filter === 'DELIVERED') {
    return s.includes('DELIVER') || s.includes('COMPLETE');
  }
  if (filter === 'CANCELLED') {
    return s.includes('CANCEL');
  }
  if (filter === 'IN_PROGRESS') {
    return (
      s.includes('PLACED') ||
      s.includes('PENDING') ||
      s.includes('BAKING') ||
      s.includes('IN_KITCHEN') ||
      s.includes('OUT_FOR_DELIVERY') ||
      s.includes('PREP') ||
      s.includes('COOK')
    );
  }
  return true; // ALL
}

function getStatusBadgeStyle(status) {
  const s = status ? String(status).toUpperCase() : '';
  let bg = 'rgba(15,23,42,0.9)';
  let border = 'rgba(148,163,184,0.6)';
  let color = '#e5e7eb';

  if (s.includes('PENDING')) {
    border = '#f97316';
    color = '#fed7aa';
  } else if (s.includes('PLACED') || s.includes('NEW')) {
    border = '#3b82f6';
    color = '#bfdbfe';
  } else if (
    s.includes('BAKING') ||
    s.includes('IN_KITCHEN') ||
    s.includes('PREP') ||
    s.includes('COOK')
  ) {
    border = '#22c55e';
    color = '#bbf7d0';
  } else if (s.includes('OUT_FOR_DELIVERY')) {
    border = '#a855f7';
    color = '#e9d5ff';
  } else if (s.includes('DELIVER') || s.includes('COMPLETE')) {
    border = '#10b981';
    color = '#a7f3d0';
  } else if (s.includes('CANCEL')) {
    border = '#ef4444';
    color = '#fecaca';
  }

  return { background: bg, borderColor: border, color };
}

export function OrdersPage() {
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL | DELIVERED | IN_PROGRESS | CANCELLED
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);

  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      const res = await api.get('/admin/orders');
      return res.data;
    },
    refetchInterval: 10000, // 10s auto-refresh
  });

  const acceptOrderMutation = useMutation({
    mutationFn: async ({ id, prepMinutes }) => {
      const res = await api.patch(`/orders/${id}/accept`, {
        prepMinutes,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Order accepted');
      queryClient.invalidateQueries(['orders']);
      queryClient.invalidateQueries(['kitchenOrders']);
    },
    onError: (err) => {
      console.error('Accept order error', err);
      toast.error(
        err?.response?.data?.message ||
          'Failed to accept order'
      );
    },
  });

  const orders = normalizeOrders(data);

  // Filter + sort
  const filteredOrders = orders
    .filter((o) => {
      if (!matchStatusFilter(o, statusFilter)) return false;

      const term = search.trim().toLowerCase();
      if (!term) return true;

      const id = String(o._id || o.id || '');
      const customer = (o.customerName || '').toLowerCase();
      const contact = (o.customerContact || '').toLowerCase();

      return (
        id.toLowerCase().includes(term) ||
        customer.includes(term) ||
        contact.includes(term)
      );
    })
    .sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return db - da; // newest first
    });

  if (isLoading) return <div>Loading orders...</div>;
  if (isError) {
    console.error('Orders error', error);
    return (
      <div>
        Error:{' '}
        {error?.response?.data?.message ||
          error.message ||
          'Failed to load orders'}
      </div>
    );
  }

  const handleRowClick = (order) => {
    setSelectedOrder(order);
  };

  const closeModal = () => {
    setSelectedOrder(null);
  };

  const handleAcceptClick = (order, e) => {
    e.stopPropagation(); // row click na trigger ho

    const id = order._id || order.id;
    if (!id) return;

    const defaultMinutes =
      order.kitchenPrepMinutes != null
        ? String(order.kitchenPrepMinutes)
        : '15';

    const input = window.prompt(
      'Prep time (minutes) for this order?',
      defaultMinutes
    );
    if (input == null) return; // cancel

    const minutes = Number(input);
    if (!minutes || minutes <= 0) {
      toast.error('Please enter a valid number of minutes');
      return;
    }

    acceptOrderMutation.mutate({ id, prepMinutes: minutes });
  };

  return (
    <div>
      {/* Top filters */}
      <div
        style={{
          marginBottom: '0.75rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.75rem',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '1rem' }}>Orders</h2>
          <p
            style={{
              margin: 0,
              marginTop: '0.2rem',
              fontSize: '0.75rem',
              color: '#9ca3af',
            }}
          >
            Click a row to view full details. Accept orders to
            send them to kitchen.
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            alignItems: 'center',
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
          }}
        >
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value)
            }
            style={{
              padding: '0.3rem 0.5rem',
              borderRadius: '999px',
              border: '1px solid rgba(148,163,184,0.6)',
              fontSize: '0.8rem',
              background: 'rgba(15,23,42,0.9)',
              color: '#e5e7eb',
            }}
          >
            <option value="ALL">All statuses</option>
            <option value="DELIVERED">
              Delivered / Completed
            </option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <input
            type="text"
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            placeholder="Search by ID / customer / contact"
            style={{
              padding: '0.3rem 0.5rem',
              borderRadius: '999px',
              border: '1px solid rgba(148,163,184,0.6)',
              fontSize: '0.8rem',
              background: 'rgba(15,23,42,0.9)',
              color: '#e5e7eb',
              minWidth: '220px',
            }}
          />
        </div>
      </div>

      {/* Orders table */}
      <div
        className="card"
        style={{
          borderRadius: '0.9rem',
          padding: '0.75rem 0.9rem',
        }}
      >
        <table className="table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Customer</th>
              <th>Items</th>
              <th>Total</th>
              <th>Status</th>
              <th>Admin</th>
              <th>Placed At</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    padding: '0.75rem',
                    textAlign: 'center',
                    color: '#9ca3af',
                    fontSize: '0.85rem',
                  }}
                >
                  No orders found for selected filters.
                </td>
              </tr>
            )}

            {filteredOrders.map((o) => {
              const id = o._id || o.id;
              const itemsCount = o.items?.length || 0;
              const status = o.status || '—';
              const badgeStyle = getStatusBadgeStyle(status);
              const accepted =
                o.isAcceptedByAdmin === true;

              return (
                <tr
                  key={id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleRowClick(o)}
                >
                  <td>#{String(id).slice(-6)}</td>
                  <td>
                    <div style={{ fontSize: '0.9rem' }}>
                      {o.customerName || '-'}
                    </div>
                    {o.customerContact && (
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: '#9ca3af',
                          marginTop: '0.05rem',
                        }}
                      >
                        {o.customerContact}
                      </div>
                    )}
                  </td>
                  <td>{itemsCount}</td>
                  <td>₹ {o.grandTotal}</td>
                  <td>
                    <span
                      className="status-pill"
                      style={{
                        background:
                          badgeStyle.background,
                        border: `1px solid ${badgeStyle.borderColor}`,
                        color: badgeStyle.color,
                      }}
                    >
                      {status
                        .toString()
                        .replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td>
                    {accepted ? (
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: '#22c55e',
                        }}
                      >
                        Accepted
                        {o.kitchenPrepMinutes != null && (
                          <span
                            style={{ color: '#9ca3af' }}
                          >
                            {' '}
                            · {o.kitchenPrepMinutes} min
                          </span>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) =>
                          handleAcceptClick(o, e)
                        }
                        disabled={
                          acceptOrderMutation.isLoading
                        }
                        style={{
                          padding: '0.15rem 0.45rem',
                          borderRadius: '999px',
                          border: 'none',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          background: '#22c55e',
                          color: '#0f172a',
                        }}
                      >
                        {acceptOrderMutation.isLoading
                          ? '...'
                          : 'Accept'}
                      </button>
                    )}
                  </td>
                  <td>
                    {o.createdAt
                      ? new Date(
                          o.createdAt
                        ).toLocaleString()
                      : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Detail modal */}
      <OrderDetailModal
        open={!!selectedOrder}
        order={selectedOrder}
        onClose={closeModal}
        onUpdateStatus={() => {}}
        updating={false}
        nextStatus={null}
      />
    </div>
  );
}