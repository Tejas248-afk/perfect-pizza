// src/sockets/socket.js
const { Server } = require('socket.io');

let io = null;

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
    }
  });

  io.on('connection', socket => {
    console.log('[Socket] connected:', socket.id);

    socket.on('registerUser', payload => {
      try {
        const { userId, role } = payload || {};
        if (!userId) return;

        socket.join(`user:${userId}`);

        if (role === 'KITCHEN' || role === 'ADMIN') {
          socket.join('kitchen');
        }
        if (role === 'ADMIN') {
          socket.join('admin');
        }

        console.log(
          `[Socket] user registered: ${userId}, role=${role}, rooms=${Array.from(
            socket.rooms
          ).join(',')}`
        );
      } catch (err) {
        console.error('registerUser error:', err);
      }
    });

    socket.on('disconnect', reason => {
      console.log('[Socket] disconnected:', socket.id, reason);
    });
  });
}

/**
 * Naya order kitchen/admin ko bhejne ke liye.
 * PAYU (online) ke liye sirf SUCCESS payment pe emit karega.
 */
function emitNewOrder(order) {
  if (!io || !order) return;

  const payment = order.payment || {};
  const isPayu = payment.paymentType === 'PAYU';
  const isCod = payment.paymentType === 'COD';

  // Online (PayU) ke liye: sirf SUCCESS par hi newOrder emit kare
  if (isPayu && payment.paymentStatus !== 'SUCCESS') {
    console.log(
      '[Socket] skip emitNewOrder (unpaid PayU):',
      String(order._id),
      'status=',
      order.status,
      'paymentStatus=',
      payment.paymentStatus
    );
    return;
  }

  // Optional: sirf PLACED ko hi "new" maana
  if (order.status !== 'PLACED') {
    console.log(
      '[Socket] skip emitNewOrder (status != PLACED):',
      String(order._id),
      'status=',
      order.status
    );
    return;
  }

  const payload = {
    _id: order._id,
    status: order.status,
    grandTotal: order.grandTotal,
    createdAt: order.createdAt,
    user: order.user,
    delivery: order.delivery
  };

  console.log('[Socket] emitNewOrder → kitchen/admin:', String(order._id));

  io.to('kitchen').emit('newOrder', payload);
  io.to('admin').emit('newOrder', payload);

  // Customer ko bhi notify
  io.to(`user:${order.user}`).emit('orderStatusUpdated', payload);
}

/**
 * Jab bhi order ka status change ho (BAKING, OUT_FOR_DELIVERY, DELIVERED, etc.)
 */
function emitOrderStatusUpdated(order) {
  if (!io || !order) return;

  const payload = {
    _id: order._id,
    status: order.status,
    grandTotal: order.grandTotal,
    updatedAt: order.updatedAt,
    delivery: order.delivery
  };

  console.log(
    '[Socket] emitOrderStatusUpdated → kitchen/admin/user:',
    String(order._id),
    'status:',
    order.status
  );

  io.to('kitchen').emit('orderStatusUpdated', payload);
  io.to('admin').emit('orderStatusUpdated', payload);
  io.to(`user:${order.user}`).emit('orderStatusUpdated', payload);
}

module.exports = {
  initSocket,
  emitNewOrder,
  emitOrderStatusUpdated
};